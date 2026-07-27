const supabase = require('../db/supabase');
const { sendMail } = require('./mailer');

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function formatDatePt(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d)) return iso;
  return `${DIAS[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]}`;
}

function formatSlot(slot) {
  const time = slot.startTime || slot.time || '';
  const range = time && slot.endTime ? `${time}–${slot.endTime}` : time;
  return `${formatDatePt(slot.date)}${range ? ` · ${range}` : ''}`;
}

function wrapEmail(title, bodyHtml) {
  return `
  <div style="background:#F4F4F2; padding:32px 16px; font-family:-apple-system,Segoe UI,Arial,sans-serif;">
    <div style="max-width:480px; margin:0 auto; background:#FFFFFF; border-radius:12px; overflow:hidden; border:1px solid #E5E5E1;">
      <div style="background:#ED1C24; padding:20px 28px;">
        <span style="color:#FFFFFF; font-size:15px; font-weight:700; letter-spacing:0.02em;">PEDALAR SEM IDADE · PEDAL</span>
      </div>
      <div style="padding:28px;">
        <h1 style="margin:0 0 16px; font-size:19px; color:#1A1A1A;">${title}</h1>
        ${bodyHtml}
      </div>
      <div style="padding:16px 28px; background:#FAFAF8; color:#8A8A85; font-size:12px;">
        Pedalar Sem Idade Porto — este email foi enviado automaticamente, não é preciso responder.
      </div>
    </div>
  </div>`;
}

function slotsListHtml(slots) {
  return slots.map((s) => `
    <div style="border:1.5px solid #ED1C24; border-radius:8px; padding:10px 14px; margin-bottom:8px; color:#1A1A1A; font-weight:600; font-size:14px;">
      ${formatSlot(s)}
    </div>`).join('');
}

async function sendProposedEmail(candidate, scheduling) {
  const slots = (scheduling.slots || []).filter((s) => s.state === 'proposto');
  if (!slots.length) return;
  const plural = slots.length > 1;
  const html = wrapEmail('Tens horários novos para a formação prática', `
    <p style="color:#4A4A45; font-size:14px; line-height:1.5;">Olá ${candidate.name || ''}, a coordenação propôs ${plural ? 'estes horários' : 'este horário'} para a tua formação prática:</p>
    ${slotsListHtml(slots)}
    <p style="color:#4A4A45; font-size:14px; line-height:1.5;">Abre a app do PEDAL para escolher${plural ? ' o(s) que te ficam melhor' : ''}.</p>
  `);
  await sendMail({ to: candidate.email, subject: 'Tens horários novos para a formação prática — PEDAL', html });
}

async function sendConfirmedEmail(candidate, scheduling) {
  const slot = (scheduling.slots || []).find((s) => s.state === 'confirmado' || s.state === 'definitivo');
  if (!slot) return;
  let trainerName = null;
  let station = null;
  if (scheduling.trainerId) {
    const { data } = await supabase.from('trainers').select('name').eq('id', scheduling.trainerId).maybeSingle();
    trainerName = data ? data.name : null;
  }
  if (scheduling.stationId) {
    const { data } = await supabase.from('stations').select('name, address').eq('id', scheduling.stationId).maybeSingle();
    station = data || null;
  }
  const html = wrapEmail('O teu horário ficou confirmado', `
    <p style="color:#4A4A45; font-size:14px; line-height:1.5;">Olá ${candidate.name || ''}, a tua formação prática está confirmada:</p>
    ${slotsListHtml([slot])}
    <div style="color:#4A4A45; font-size:14px; line-height:1.7;">
      ${trainerName ? `<div><strong style="color:#1A1A1A;">Formador:</strong> ${trainerName}</div>` : ''}
      ${station ? `<div><strong style="color:#1A1A1A;">Local:</strong> ${station.name}${station.address ? ` — ${station.address}` : ''}</div>` : ''}
    </div>
    <p style="color:#4A4A45; font-size:14px; line-height:1.5; margin-top:16px;">Abre a app do PEDAL para ver todos os detalhes.</p>
  `);
  await sendMail({ to: candidate.email, subject: 'O teu horário ficou confirmado — PEDAL', html });
}

// Chamado depois de um PATCH da coordenação a /api/candidates/:id com scheduling.
// Nunca lança — um erro aqui não pode rebentar a resposta do pedido principal.
async function notifyScheduleChange(candidate, scheduling) {
  if (!candidate || !candidate.email || !scheduling) return;
  try {
    if (scheduling.status === 'aguarda_candidato') await sendProposedEmail(candidate, scheduling);
    else if (scheduling.status === 'confirmado') await sendConfirmedEmail(candidate, scheduling);
  } catch (err) {
    console.error('[scheduleEmails] erro ao preparar email de agendamento:', err.message);
  }
}

module.exports = { notifyScheduleChange };
