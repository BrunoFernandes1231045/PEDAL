const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

router.get('/', requireAuth, requireCoordinator, async (req, res) => {
  const { data, error } = await supabase.from('needs').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', requireAuth, requireCoordinator, async (req, res) => {
  const { locality_id, periods, description } = req.body;
  const { data, error } = await supabase
    .from('needs').insert({ locality_id, periods, description }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch('/:id', requireAuth, requireCoordinator, async (req, res) => {
  const { data, error } = await supabase
    .from('needs')
    .update({ ...req.body, updated_at: new Date() })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
