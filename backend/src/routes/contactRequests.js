const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator, attachOwnCandidateId } = require('../middleware/auth');
const { cleanRequiredText, referencesAnotherCandidate } = require('../lib/requestSecurity');

// Coordenador vê todos os pedidos; candidato só os seus próprios
router.get('/', requireAuth, attachOwnCandidateId, async (req, res) => {
  let query = supabase.from('contact_requests').select('*').order('created_at', { ascending: false });
  if (req.user.role !== 'coordinator') {
    if (!req.ownCandidateId) return res.json([]);
    if (req.query.candidate_id && req.query.candidate_id !== req.ownCandidateId) {
      return res.status(403).json({ error: 'Proibido' });
    }
    query = query.eq('candidate_id', req.ownCandidateId);
  }
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', requireAuth, attachOwnCandidateId, async (req, res) => {
  if (req.user.role === 'coordinator') {
    return res.status(403).json({ error: 'Coordenadores não podem submeter dúvidas' });
  }
  // candidate_id vem sempre da sessão, nunca do corpo do pedido (PED-58) —
  // um candidato não deve conseguir submeter uma dúvida em nome de outro.
  if (!req.ownCandidateId) return res.status(403).json({ error: 'Proibido' });
  if (referencesAnotherCandidate(req, req.ownCandidateId)) {
    return res.status(403).json({ error: 'Proibido' });
  }
  const question = cleanRequiredText(req.body.question);
  const { module_id } = req.body;
  if (!question) return res.status(400).json({ error: 'question é obrigatório' });
  if (module_id != null && (!Number.isInteger(module_id) || module_id < 1 || module_id > 6)) {
    return res.status(400).json({ error: 'module_id inválido' });
  }
  const { data, error } = await supabase
    .from('contact_requests').insert({ candidate_id: req.ownCandidateId, question, module_id }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch('/:id', requireAuth, requireCoordinator, async (req, res) => {
  const answer = cleanRequiredText(req.body.answer) || 'Resolvido pela coordenação.';
  const answered_by = req.user.coord_role === 'administracao' ? 'Administração' : 'Coordenação';
  const { data, error } = await supabase
    .from('contact_requests')
    .update({ answer, answered_by, status: 'answered', updated_at: new Date() })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
