const cron = require('node-cron');
const supabase = require('../db/supabase');
const { sendStageReminder } = require('./stageReminderEmails');

const ENABLED = process.env.STAGE_REMINDER_EMAILS_ENABLED === 'true';
const STAGES = ['onboarding', 'formalizacao', 'pratica'];
const DAYS_THRESHOLD = 21;

async function checkStuckCandidates() {
  const cutoff = new Date(Date.now() - DAYS_THRESHOLD * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('candidates')
    .select('id, name, email, stage')
    .in('stage', STAGES)
    .is('stage_reminder_sent_at', null)
    .lte('stage_since', cutoff);
  if (error) { console.error('[stageReminderJob] erro ao procurar candidatos:', error.message); return; }
  for (const c of data || []) {
    try {
      await sendStageReminder({ name: c.name, email: c.email }, c.stage, DAYS_THRESHOLD);
      await supabase.from('candidates').update({ stage_reminder_sent_at: new Date() }).eq('id', c.id);
    } catch (err) {
      console.error(`[stageReminderJob] erro ao avisar candidato ${c.id}:`, err.message);
    }
  }
}

// Corre uma vez por dia, às 09:00 — não precisa de mais precisão que isto.
function start() {
  if (!ENABLED) return;
  cron.schedule('0 9 * * *', checkStuckCandidates);
}

module.exports = { start, checkStuckCandidates };
