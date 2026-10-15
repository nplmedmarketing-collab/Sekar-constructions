const config = require('../config');

/**
 * Optional email dispatch for inquiries and careers applications.
 * Requires SMTP_HOST, SMTP_USER, SMTP_PASS (and nodemailer). Soft-fails when unset.
 */

function getSmtpEnv() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const missing = [];
  if (!host) missing.push('SMTP_HOST');
  if (!user) missing.push('SMTP_USER');
  if (!pass) missing.push('SMTP_PASS');
  return { host, user, pass, port, secure, missing, configured: missing.length === 0 };
}

/** One-line status for startup logs (never includes password). */
function getSmtpStartupStatus() {
  const env = getSmtpEnv();
  if (!env.configured) {
    return `inactive — fill ${env.missing.join(', ')} in api/.env to enable inquiry + careers emails`;
  }
  return `ready (host=${env.host}, port=${env.port}, user=${env.user})`;
}

function getTransporter() {
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch {
    console.warn('[emailService] nodemailer package missing — run npm install in api/. Emails disabled.');
    return null;
  }

  const env = getSmtpEnv();
  if (!env.configured) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.host,
    port: env.port,
    secure: env.secure,
    auth: { user: env.user, pass: env.pass },
  });
}

function warnSmtpMissing(context) {
  const env = getSmtpEnv();
  console.warn(
    `[emailService] SMTP not configured — ${context} skipped. ` +
      `Missing: ${env.missing.join(', ') || 'unknown'}. ` +
      'Set SMTP_HOST, SMTP_USER, and SMTP_PASS in api/.env (see api/.env.example).'
  );
}

/** Strip CR/LF from header fields to prevent SMTP header injection. */
function sanitizeHeader(value, maxLen = 200) {
  return String(value == null ? '' : value)
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/** Stricter than soft UI checks — reject injection / obvious junk before thank-you relay. */
function isStrictEmail(email) {
  const to = String(email || '').trim();
  if (!to || to.length > 254) return false;
  if (/[\r\n]/.test(to)) return false;
  // Practical RFC5322-ish local@domain with a real TLD
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(
    to
  );
}

async function sendInquiryNotification(inquiry) {
  const recipient = process.env.NOTIFICATION_EMAIL || 'ho@sekarconstructions.com';
  const transporter = getTransporter();

  if (!transporter) {
    warnSmtpMissing(`inquiry alert for ${inquiry.id}`);
    console.log(`[emailService] Inquiry ${inquiry.id} stored in database (email not sent).`);
    return { sent: false, reason: 'SMTP not configured' };
  }

  const inquiryId = sanitizeHeader(inquiry.id, 64);
  // Fixed subject template — user subject lives in body only.
  const subject = sanitizeHeader(`[New Inquiry ${inquiryId}] Website contact form`);
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

/**
 * Thank-you email to a careers applicant after a successful HRPops apply.
 * Soft-fails when SMTP is unset or send fails — never blocks the apply response.
 */
async function sendApplicationThankYou({ email, candidateName, jobTitle } = {}) {
  const to = String(email || '').trim();
  if (!isStrictEmail(to)) {
    console.warn('[emailService] Careers thank-you skipped — missing or invalid candidate email.');
    return { sent: false, reason: 'invalid email' };
  }

  const transporter = getTransporter();
  if (!transporter) {
    warnSmtpMissing(`careers thank-you to ${to}`);
    return { sent: false, reason: 'SMTP not configured' };
  }

  const name = sanitizeHeader(candidateName || '', 120) || 'Candidate';
  const role = sanitizeHeader(jobTitle || '', 120);
  const roleLine = role
    ? `Thank you for applying for the ${role} position at Sekar Constructions.`
    : 'Thank you for applying to Sekar Constructions.';

  // Fixed subject — role details stay in body to avoid header injection.
  const subject = 'Thank you for applying | Sekar Constructions';

  const text = `
Dear ${name},

${roleLine}

We have received your application. Our HR team will review it carefully and will be in touch if your profile matches our requirements.

We appreciate your interest in building with Sekar Constructions.

Warm regards,
HR Team
Sekar Constructions
https://www.sekarconstructions.com/
`.trim();

  try {
    await transporter.sendMail({
      from: `"Sekar Constructions" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
    });
    console.log(`[emailService] Careers thank-you sent to ${to}`);
    return { sent: true };
  } catch (err) {
    console.warn(`[emailService] Careers thank-you failed for ${to}:`, err.message);
    return { sent: false, error: err.message };
  }
}

/**
 * HR alert for a new careers application (same NOTIFICATION_EMAIL as inquiries).
 * Soft-fails when SMTP / recipient unset — never blocks the apply response.
 */
async function sendApplicationHrNotification({ email, candidateName, jobTitle } = {}) {
  const recipient = String(process.env.NOTIFICATION_EMAIL || '').trim();
  if (!recipient) {
    console.warn(
      '[emailService] NOTIFICATION_EMAIL unset — HR careers alert skipped. Set it in api/.env.'
    );
    return { sent: false, reason: 'NOTIFICATION_EMAIL not set' };
  }

  const transporter = getTransporter();
  if (!transporter) {
    warnSmtpMissing(`HR careers alert to ${recipient}`);
    return { sent: false, reason: 'SMTP not configured' };
  }

  const name = sanitizeHeader(candidateName || '', 120) || 'Unknown';
  const candidateEmail = sanitizeHeader(email || '', 254) || 'N/A';
  const role = sanitizeHeader(jobTitle || '', 120) || 'N/A';

  const subject = sanitizeHeader(`[New Careers Application] ${role} — ${name}`);
  const text = `
A new job application was submitted on the Sekar Constructions careers page:

Candidate:  ${name}
Email:      ${candidateEmail}
Position:   ${role}

The application was forwarded to HRPops. Review the candidate in your HRPops dashboard.
`.trim();

  try {
    await transporter.sendMail({
      from: `"Sekar Constructions Careers" <${process.env.SMTP_USER}>`,
      to: recipient,
      subject,
      text,
    });
    console.log(`[emailService] HR careers alert sent to ${recipient}`);
    return { sent: true };
  } catch (err) {
    console.warn(`[emailService] HR careers alert failed for ${recipient}:`, err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = {
  sendInquiryNotification,
  sendApplicationThankYou,
  sendApplicationHrNotification,
  getSmtpStartupStatus,
  isStrictEmail,
  sanitizeHeader,
};
