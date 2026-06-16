const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

router.get('/', requireAuth, requireCoordinator, async (req, res) => {
  const { data, error } = await supabase.from('trainers').select('*').eq('active', true);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', requireAuth, requireCoordinator, async (req, res) => {
  const { name, specialty, locality_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name é obrigatório' });
  const { data, error } = await supabase
    .from('trainers').insert({ name, specialty, locality_id }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch('/:id', requireAuth, requireCoordinator, async (req, res) => {
  const { data, error } = await supabase
    .from('trainers').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', requireAuth, requireCoordinator, async (req, res) => {
  const { error } = await supabase.from('trainers').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

module.exports = router;
