const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

router.get('/', requireAuth, requireCoordinator, async (req, res) => {
  const { data, error } = await supabase
    .from('trainers').select('id, name, dob, phone, email, locality, active, created_at')
    .eq('active', true).order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', requireAuth, requireCoordinator, async (req, res) => {
  const { name, dob, phone, email, locality } = req.body;
  if (!name) return res.status(400).json({ error: 'name é obrigatório' });
  const { data, error } = await supabase
    .from('trainers').insert({ name, dob: dob || null, phone: phone || null, email: email || null, locality: locality || null }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch('/:id', requireAuth, requireCoordinator, async (req, res) => {
  const { name, dob, phone, email, locality } = req.body;
  const { data, error } = await supabase
    .from('trainers').update({ name, dob, phone, email, locality }).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', requireAuth, requireCoordinator, async (req, res) => {
  const { error } = await supabase.from('trainers').update({ active: false }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

module.exports = router;
