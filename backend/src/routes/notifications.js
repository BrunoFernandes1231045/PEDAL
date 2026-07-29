const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator, attachOwnCandidateId } = require('../middleware/auth');

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
  const { type, who, text } = req.body;
  if (!type || !text) return res.status(400).json({ error: 'type e text são obrigatórios' });
  const candidate_id = req.user.role === 'coordinator' ? (req.body.candidate_id || null) : req.ownCandidateId;
  const { data, error } = await supabase
    .from('notifications')
    .insert({ type, who: who || null, text, candidate_id })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

module.exports = router;
