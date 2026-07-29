const express = require('express');
const router = express.Router({ mergeParams: true });
const supabase = require('../db/supabase');
const { requireAuth, attachOwnCandidateId } = require('../middleware/auth');
const { hasOwn, pickAllowedFields } = require('../lib/requestSecurity');

const CANDIDATE_ONBOARDING_WRITABLE_FIELDS = ['formalization_data'];
const COORDINATOR_ONBOARDING_WRITABLE_FIELDS = ['practical_date', 'scheduling', 'formalization_data'];

function canAccessCandidate(req, candidateId) {
  return req.user.role === 'coordinator' || req.ownCandidateId === candidateId;
}

router.get('/', requireAuth, attachOwnCandidateId, async (req, res) => {
  const { id } = req.params;
  if (!canAccessCandidate(req, id)) {
    return res.status(403).json({ error: 'Proibido' });
  }
  const { data, error } = await supabase
    .from('onboarding').select('*').eq('candidate_id', id).single();
  if (error) return res.status(404).json({ error: 'Não encontrado' });
  res.json(data);
});

router.patch('/progress/:moduleId', requireAuth, attachOwnCandidateId, async (req, res) => {
  const { id, moduleId } = req.params;
  if (!canAccessCandidate(req, id)) {
    return res.status(403).json({ error: 'Proibido' });
  }
  const parsedModuleId = Number(moduleId);
  if (!Number.isInteger(parsedModuleId) || parsedModuleId < 1 || parsedModuleId > 6) {
    return res.status(400).json({ error: 'moduleId inválido' });
  }
  if (!hasOwn(req.body, 'completed') || typeof req.body.completed !== 'boolean') {
    return res.status(400).json({ error: 'completed tem de ser booleano' });
  }
  const { completed } = req.body;
  const completed_at = completed ? new Date() : null;

  const { data, error } = await supabase
    .from('onboarding_progress')
    .upsert({ candidate_id: id, module_id: parsedModuleId, completed, completed_at })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.patch('/', requireAuth, attachOwnCandidateId, async (req, res) => {
  const { id } = req.params;
  if (!canAccessCandidate(req, id)) {
    return res.status(403).json({ error: 'Proibido' });
  }
  const allowedFields = req.user.role === 'coordinator'
    ? COORDINATOR_ONBOARDING_WRITABLE_FIELDS
    : CANDIDATE_ONBOARDING_WRITABLE_FIELDS;
  const forbiddenFields = Object.keys(req.body || {}).filter((field) => (
    field !== 'candidate_id' && !allowedFields.includes(field)
  ));
  if (forbiddenFields.length) {
    return res.status(400).json({
      error: 'O pedido contém campos que este perfil não pode alterar',
      fields: forbiddenFields,
    });
  }
  const updates = pickAllowedFields(req.body, allowedFields);
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Nenhum campo permitido para atualizar' });
  }
  const { data, error } = await supabase
    .from('onboarding')
    .upsert({ ...updates, candidate_id: id, updated_at: new Date() })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
