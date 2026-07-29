const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator, attachOwnCandidateId } = require('../middleware/auth');

// Coordenador vê todos os pedidos; candidato só os seus próprios
router.get('/', requireAuth, attachOwnCandidateId, async (req, res) => {
  let query = supabase.from('contact_requests').select('*').order('created_at', { ascending: false });
  if (req.user.role !== 'coordinator') {
    if (!req.ownCandidateId) return res.json([]);
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
  const { question, module_id } = req.body;
  if (!question) return res.status(400).json({ error: 'question é obrigatório' });
  const { data, error } = await supabase
    .from('contact_requests').insert({ candidate_id: req.ownCandidateId, question, module_id }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch('/:id', requireAuth, requireCoordinator, async (req, res) => {
  const answer = (req.body.answer || '').trim() || 'Resolvido pela coordenação.';
  const answered_by = req.body.answered_by || null;
  const { data, error } = await supabase
    .from('contact_requests')
    .update({ answer, answered_by, status: 'answered', updated_at: new Date() })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
