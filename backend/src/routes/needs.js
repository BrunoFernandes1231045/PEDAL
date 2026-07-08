const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

// Public — used by candidate chat for needMatch (no auth required)
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('needs').select('id, locality, periods, status')
    .eq('status', 'open').not('locality', 'is', null);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', requireAuth, requireCoordinator, async (req, res) => {
  const { locality, periods } = req.body;
  if (!locality) return res.status(400).json({ error: 'locality é obrigatório' });

  // Se a localidade não existe na tabela localities, cria-a
  const { data: existing } = await supabase
    .from('localities').select('id').ilike('name', locality).maybeSingle();
  if (!existing) {
    await supabase.from('localities').insert({
      name: locality,
      slug: locality.toLowerCase().replace(/\s+/g, '_'),
      active: true,
    });
  }

  const { data, error } = await supabase
    .from('needs').insert({ locality, periods: periods || [] }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch('/:id', requireAuth, requireCoordinator, async (req, res) => {
  const { periods } = req.body;
  const { data, error } = await supabase
    .from('needs').update({ periods, updated_at: new Date() }).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', requireAuth, requireCoordinator, async (req, res) => {
  const { error } = await supabase.from('needs').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

module.exports = router;
