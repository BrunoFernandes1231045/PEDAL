const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

router.get('/', requireAuth, requireCoordinator, async (req, res) => {
  const { data, error } = await supabase
    .from('contact_requests').select('*').eq('status', 'pending');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', requireAuth, async (req, res) => {
  const { candidate_id, question, module_id } = req.body;
  if (!question) return res.status(400).json({ error: 'question é obrigatório' });
  const { data, error } = await supabase
    .from('contact_requests').insert({ candidate_id, question, module_id }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch('/:id', requireAuth, requireCoordinator, async (req, res) => {
  const { answer } = req.body;
  if (!answer) return res.status(400).json({ error: 'answer é obrigatório' });
  const { data, error } = await supabase
    .from('contact_requests')
    .update({ answer, status: 'answered', updated_at: new Date() })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
