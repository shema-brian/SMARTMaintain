const express              = require('express');
const router               = express.Router();
const pool                 = require('../config/db');
const { protect, restrictTo } = require('../middleware/auth');
const { runSchedulerNow } = require('../jobs/scheduler');
const { sendTestEmail } = require('../services/emailService');
// ─────────────────────────────────────────
//  GET all maintenance schedules
//  Access: all logged in users
// ─────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
          ms.id,
          ms.title,
          ms.maintenance_type,
          ms.scheduled_date,
          ms.estimated_duration,
          ms.status,
          ms.completed_at,
          ms.completion_notes,
          ms.created_at,
          e.id            AS equipment_id,
          e.name          AS equipment_name,
          e.location      AS equipment_location,
          u.id            AS technician_id,
          u.full_name     AS technician_name,
          u.phone         AS technician_phone,
          c.full_name     AS created_by_name
       FROM maintenance_schedules ms
       LEFT JOIN equipment e  ON ms.equipment_id = e.id
       LEFT JOIN users     u  ON ms.assigned_to   = u.id
       LEFT JOIN users     c  ON ms.created_by    = c.id
       ORDER BY ms.scheduled_date ASC`
    );
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────
//  GET overdue tasks
//  Access: all logged in users
// ─────────────────────────────────────────
router.get('/overdue', protect, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
          ms.id,
          ms.title,
          ms.scheduled_date,
          ms.status,
          CURRENT_DATE - ms.scheduled_date AS days_overdue,
          e.name      AS equipment_name,
          e.location  AS equipment_location,
          u.full_name AS technician_name,
          u.phone     AS technician_phone,
          u.email     AS technician_email
       FROM maintenance_schedules ms
       LEFT JOIN equipment e ON ms.equipment_id = e.id
       LEFT JOIN users     u ON ms.assigned_to   = u.id
       WHERE ms.status = 'overdue'
       ORDER BY ms.scheduled_date ASC`
    );
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────
//  GET upcoming tasks — due in next 7 days
//  Access: all logged in users
// ─────────────────────────────────────────
router.get('/upcoming', protect, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
          ms.id,
          ms.title,
          ms.scheduled_date,
          ms.status,
          ms.scheduled_date - CURRENT_DATE AS days_until_due,
          e.name      AS equipment_name,
          e.location  AS equipment_location,
          u.full_name AS technician_name,
          u.phone     AS technician_phone,
          u.email     AS technician_email
       FROM maintenance_schedules ms
       LEFT JOIN equipment e ON ms.equipment_id = e.id
       LEFT JOIN users     u ON ms.assigned_to   = u.id
       WHERE ms.status = 'scheduled'
         AND ms.scheduled_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
       ORDER BY ms.scheduled_date ASC`
    );
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────
//  GET dashboard summary counts
//  Access: all logged in users
// ─────────────────────────────────────────
router.get('/summary', protect, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
          COUNT(*)                                          AS total,
          COUNT(*) FILTER (WHERE status = 'scheduled')    AS scheduled,
          COUNT(*) FILTER (WHERE status = 'in_progress')  AS in_progress,
          COUNT(*) FILTER (WHERE status = 'completed')    AS completed,
          COUNT(*) FILTER (WHERE status = 'overdue')      AS overdue,
          COUNT(*) FILTER (
            WHERE status = 'completed'
            AND completed_at >= DATE_TRUNC('month', CURRENT_DATE)
          )                                               AS completed_this_month
       FROM maintenance_schedules`
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────
//  GET single schedule by ID
//  Access: all logged in users
// ─────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const schedule = await pool.query(
      `SELECT
          ms.*,
          e.name          AS equipment_name,
          e.location      AS equipment_location,
          e.model         AS equipment_model,
          u.full_name     AS technician_name,
          u.phone         AS technician_phone,
          u.email         AS technician_email,
          c.full_name     AS created_by_name
       FROM maintenance_schedules ms
       LEFT JOIN equipment e ON ms.equipment_id = e.id
       LEFT JOIN users     u ON ms.assigned_to   = u.id
       LEFT JOIN users     c ON ms.created_by    = c.id
       WHERE ms.id = $1`,
      [req.params.id]
    );

    if (schedule.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Schedule not found.' });
    }

    // Also fetch the status change history for this task
    const logs = await pool.query(
      `SELECT
          sl.*,
          u.full_name AS changed_by_name
       FROM maintenance_status_logs sl
       LEFT JOIN users u ON sl.changed_by = u.id
       WHERE sl.schedule_id = $1
       ORDER BY sl.changed_at ASC`,
      [req.params.id]
    );

    res.json({
      success: true,
      data:    schedule.rows[0],
      history: logs.rows
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────
//  POST create a new maintenance schedule
//  Access: admin only
// ─────────────────────────────────────────
router.post('/', protect, restrictTo('admin'), async (req, res) => {
  const {
    equipment_id,
    assigned_to,
    maintenance_type,
    title,
    description,
    scheduled_date,
    estimated_duration
  } = req.body;

  // Validate required fields
  if (!equipment_id || !maintenance_type || !title || !scheduled_date) {
    return res.status(400).json({
      success: false,
      message: 'Please provide equipment_id, maintenance_type, title, and scheduled_date.'
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO maintenance_schedules
         (equipment_id, assigned_to, created_by, maintenance_type, title, description, scheduled_date, estimated_duration)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        equipment_id,
        assigned_to,
        req.user.id,
        maintenance_type,
        title,
        description,
        scheduled_date,
        estimated_duration
      ]
    );

    // Log the initial status in the status history
    await pool.query(
      `INSERT INTO maintenance_status_logs (schedule_id, changed_by, old_status, new_status, remarks)
       VALUES ($1,$2,NULL,'scheduled','Task created and scheduled.')`,
      [result.rows[0].id, req.user.id]
    );

    res.status(201).json({
      success: true,
      message: 'Maintenance task created successfully.',
      data:    result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────
//  PATCH update task status
//  Access: technicians update their own tasks,
//          admins can update any task
// ─────────────────────────────────────────
router.patch('/:id/status', protect, async (req, res) => {
  const { status, completion_notes } = req.body;
  const validStatuses = ['in_progress', 'completed'];

  // Only in_progress and completed are allowed here
  // overdue is set automatically by the cron job only
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'You can only set status to in_progress or completed.'
    });
  }

  try {
    // Fetch the current task
    const current = await pool.query(
      'SELECT * FROM maintenance_schedules WHERE id = $1',
      [req.params.id]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Schedule not found.' });
    }

    const task = current.rows[0];

    // Technicians can only update tasks assigned to them
    if (req.user.role === 'technician' && task.assigned_to !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update tasks assigned to you.'
      });
    }

    const oldStatus = task.status;
    const completedAt = status === 'completed' ? new Date() : null;

    // Update the task status
    const updated = await pool.query(
      `UPDATE maintenance_schedules
       SET status           = $1,
           completion_notes = $2,
           completed_at     = $3
       WHERE id = $4
       RETURNING *`,
      [status, completion_notes || null, completedAt, req.params.id]
    );

    // Log the status change
    await pool.query(
      `INSERT INTO maintenance_status_logs (schedule_id, changed_by, old_status, new_status, remarks)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.params.id, req.user.id, oldStatus, status, completion_notes || null]
    );

    res.json({
      success: true,
      message: `Task status updated to ${status} successfully.`,
      data:    updated.rows[0]
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────
//  DELETE a schedule
//  Access: admin only
// ─────────────────────────────────────────
router.delete('/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM maintenance_schedules WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Schedule not found.' });
    }
    res.json({ success: true, message: 'Maintenance task deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// POST manually trigger the scheduler — admin only, for testing
router.post('/run-scheduler', protect, restrictTo('admin'), async (req, res) => {
  try {
    await runSchedulerNow();
    res.json({
      success: true,
      message: 'Scheduler ran successfully. Check your terminal and alert_logs table for results.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// POST send a test email — admin only
router.post('/test-email', protect, restrictTo('admin'), async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Please provide an email address.' });
  }
  const result = await sendTestEmail(email);
  if (result.success) {
    res.json({ success: true, message: `Test email sent successfully to ${email}.`, messageId: result.messageId });
  } else {
    res.status(500).json({ success: false, message: result.error });
  }
});
module.exports = router;