const cron = require('node-cron');
const pool = require('../config/db');
const {
  sendReminderEmail,
  sendOverdueEmail,
  sendEscalationEmail,
} = require('../services/emailService');
// ─────────────────────────────────────────
//  HELPER: Log alerts to the database
// ─────────────────────────────────────────
const logAlert = async (scheduleId, userId, channel, message, daysBeforeDue) => {
  try {
    await pool.query(
      `INSERT INTO alert_logs (schedule_id, sent_to_user, channel, message, days_before_due)
       VALUES ($1, $2, $3, $4, $5)`,
      [scheduleId, userId, channel, message, daysBeforeDue]
    );
  } catch (err) {
    console.error('Failed to log alert:', err.message);
  }
};

// ─────────────────────────────────────────
//  JOB 1: Mark overdue tasks
//  Runs every day at 7:00 AM
//  Finds tasks where scheduled_date has
//  passed and status is still scheduled
//  or in_progress
// ─────────────────────────────────────────
const markOverdueTasks = async () => {
  console.log('[Scheduler] Checking for overdue tasks...');
  try {
    const result = await pool.query(
      `UPDATE maintenance_schedules
       SET status = 'overdue'
       WHERE scheduled_date < CURRENT_DATE
         AND status IN ('scheduled', 'in_progress')
       RETURNING id, title, assigned_to, equipment_id`
    );

    if (result.rows.length === 0) {
      console.log('[Scheduler] No new overdue tasks found.');
      return;
    }

    console.log(`[Scheduler] Marked ${result.rows.length} task(s) as overdue.`);

    // Log a status change for each task that was just marked overdue
   for (const task of result.rows) {
      await pool.query(
        `INSERT INTO maintenance_status_logs
           (schedule_id, changed_by, old_status, new_status, remarks)
         VALUES ($1, NULL, 'scheduled', 'overdue', 'Automatically marked overdue by system.')`,
        [task.id]
      );

      // Get full task details for the email
      const fullTask = await pool.query(
        `SELECT ms.*, e.name AS equipment_name, e.location AS equipment_location,
                u.email AS technician_email, u.full_name AS technician_name
         FROM maintenance_schedules ms
         LEFT JOIN equipment e ON ms.equipment_id = e.id
         LEFT JOIN users     u ON ms.assigned_to   = u.id
         WHERE ms.id = $1`,
        [task.id]
      );

      if (fullTask.rows.length > 0) {
        const t = fullTask.rows[0];

        // Send overdue email to the assigned technician
        if (t.technician_email) {
          await sendOverdueEmail(t.technician_email, {
            recipientName:     t.technician_name,
            taskTitle:         t.title,
            equipmentName:     t.equipment_name,
            equipmentLocation: t.equipment_location,
            scheduledDate:     new Date(t.scheduled_date).toDateString(),
            maintenanceType:   t.maintenance_type,
            daysOverdue:       1,
          });
        }

        const message = `OVERDUE: Task "${t.title}" is past its scheduled date.`;
        await logAlert(task.id, task.assigned_to, 'email', message, null);
      }

      console.log(`[Scheduler] Task ${task.id} — "${task.title}" marked overdue.`);
    }
  } catch (err) {
    console.error('[Scheduler] Error marking overdue tasks:', err.message);
  }
};

// ─────────────────────────────────────────
//  JOB 2: Send upcoming maintenance alerts
//  Finds tasks due in exactly 7, 3, or 1
//  day(s) and logs an alert for each
// ─────────────────────────────────────────
const sendUpcomingAlerts = async () => {
  console.log('[Scheduler] Checking for upcoming maintenance alerts...');

  const alertWindows = [
    { days: 7, label: 'in 7 days',  urgency: 'REMINDER'      },
    { days: 3, label: 'in 3 days',  urgency: 'REMINDER'      },
    { days: 1, label: 'TOMORROW',   urgency: 'URGENT REMINDER'},
    { days: 0, label: 'TODAY',      urgency: 'DUE TODAY'      },
  ];

  try {
    for (const window of alertWindows) {
      const result = await pool.query(
        `SELECT
            ms.id,
            ms.title,
            ms.scheduled_date,
            ms.maintenance_type,
            ms.assigned_to,
            e.name  AS equipment_name,
            u.email AS technician_email,
            u.phone AS technician_phone,
            u.full_name AS technician_name
         FROM maintenance_schedules ms
         LEFT JOIN equipment e ON ms.equipment_id = e.id
         LEFT JOIN users     u ON ms.assigned_to   = u.id
         WHERE ms.status = 'scheduled'
           AND ms.scheduled_date = CURRENT_DATE + INTERVAL '${window.days} days'`,
        []
      );

      if (result.rows.length === 0) {
        console.log(`[Scheduler] No tasks due ${window.label}.`);
        continue;
      }

      console.log(`[Scheduler] Found ${result.rows.length} task(s) due ${window.label}.`);

      for (const task of result.rows) {
        const message =
          `${window.urgency}: Maintenance task "${task.title}" ` +
          `for ${task.equipment_name} is scheduled ${window.label} ` +
          `(${task.scheduled_date}). Assigned to: ${task.technician_name}.`;

        // Log email alert
        await logAlert(task.id, task.assigned_to, 'email', message, window.days);

        // Log SMS alert for same-day and next-day tasks
        if (window.days <= 1) {
          await logAlert(task.id, task.assigned_to, 'sms', message, window.days);
        }

        // Log in-app alert
        await logAlert(task.id, task.assigned_to, 'in_app', message, window.days);

        console.log(
          `[Scheduler] Alert logged for task ${task.id} — ` +
          `"${task.title}" assigned to ${task.technician_name}.`
        );
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error sending upcoming alerts:', err.message);
  }
};

// ─────────────────────────────────────────
//  JOB 3: Escalation alerts for managers
//  Finds tasks that have been overdue for
//  more than 2 days and alerts managers
// ─────────────────────────────────────────
const sendEscalationAlerts = async () => {
  console.log('[Scheduler] Checking for escalation alerts...');
  try {
    const result = await pool.query(
      `SELECT
          ms.id,
          ms.title,
          ms.scheduled_date,
          CURRENT_DATE - ms.scheduled_date AS days_overdue,
          e.name      AS equipment_name,
          u.full_name AS technician_name,
          u.email     AS technician_email
       FROM maintenance_schedules ms
       LEFT JOIN equipment e ON ms.equipment_id = e.id
       LEFT JOIN users     u ON ms.assigned_to   = u.id
       WHERE ms.status = 'overdue'
         AND CURRENT_DATE - ms.scheduled_date > 2`
    );

    if (result.rows.length === 0) {
      console.log('[Scheduler] No escalation alerts needed.');
      return;
    }

    // Get all managers to notify
    const managers = await pool.query(
      `SELECT id, full_name, email FROM users WHERE role = 'manager' AND is_active = true`
    );

    for (const task of result.rows) {
      for (const manager of managers.rows) {
        const message =
          `ESCALATION ALERT: Task "${task.title}" for ${task.equipment_name} ` +
          `is ${task.days_overdue} day(s) overdue. ` +
          `Assigned technician: ${task.technician_name}. Immediate action required.`;

        await logAlert(task.id, manager.id, 'email', message, -task.days_overdue);

        console.log(
          `[Scheduler] Escalation alert sent to manager ${manager.full_name} ` +
          `for task ${task.id} — "${task.title}" (${task.days_overdue} days overdue).`
        );
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error sending escalation alerts:', err.message);
  }
};

// ─────────────────────────────────────────
//  MASTER SCHEDULER
//  Runs all three jobs every day at 7:00 AM
// ─────────────────────────────────────────
cron.schedule('0 7 * * *', async () => {
  console.log('\n========================================');
  console.log('[Scheduler] Daily maintenance check started:', new Date().toLocaleString());
  console.log('========================================');

  await markOverdueTasks();
  await sendUpcomingAlerts();
  await sendEscalationAlerts();

  console.log('[Scheduler] Daily maintenance check completed.');
  console.log('========================================\n');
});

// ─────────────────────────────────────────
//  MANUAL TRIGGER FUNCTION
//  Exported so we can call it from a route
//  during testing without waiting for 7 AM
// ─────────────────────────────────────────
const runSchedulerNow = async () => {
  console.log('\n[Scheduler] Manual trigger initiated...');
  await markOverdueTasks();
  await sendUpcomingAlerts();
  await sendEscalationAlerts();
  console.log('[Scheduler] Manual trigger completed.\n');
};

module.exports = { runSchedulerNow };

console.log('[Scheduler] Cron job scheduled — runs daily at 7:00 AM.');