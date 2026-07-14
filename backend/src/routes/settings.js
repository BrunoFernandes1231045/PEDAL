const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

// GET /api/settings/:key — público (sem auth)
router.get('/:key', async (req, res) => {
  const { data, error } = await supabase
    .from('org_settings')
    .select('value')
    .eq('key', req.params.key)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ? data.value : null);
});

// PUT /api/settings/:key — só coordenadores
router.put('/:key', requireAuth, requireCoordinator, async (req, res) => {
  const { data, error } = await supabase
    .from('org_settings')
    .upsert({ key: req.params.key, value: req.body, updated_at: new Date() }, { onConflict: 'key' })
    .select('value')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.value);
});

module.exports = router;
