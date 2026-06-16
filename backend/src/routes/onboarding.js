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
    .from('onboarding').select('*').eq('candidate_id', id).single();
  if (error) return res.status(404).json({ error: 'Não encontrado' });
  res.json(data);
});

router.patch('/progress/:moduleId', requireAuth, async (req, res) => {
  const { id, moduleId } = req.params;
  const { completed } = req.body;
  const completed_at = completed ? new Date() : null;

  const { data, error } = await supabase
    .from('onboarding_progress')
    .upsert({ candidate_id: id, module_id: parseInt(moduleId), completed, completed_at })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.patch('/', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('onboarding')
    .upsert({ candidate_id: id, ...req.body, updated_at: new Date() })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
