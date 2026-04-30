import nodemailer from 'nodemailer';

let cached;

// Single shared SMTP transporter — Gmail with an App Password (16-char,
// space-separated). Fails fast at startup if creds are missing.
const getTransporter = () => {
  if (cached) return cached;

  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASS?.replace(/\s+/g, '');

  if (!user || !pass) {
    throw new Error('EMAIL_USER / EMAIL_PASS missing in .env');
  }

  cached = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  return cached;
};

export const sendMail = async ({ to, subject, html, text }) => {
  const transporter = getTransporter();
  return transporter.sendMail({
    from: `"MOSPI" <${process.env.EMAIL_USER.trim()}>`,
    to,
    subject,
    text,
    html,
  });
};

export const passwordResetEmail = ({ name, resetUrl, expiresMinutes }) => {
  const safeName = name || 'User';
  const subject = 'Reset your MOSPI password';
  const text = [
    `Hello ${safeName},`,
    '',
    'We received a request to reset your MOSPI account password.',
    `Open this link to set a new password (valid for ${expiresMinutes} minutes, single-use):`,
    resetUrl,
    '',
    'If you did not request this, you can safely ignore this email.',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;padding:24px;color:#222">
      <h2 style="margin:0 0 16px">Reset your MOSPI password</h2>
      <p>Hello ${safeName},</p>
      <p>We received a request to reset your MOSPI account password. Click the button below to set a new password.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}"
           style="background:#1a56db;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block">
          Reset Password
        </a>
      </p>
      <p style="font-size:13px;color:#555">
        This link is valid for <strong>${expiresMinutes} minutes</strong> and can be used <strong>only once</strong>.
      </p>
      <p style="font-size:13px;color:#555">
        If the button doesn't work, copy this URL into your browser:<br/>
        <span style="word-break:break-all">${resetUrl}</span>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
      <p style="font-size:12px;color:#888">
        If you did not request this, you can safely ignore this email — your password will not change.
      </p>
    </div>
  `;

  return { subject, text, html };
};
