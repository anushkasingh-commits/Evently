const nodemailer = require('nodemailer');

let transporter = null;

// Email is optional. Without SMTP settings, emails are simply not sent.
function getTransporter() {
  if (transporter) {
    return transporter;
  }
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  return transporter;
}

// Sends a booking update email. Returns false if email is not configured.
async function sendBookingUpdate(to, name, subject, text) {
  const mailer = getTransporter();
  if (!mailer) {
    return false;
  }

  await mailer.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html: `<div style="font-family:Arial,sans-serif;max-width:620px">
  <h2>✦ evently</h2>
  <p>Hi ${name},</p>
  <p>${text}</p>
  <p>Open your Evently dashboard to see the latest booking status.</p>
</div>`
  });
  return true;
}

module.exports = { sendBookingUpdate };
