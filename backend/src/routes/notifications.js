const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator, attachOwnCandidateId } = require('../middleware/auth');
const { cleanRequiredText, referencesAnotherCandidate } = require('../lib/requestSecurity');

const CANDIDATE_NOTIFICATION_STAGES = {
  qualificado: new Set(['inscricao', 'triagem']),
  espera: new Set(['triagem', 'espera']),
  entrevista: new Set(['entrevista', 'validacao']),
  contacto: null,
  agendado: new Set(['onboarding', 'pratica']),
  concluido: new Set(['onboarding', 'pratica']),
  ativo: new Set(['formalizacao', 'ativo']),
};

const CANDIDATE_NOTIFICATION_TEXT = {
  qualificado: 'concluiu a triagem e reúne condições para avançar',
  espera: 'ficou em lista de espera',
  entrevista: 'concluiu o questionário e aguarda validação',
  contacto: 'enviou uma dúvida à coordenação',
  agendado: 'atualizou a sua preferência para a formação prática',
  concluido: 'concluiu o onboarding e aguarda a formação prática',
  ativo: 'assinou o termo de compromisso e tornou-se piloto ativo',
};

const COORDINATOR_NOTIFICATION_STAGES = {
  agendado: null,
  concluido: new Set(['pratica', 'formalizacao']),
  rejeitado: new Set(['inscricao', 'apresentacao', 'triagem', 'entrevista', 'validacao', 'espera', 'onboarding', 'pratica', 'rejeitado']),
  validado: new Set(['validacao', 'onboarding']),
  retomado: new Set(['espera', 'validacao']),
  espera: new Set(['validacao', 'espera']),
};

function notificationTypeAllowed(role, type, stage) {
  const rules = role === 'coordinator'
    ? COORDINATOR_NOTIFICATION_STAGES
    : CANDIDATE_NOTIFICATION_STAGES;
  if (!Object.hasOwn(rules, type)) return false;
  return rules[type] === null || rules[type].has(stage);
}

// GET /api/notifications — feed da coordenação (só coordenadores)
router.get('/', requireAuth, requireCoordinator, async (req, res) => {
  const { data, error } = await supabase
    .from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/notifications — candidato ou coordenador podem gerar eventos do feed.
// candidate_id vem sempre da sessão para candidatos (PED-58) — nunca do corpo
// do pedido, para não deixar um candidato forjar eventos em nome de outro.
router.post('/', requireAuth, attachOwnCandidateId, async (req, res) => {
  const type = cleanRequiredText(req.body.type);
  let text = cleanRequiredText(req.body.text);
  if (!type || !text) return res.status(400).json({ error: 'type e text são obrigatórios' });

  const candidate_id = req.user.role === 'coordinator'
    ? (req.body.candidate_id || null)
    : req.ownCandidateId;
  if (req.user.role !== 'coordinator' && referencesAnotherCandidate(req, candidate_id)) {
    return res.status(403).json({ error: 'Proibido' });
  }
  if (req.user.role !== 'coordinator' && !candidate_id) {
    return res.status(403).json({ error: 'Proibido' });
  }

  // "who" representa o candidato a que o evento diz respeito. É obtido da
  // relação autenticada, não de texto livre controlado pelo cliente.
  let who = req.user.coord_role === 'administracao' ? 'Administração' : 'Coordenação';
  if (candidate_id) {
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates').select('name, stage').eq('id', candidate_id).maybeSingle();
    if (candidateError) return res.status(500).json({ error: candidateError.message });
    if (!candidate) return res.status(404).json({ error: 'Candidato não encontrado' });
    if (!notificationTypeAllowed(req.user.role, type, candidate.stage)) {
      return res.status(403).json({
        error: 'Este tipo de notificação não é permitido para o perfil ou estado atual',
      });
    }
    if (req.user.role !== 'coordinator') text = CANDIDATE_NOTIFICATION_TEXT[type];
    who = candidate.name;
  } else if (!notificationTypeAllowed(req.user.role, type, null)) {
    return res.status(403).json({ error: 'Este tipo de notificação não é permitido para este perfil' });
  }

  const { data, error } = await supabase
    .from('notifications')
    .insert({ type, who, text, candidate_id })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

module.exports = router;
