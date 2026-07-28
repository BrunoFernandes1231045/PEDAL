const { sendMail } = require('./mailer');

const STAGE_LABEL = {
  onboarding: 'formação',
  formalizacao: 'formalização',
  pratica: 'formação prática',
};

function buildHtml(name, days, stageLabel) {
  return `
  <div style="background:#F4F4F2; padding:32px 16px; font-family:-apple-system,Segoe UI,Arial,sans-serif;">
    <div style="max-width:480px; margin:0 auto; background:#FFFFFF; border-radius:12px; overflow:hidden; border:1px solid #E5E5E1;">
      <div style="background:#ED1C24; padding:20px 28px;">
        <span style="color:#FFFFFF; font-size:15px; font-weight:700; letter-spacing:0.02em;">PEDALAR SEM IDADE · PEDAL</span>
      </div>
      <div style="padding:28px;">
        <h1 style="margin:0 0 16px; font-size:19px; color:#1A1A1A;">Continuas interessado(a)?</h1>
        <p style="color:#4A4A45; font-size:14px; line-height:1.5;">Olá ${name || ''}, reparámos que estás há cerca de ${days} dias na fase de ${stageLabel} e ainda não avançaste.</p>
        <p style="color:#4A4A45; font-size:14px; line-height:1.5;">Continuas interessado(a) em seguir para te tornares piloto voluntário? Se sim, abre a app do PEDAL e continua onde ficaste. Se já não fizer sentido para ti, não faz mal — não precisas de fazer nada.</p>
      </div>
      <div style="padding:16px 28px; background:#FAFAF8; color:#8A8A85; font-size:12px;">
        Pedalar Sem Idade Porto — este email foi enviado automaticamente, não é preciso responder.
      </div>
    </div>
  </div>`;
}

async function sendStageReminder({ name, email }, stage, days) {
  if (!email) return;
  const stageLabel = STAGE_LABEL[stage] || stage;
  await sendMail({
    to: email,
    subject: 'Continuas interessado(a)? — PEDAL',
    html: buildHtml(name, days, stageLabel),
  });
}

module.exports = { sendStageReminder };
