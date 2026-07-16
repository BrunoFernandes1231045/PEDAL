const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

// Public — used by candidate chat to build the locality picker
router.get('/', async (req, res) => {
  const { data: locs, error: e1 } = await supabase
    .from('localities').select('name, slug, sort_order').eq('active', true)
    .order('sort_order', { ascending: true }).order('name', { ascending: true });
  if (e1) return res.status(500).json({ error: e1.message });

  const { data: needLocs, error: e2 } = await supabase
    .from('needs').select('locality').not('locality', 'is', null);
  if (e2) return res.status(500).json({ error: e2.message });

  const baseNames = new Set((locs || []).map((l) => l.name.toLowerCase()));
  const result = (locs || []).map((l) => ({
    id: l.slug || l.name.toLowerCase().replace(/\s+/g, '_'),
    name: l.name,
  }));

  (needLocs || []).forEach((n) => {
    if (n.locality && !baseNames.has(n.locality.toLowerCase())) {
      baseNames.add(n.locality.toLowerCase());
      result.push({ id: n.locality.toLowerCase().replace(/\s+/g, '_'), name: n.locality });
    }
  });

  // Note: do NOT re-sort here — locs already came back in sort_order order.
  // Extra localities from needs (not in the table) are appended at the end alphabetically.
  const extra = result.slice((locs || []).length);
  extra.sort((a, b) => a.name.localeCompare(b.name, 'pt'));

  res.json([...result.slice(0, (locs || []).length), ...extra]);
});

// Batch reorder — must be defined BEFORE /:slug so "reorder" is not treated as a slug
router.patch('/reorder', requireAuth, requireCoordinator, async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order) || order.length === 0) {
    return res.status(400).json({ error: 'order deve ser um array de slugs' });
  }

  const updates = order.map((slug, i) =>
    supabase.from('localities').update({ sort_order: i }).eq('slug', slug).eq('active', true)
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed) return res.status(500).json({ error: failed.error.message });

  res.json({ ok: true });
});

// Rename a locality
router.patch('/:slug', requireAuth, requireCoordinator, async (req, res) => {
  const { slug } = req.params;
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name é obrigatório' });
  const n = name.trim();
  const newSlug = n.toLowerCase().replace(/\s+/g, '_');

  const { data: loc } = await supabase
    .from('localities').select('id').eq('slug', slug).maybeSingle();
  if (!loc) return res.status(404).json({ error: 'Localidade não encontrada' });

  const { error } = await supabase
    .from('localities').update({ name: n, slug: newSlug }).eq('id', loc.id);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true, id: newSlug, name: n });
});

router.post('/', requireAuth, requireCoordinator, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name é obrigatório' });
  const n = name.trim();
  const slug = n.toLowerCase().replace(/\s+/g, '_');

  const { data: existing } = await supabase
    .from('localities').select('id').ilike('name', n).maybeSingle();
  if (existing) return res.status(409).json({ error: `A localidade "${n}" já existe.` });

  // New localities go to the end
  const { data: maxRow } = await supabase
    .from('localities').select('sort_order').eq('active', true)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const nextOrder = maxRow ? (maxRow.sort_order || 0) + 1 : 0;

  const { data, error } = await supabase
    .from('localities').insert({ name: n, slug, active: true, sort_order: nextOrder }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ id: data.slug || slug, name: data.name });
});

router.delete('/:slug', requireAuth, requireCoordinator, async (req, res) => {
  const { slug } = req.params;

  const { data: loc } = await supabase
    .from('localities').select('id, name').eq('slug', slug).maybeSingle();
  if (!loc) return res.status(404).json({ error: 'Localidade não encontrada' });

  const { count } = await supabase
    .from('needs')
    .select('id', { count: 'exact', head: true })
    .ilike('locality', loc.name)
    .eq('status', 'open');

  if (count > 0) {
    return res.status(409).json({
      error: `Há ${count} vaga(s) abertas em ${loc.name}. Remove as vagas primeiro.`,
    });
  }

  const { error } = await supabase
    .from('localities').update({ active: false }).eq('id', loc.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

module.exports = router;
