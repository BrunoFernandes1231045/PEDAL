const express = require('express');
const router = express.Router({ mergeParams: true });
const supabase = require('../db/supabase');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (req.user.role !== 'coordinator' && req.user.id !== id) {
    return res.status(403).json({ error: 'Proibido' });
  }
  const { data, error } = await supabase
    .from('messages').select('*').eq('candidate_id', id)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { role, content, node } = req.body;
  if (!role || !content) return res.status(400).json({ error: 'role e content são obrigatórios' });

  const { data, error } = await supabase
    .from('messages').insert({ candidate_id: id, role, content, node }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

module.exports = router;
