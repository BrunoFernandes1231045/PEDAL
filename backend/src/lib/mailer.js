const nodemailer = require('nodemailer');

// Emails genéricos da aplicação (ex.: avisos de agendamento) — separado das
// definições de SMTP do painel do Supabase, que só cobrem os emails de Auth
// dele (signup, recuperação de password). Mesmo princípio de kill-switch das
// outras features: desligado por defeito, liga-se com SCHEDULE_EMAILS_ENABLED.
const ENABLED = process.env.SCHEDULE_EMAILS_ENABLED === 'true';

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

// Nunca deve rebentar quem a chama — um email que falha não pode impedir a
// ação da coordenação (ex.: confirmar um horário).
async function sendMail({ to, subject, html }) {
  if (!ENABLED) return { ok: false, reason: 'disabled' };
  if (!to) return { ok: false, reason: 'no-recipient' };
  const t = getTransporter();
  if (!t) return { ok: false, reason: 'not-configured' };
  const fromName = process.env.SMTP_FROM_NAME || 'PEDAL';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
  try {
    await t.sendMail({ from: `"${fromName}" <${fromEmail}>`, to, subject, html });
    return { ok: true };
  } catch (err) {
    console.error('[mailer] erro ao enviar email:', err.message);
    return { ok: false, reason: 'send-error' };
  }
}

module.exports = { sendMail };
