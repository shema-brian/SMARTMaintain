const nodemailer = require('nodemailer');
require('dotenv').config();

// ─────────────────────────────────────────
//  Create the email transporter
//  using Gmail SMTP
// ─────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   'smtp-relay.brevo.com',
  port:   2525,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ─────────────────────────────────────────
//  Verify transporter on startup
// ─────────────────────────────────────────
transporter.verify((error) => {
  if (error) {
    console.error('[EmailService] Connection failed:', error.message);
  } else {
    console.log('[EmailService] Ready to send emails.');
  }
});

// ─────────────────────────────────────────
//  HELPER: Build the HTML email template
// ─────────────────────────────────────────
const buildEmailTemplate = (type, data) => {
  const colors = {
    reminder:   { header: '#1D9E75', badge: '#E1F5EE', badgeText: '#085041', label: 'REMINDER'   },
    urgent:     { header: '#BA7517', badge: '#FAEEDA', badgeText: '#633806', label: 'URGENT'      },
    overdue:    { header: '#A32D2D', badge: '#FCEBEB', badgeText: '#501313', label: 'OVERDUE'     },
    escalation: { header: '#533AB7', badge: '#EEEDFE', badgeText: '#26215C', label: 'ESCALATION'  },
  };

  const theme = colors[type] || colors.reminder;

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0"
                 style="background:#ffffff;border-radius:8px;overflow:hidden;
                        box-shadow:0 2px 8px rgba(0,0,0,0.08);">

            <!-- Header -->
            <tr>
              <td style="background:${theme.header};padding:28px 32px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <p style="margin:0;color:#ffffff;font-size:11px;
                                 letter-spacing:2px;text-transform:uppercase;
                                 opacity:0.85;">Masaka Farms — SMARTMaintain</p>
                      <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;
                                  font-weight:600;">Maintenance Alert</h1>
                    </td>
                    <td align="right">
                      <span style="display:inline-block;background:rgba(255,255,255,0.2);
                                   color:#ffffff;font-size:11px;font-weight:700;
                                   letter-spacing:1.5px;padding:6px 14px;
                                   border-radius:20px;">
                        ${theme.label}
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px;">

                <p style="margin:0 0 24px;color:#444;font-size:15px;line-height:1.6;">
                  Dear <strong>${data.recipientName}</strong>,
                </p>
                <p style="margin:0 0 24px;color:#444;font-size:15px;line-height:1.6;">
                  ${data.introText}
                </p>

                <!-- Task Details Card -->
                <table width="100%" cellpadding="0" cellspacing="0"
                       style="background:#f8f8f8;border-radius:6px;
                              border:1px solid #e8e8e8;margin-bottom:24px;">
                  <tr>
                    <td style="padding:20px 24px;">
                      <p style="margin:0 0 4px;font-size:11px;color:#888;
                                 text-transform:uppercase;letter-spacing:1px;">
                        Task Title
                      </p>
                      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#222;">
                        ${data.taskTitle}
                      </p>

                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td width="50%" style="padding-bottom:12px;">
                            <p style="margin:0 0 2px;font-size:11px;color:#888;
                                       text-transform:uppercase;letter-spacing:1px;">
                              Equipment
                            </p>
                            <p style="margin:0;font-size:14px;color:#333;">
                              ${data.equipmentName}
                            </p>
                          </td>
                          <td width="50%" style="padding-bottom:12px;">
                            <p style="margin:0 0 2px;font-size:11px;color:#888;
                                       text-transform:uppercase;letter-spacing:1px;">
                              Location
                            </p>
                            <p style="margin:0;font-size:14px;color:#333;">
                              ${data.equipmentLocation || 'Not specified'}
                            </p>
                          </td>
                        </tr>
                        <tr>
                          <td width="50%">
                            <p style="margin:0 0 2px;font-size:11px;color:#888;
                                       text-transform:uppercase;letter-spacing:1px;">
                              Scheduled Date
                            </p>
                            <p style="margin:0;font-size:14px;color:#333;">
                              ${data.scheduledDate}
                            </p>
                          </td>
                          <td width="50%">
                            <p style="margin:0 0 2px;font-size:11px;color:#888;
                                       text-transform:uppercase;letter-spacing:1px;">
                              Maintenance Type
                            </p>
                            <p style="margin:0;font-size:14px;color:#333;
                                       text-transform:capitalize;">
                              ${data.maintenanceType}
                            </p>
                          </td>
                        </tr>
                        ${data.daysOverdue ? `
                        <tr>
                          <td colspan="2" style="padding-top:12px;">
                            <p style="margin:0 0 2px;font-size:11px;color:#888;
                                       text-transform:uppercase;letter-spacing:1px;">
                              Days Overdue
                            </p>
                            <p style="margin:0;font-size:14px;font-weight:600;color:#A32D2D;">
                              ${data.daysOverdue} day(s) overdue
                            </p>
                          </td>
                        </tr>` : ''}
                        ${data.technicianName ? `
                        <tr>
                          <td colspan="2" style="padding-top:12px;">
                            <p style="margin:0 0 2px;font-size:11px;color:#888;
                                       text-transform:uppercase;letter-spacing:1px;">
                              Assigned Technician
                            </p>
                            <p style="margin:0;font-size:14px;color:#333;">
                              ${data.technicianName}
                            </p>
                          </td>
                        </tr>` : ''}
                      </table>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 8px;color:#444;font-size:15px;line-height:1.6;">
                  ${data.actionText}
                </p>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f8f8f8;padding:20px 32px;
                          border-top:1px solid #eeeeee;">
                <p style="margin:0;font-size:12px;color:#999;line-height:1.6;">
                  This is an automated message from <strong>SMARTMaintain</strong>,
                  the maintenance management system of Masaka Farms,
                  Kigali Special Economic Zone, Rwanda.
                  Please do not reply to this email.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
};

// ─────────────────────────────────────────
//  SEND: Reminder email (7 or 3 days before)
// ─────────────────────────────────────────
const sendReminderEmail = async (recipientEmail, data) => {
  const daysText = data.daysUntilDue === 1
    ? 'tomorrow'
    : `in ${data.daysUntilDue} days`;

  const mailOptions = {
    from:    `"SMARTMaintain — Masaka Farms" <${process.env.EMAIL_USER}>`,
    to:      recipientEmail,
    subject: `Maintenance Reminder: ${data.taskTitle} — due ${daysText}`,
    html:    buildEmailTemplate(data.daysUntilDue <= 1 ? 'urgent' : 'reminder', {
      recipientName:     data.recipientName,
      taskTitle:         data.taskTitle,
      equipmentName:     data.equipmentName,
      equipmentLocation: data.equipmentLocation,
      scheduledDate:     data.scheduledDate,
      maintenanceType:   data.maintenanceType,
      technicianName:    data.technicianName || null,
      introText: `This is a reminder that the following maintenance task is scheduled ${daysText}.
                  Please ensure all necessary preparations are made.`,
      actionText: `Please log in to the SMARTMaintain dashboard to view full task details
                   and update the status once work begins.`,
    }),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Reminder email sent to ${recipientEmail} — ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[EmailService] Failed to send reminder to ${recipientEmail}:`, err.message);
    return false;
  }
};

// ─────────────────────────────────────────
//  SEND: Overdue alert email
// ─────────────────────────────────────────
const sendOverdueEmail = async (recipientEmail, data) => {
  const mailOptions = {
    from:    `"SMARTMaintain — Masaka Farms" <${process.env.EMAIL_USER}>`,
    to:      recipientEmail,
    subject: `OVERDUE: ${data.taskTitle} — immediate action required`,
    html:    buildEmailTemplate('overdue', {
      recipientName:     data.recipientName,
      taskTitle:         data.taskTitle,
      equipmentName:     data.equipmentName,
      equipmentLocation: data.equipmentLocation,
      scheduledDate:     data.scheduledDate,
      maintenanceType:   data.maintenanceType,
      daysOverdue:       data.daysOverdue,
      introText: `The following maintenance task is now overdue and has not been completed.
                  This may affect equipment reliability and compliance with food safety standards.`,
      actionText: `Please complete this task as soon as possible and update its status
                   in the SMARTMaintain dashboard to resolved.`,
    }),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Overdue email sent to ${recipientEmail} — ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[EmailService] Failed to send overdue email to ${recipientEmail}:`, err.message);
    return false;
  }
};

// ─────────────────────────────────────────
//  SEND: Escalation email to managers
// ─────────────────────────────────────────
const sendEscalationEmail = async (recipientEmail, data) => {
  const mailOptions = {
    from:    `"SMARTMaintain — Masaka Farms" <${process.env.EMAIL_USER}>`,
    to:      recipientEmail,
    subject: `ESCALATION: ${data.taskTitle} is ${data.daysOverdue} day(s) overdue`,
    html:    buildEmailTemplate('escalation', {
      recipientName:     data.recipientName,
      taskTitle:         data.taskTitle,
      equipmentName:     data.equipmentName,
      equipmentLocation: data.equipmentLocation,
      scheduledDate:     data.scheduledDate,
      maintenanceType:   data.maintenanceType,
      daysOverdue:       data.daysOverdue,
      technicianName:    data.technicianName,
      introText: `This is an escalation alert. The following maintenance task has been overdue
                  for ${data.daysOverdue} day(s) and requires your immediate attention as a manager.`,
      actionText: `Please follow up with the assigned technician and ensure this task
                   is completed urgently to maintain equipment reliability and
                   HACCP compliance at Masaka Farms.`,
    }),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Escalation email sent to ${recipientEmail} — ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[EmailService] Failed to send escalation email to ${recipientEmail}:`, err.message);
    return false;
  }
};

// ─────────────────────────────────────────
//  SEND: Test email — used to verify setup
// ─────────────────────────────────────────
const sendTestEmail = async (recipientEmail) => {
  const mailOptions = {
    from:    `"SMARTMaintain — Masaka Farms" <${process.env.EMAIL_USER}>`,
    to:      recipientEmail,
    subject: 'SMARTMaintain — Email Service Test',
    html:    buildEmailTemplate('reminder', {
      recipientName:     'System Administrator',
      taskTitle:         'Email Service Verification Test',
      equipmentName:     'Test Equipment',
      equipmentLocation: 'Kigali Special Economic Zone',
      scheduledDate:     new Date().toDateString(),
      maintenanceType:   'test',
      introText:         'This is a test email to confirm that the SMARTMaintain email notification service is configured correctly and working.',
      actionText:        'No action is required. Your email service is working correctly.',
    }),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Test email sent to ${recipientEmail} — ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[EmailService] Test email failed:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = {
  sendReminderEmail,
  sendOverdueEmail,
  sendEscalationEmail,
  sendTestEmail,
};