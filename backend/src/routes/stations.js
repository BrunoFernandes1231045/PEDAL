const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

router.get('/', requireAuth, requireCoordinator, async (req, res) => {
  const { data, error } = await supabase.from('stations').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', requireAuth, requireCoordinator, async (req, res) => {
  const { name, address, locality_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name é obrigatório' });
  const { data, error } = await supabase
    .from('stations').insert({ name, address, locality_id }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch('/:id', requireAuth, requireCoordinator, async (req, res) => {
  const { data, error } = await supabase
    .from('stations').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', requireAuth, requireCoordinator, async (req, res) => {
  const { error } = await supabase.from('stations').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

module.exports = router;
