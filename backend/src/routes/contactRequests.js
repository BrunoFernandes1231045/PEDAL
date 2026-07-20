const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

// Coordenador vê todos os pedidos; candidato só os seus próprios
router.get('/', requireAuth, async (req, res) => {
  let query = supabase.from('contact_requests').select('*').order('created_at', { ascending: false });
  if (req.user.role !== 'coordinator') {
    const { data: own } = await supabase.from('candidates').select('id').eq('user_id', req.user.id).maybeSingle();
    if (!own) return res.json([]);
    query = query.eq('candidate_id', own.id);
  }
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', requireAuth, async (req, res) => {
  if (req.user.role === 'coordinator') {
    return res.status(403).json({ error: 'Coordenadores não podem submeter dúvidas' });
  }
  const { candidate_id, question, module_id } = req.body;
  if (!question) return res.status(400).json({ error: 'question é obrigatório' });
  const { data, error } = await supabase
    .from('contact_requests').insert({ candidate_id, question, module_id }).select().single();
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
