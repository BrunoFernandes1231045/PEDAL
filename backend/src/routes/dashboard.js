const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

router.get('/stats', requireAuth, requireCoordinator, async (req, res) => {
  const { data: candidates, error } = await supabase
    .from('candidates').select('stage');
  if (error) return res.status(500).json({ error: error.message });

  const byStage = candidates.reduce((acc, c) => {
    acc[c.stage] = (acc[c.stage] || 0) + 1;
    return acc;
  }, {});

  res.json({
    totalCandidates: candidates.length,
    byStage,
    activeCount: byStage['ativo'] || 0,
  });
});

module.exports = router;
