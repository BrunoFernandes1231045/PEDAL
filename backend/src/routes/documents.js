const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// POST /api/documents — só coordenadores. Recebe um ficheiro (ex.: PDF do RGPD ou da
// base de conhecimento do agente) e guarda-o no Supabase Storage (bucket "documents",
// público), devolvendo o URL. "key" (campo de formulário opcional) organiza o ficheiro
// numa subpasta. Para PDFs, extrai também o texto (uma só vez, aqui) para a IA poder
// usá-lo como contexto sem ter de reprocessar o ficheiro a cada pergunta.
router.post('/', requireAuth, requireCoordinator, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Ficheiro em falta' });
  // multer/busboy devolvem nomes com acentos mal decodificados (lidos como latin1
  // em vez de utf8) — reconverte antes de mostrar o nome ao utilizador.
  const displayName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  const safeName = displayName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const folder = (req.body.key || 'misc').replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${folder}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from('documents').upload(path, req.file.buffer, {
    contentType: req.file.mimetype,
    upsert: true,
  });
  if (error) return res.status(500).json({ error: error.message });

  let text = null;
  if (req.file.mimetype === 'application/pdf') {
    try { text = (await pdfParse(req.file.buffer)).text; } catch (_) { text = null; }
  }

  const { data } = supabase.storage.from('documents').getPublicUrl(path);
  res.status(201).json({ url: data.publicUrl, name: displayName, text });
});

module.exports = router;
