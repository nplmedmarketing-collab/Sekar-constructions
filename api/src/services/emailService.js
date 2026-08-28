const config = require('../config');

/**
 * Optional email dispatch service for new customer inquiries.
 * If SMTP environment variables are configured in .env and nodemailer is present,
 * sends instant email alerts.
 * If unconfigured or nodemailer is missing, logs softly without breaking inquiry creation.
 */
function getTransporter() {
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch {
    return null;
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

async function sendInquiryNotification(inquiry) {
  const recipient = process.env.NOTIFICATION_EMAIL || 'ho@sekarconstructions.com';
  const transporter = getTransporter();

  if (!transporter) {
    console.log(`[emailService] SMTP/Nodemailer inactive — inquiry ${inquiry.id} stored in database.`);
    return { sent: false, reason: 'SMTP not configured' };
  }

  const subject = `[New Inquiry ${inquiry.id}] ${inquiry.subject}`;
  const text = `
New tender/contact inquiry received on Sekar Constructions website:

Inquiry ID: ${inquiry.id}
Name:       ${inquiry.name}
Company:    ${inquiry.company || 'N/A'}
Email:      ${inquiry.email}
Phone:      ${inquiry.phone || 'N/A'}
Subject:    ${inquiry.subject}
Estimated Value: ${inquiry.value || 'N/A'}

Message:
${inquiry.message}

---
Log in to Sekar Construction Super Admin to manage inquiries.
`.trim();

  try {
    await transporter.sendMail({
      from: `"Sekar Constructions CMS" <${process.env.SMTP_USER}>`,
      to: recipient,
      subject,
      text,
    });
    console.log(`[emailService] Instant notification sent for inquiry ${inquiry.id} to ${recipient}`);
    return { sent: true };
  } catch (err) {
    console.error(`[emailService] Failed to send email alert for inquiry ${inquiry.id}:`, err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = {
  sendInquiryNotification,
};
