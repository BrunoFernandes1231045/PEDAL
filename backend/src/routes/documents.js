const express = require('express');
const multer = require('multer');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// POST /api/documents — só coordenadores. Recebe um ficheiro (ex.: PDF do RGPD) e
// guarda-o no Supabase Storage (bucket "documents", público), devolvendo o URL.
// "key" (campo de formulário opcional) organiza o ficheiro numa subpasta — reutilizável
// mais tarde para outros documentos (ex.: base de conhecimento do agente).
router.post('/', requireAuth, requireCoordinator, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Ficheiro em falta' });
  const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const folder = (req.body.key || 'misc').replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${folder}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from('documents').upload(path, req.file.buffer, {
    contentType: req.file.mimetype,
    upsert: true,
  });
  if (error) return res.status(500).json({ error: error.message });

  const { data } = supabase.storage.from('documents').getPublicUrl(path);
  res.status(201).json({ url: data.publicUrl, name: req.file.originalname });
});

module.exports = router;
