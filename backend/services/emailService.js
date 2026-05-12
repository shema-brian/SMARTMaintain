const Brevo = require('@getbrevo/brevo');
require('dotenv').config();

// ─────────────────────────────────────────
//  Brevo HTTP API client
// ─────────────────────────────────────────
const apiInstance = new Brevo.TransactionalEmailsApi();
apiInstance.authentications['apiKey'].apiKey = process.env.BREVO_API_KEY;

console.log('[EmailService] Ready to send emails.');

// ─────────────────────────────────────────
//  HELPER: Build the HTML email template
// ─────────────────────────────────────────
const buildEmailTemplate = (type, data) => {
  const colors = {
    reminder:   { header: '#1D9E75', label: 'REMINDER'   },
    urgent:     { header: '#BA7517', label: 'URGENT'      },
    overdue:    { header: '#A32D2D', label: 'OVERDUE'     },
    escalation: { header: '#533AB7', label: 'ESCALATION'  },
  };

  const theme = colors[type] || colors.reminder;

  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
      <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:${theme.header};padding:28px 32px;">
              <p style="margin:0;color:#ffffff;font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">
                Masaka Farms — SMARTMaintain
              </p>
              <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:600;">
                Maintenance Alert
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 24px;color:#444;font-size:15px;line-height:1.6;">
                Dear <strong>${data.recipientName}</strong>,
              </p>
              <p style="margin:0 0 24px;color:#444;font-size:15px;line-height:1.6;">
                ${data.introText}
              </p>
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f8f8f8;border-radius:6px;border:1px solid #e8e8e8;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:11px;color:#888;text-transform:uppercase;">Task</p>
                    <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#222;">${data.taskTitle}</p>
                    <p style="margin:0 0 4px;font-size:11px;color:#888;text-transform:uppercase;">Equipment</p>
                    <p style="margin:0 0 16px;font-size:14px;color:#333;">${data.equipmentName}</p>
                    <p style="margin:0 0 4px;font-size:11px;color:#888;text-transform:uppercase;">Scheduled Date</p>
                    <p style="margin:0;font-size:14px;color:#333;">${data.scheduledDate}</p>
                    ${data.daysOverdue ? `
                    <p style="margin:12px 0 4px;font-size:11px;color:#888;text-transform:uppercase;">Days Overdue</p>
                    <p style="margin:0;font-size:14px;font-weight:600;color:#A32D2D;">${data.daysOverdue} day(s)</p>` : ''}
                    ${data.technicianName ? `
                    <p style="margin:12px 0 4px;font-size:11px;color:#888;text-transform:uppercase;">Technician</p>
                    <p style="margin:0;font-size:14px;color:#333;">${data.technicianName}</p>` : ''}
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#444;font-size:15px;line-height:1.6;">${data.actionText}</p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8f8f8;padding:20px 32px;border-top:1px solid #eeeeee;">
              <p style="margin:0;font-size:12px;color:#999;">
                This is an automated message from SMARTMaintain, Masaka Farms, Kigali Rwanda.
              </p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>`;
};

// ─────────────────────────────────────────
//  HELPER: Send email via Brevo API
// ─────────────────────────────────────────
const sendEmail = async (to, subject, htmlContent, senderName = 'SMARTMaintain — Masaka Farms') => {
  try {
    const sendSmtpEmail = new Brevo.SendSmtpEmail();
    sendSmtpEmail.subject  = subject;
    sendSmtpEmail.htmlContent = htmlContent;
    sendSmtpEmail.sender   = { name: senderName, email: process.env.EMAIL_USER };
    sendSmtpEmail.to       = [{ email: to }];

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`[EmailService] Email sent to ${to} — MessageId: ${result.body.messageId}`);
    return true;
  } catch (err) {
    console.error(`[EmailService] Failed to send to ${to}:`, err.message);
    return false;
  }
};

// ─────────────────────────────────────────
//  SEND: Reminder email
// ─────────────────────────────────────────
const sendReminderEmail = async (recipientEmail, data) => {
  const daysText = data.daysUntilDue === 1 ? 'tomorrow' : `in ${data.daysUntilDue} days`;
  const html = buildEmailTemplate(data.daysUntilDue <= 1 ? 'urgent' : 'reminder', {
    recipientName: data.recipientName,
    taskTitle:     data.taskTitle,
    equipmentName: data.equipmentName,
    scheduledDate: data.scheduledDate,
    introText:     `This is a reminder that the following maintenance task is scheduled ${daysText}.`,
    actionText:    `Please log in to SMARTMaintain to view full details and update the status once work begins.`,
  });
  return sendEmail(recipientEmail, `Maintenance Reminder: ${data.taskTitle} — due ${daysText}`, html);
};

// ─────────────────────────────────────────
//  SEND: Overdue email
// ─────────────────────────────────────────
const sendOverdueEmail = async (recipientEmail, data) => {
  const html = buildEmailTemplate('overdue', {
    recipientName: data.recipientName,
    taskTitle:     data.taskTitle,
    equipmentName: data.equipmentName,
    scheduledDate: data.scheduledDate,
    daysOverdue:   data.daysOverdue,
    introText:     `The following maintenance task is now overdue and has not been completed.`,
    actionText:    `Please complete this task as soon as possible and update its status in SMARTMaintain.`,
  });
  return sendEmail(recipientEmail, `OVERDUE: ${data.taskTitle} — immediate action required`, html);
};

// ─────────────────────────────────────────
//  SEND: Escalation email
// ─────────────────────────────────────────
const sendEscalationEmail = async (recipientEmail, data) => {
  const html = buildEmailTemplate('escalation', {
    recipientName:  data.recipientName,
    taskTitle:      data.taskTitle,
    equipmentName:  data.equipmentName,
    scheduledDate:  data.scheduledDate,
    daysOverdue:    data.daysOverdue,
    technicianName: data.technicianName,
    introText:      `This is an escalation alert. The following task has been overdue for ${data.daysOverdue} day(s) and requires your immediate attention.`,
    actionText:     `Please follow up with the assigned technician urgently to maintain HACCP compliance at Masaka Farms.`,
  });
  return sendEmail(recipientEmail, `ESCALATION: ${data.taskTitle} is ${data.daysOverdue} day(s) overdue`, html);
};

// ─────────────────────────────────────────
//  SEND: Test email
// ─────────────────────────────────────────
const sendTestEmail = async (recipientEmail) => {
  const html = buildEmailTemplate('reminder', {
    recipientName: 'System Administrator',
    taskTitle:     'Email Service Verification Test',
    equipmentName: 'Test Equipment',
    scheduledDate: new Date().toDateString(),
    introText:     'This is a test email confirming that SMARTMaintain email notifications are working correctly.',
    actionText:    'No action required. Your email service is working.',
  });
  const result = await sendEmail(recipientEmail, 'SMARTMaintain — Email Service Test', html);
  return result
    ? { success: true,  message: 'Test email sent successfully.' }
    : { success: false, message: 'Failed to send test email.' };
};

module.exports = {
  sendReminderEmail,
  sendOverdueEmail,
  sendEscalationEmail,
  sendTestEmail,
};