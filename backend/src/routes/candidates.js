const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator, requireRole } = require('../middleware/auth');
const { notifyScheduleChange } = require('../lib/scheduleEmails');

function genPassword() {
  const words = ['pedal', 'bici', 'porto', 'piloto', 'rota'];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${word}${num}`;
}

// POST /api/candidates — público (inscrição)
router.post('/', async (req, res) => {
  const { name, email, dob, phone, cc, profissao, nif, rua, porta, codigo_postal, cidade, password: providedPassword } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name e email são obrigatórios' });

  if (dob) {
    if (new Date(dob) > new Date()) return res.status(400).json({ error: 'A data de nascimento não pode ser uma data futura.' });
    const age = Math.floor((Date.now() - new Date(dob).getTime()) / 3.15576e10);
    if (age < 18) return res.status(400).json({ error: 'É preciso ter pelo menos 18 anos para te inscreveres.' });
  }

  const initialPassword = providedPassword || genPassword();

  const emailVerification = process.env.EMAIL_VERIFICATION === 'true';

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: initialPassword,
    user_metadata: { role: 'candidate' },
    email_confirm: !emailVerification,
  });
  if (authError) { console.error('[candidates] auth error:', authError.message); return res.status(500).json({ error: authError.message }); }

  const { data, error } = await supabase
    .from('candidates')
    .insert({ name, email, dob, phone, cc: cc || null, profissao: profissao || null, nif: nif || null, rua: rua || null, porta: porta || null, codigo_postal: codigo_postal || null, cidade: cidade || null, stage: 'inscricao', user_id: authData.user.id })
    .select()
    .single();

  if (error) { console.error('[candidates] insert error:', error.message, error.details); return res.status(500).json({ error: error.message }); }
  res.status(201).json({ ...data, initialPassword, emailVerificationRequired: emailVerification });
});

// GET /api/candidates — coordinator only
router.get('/', requireAuth, requireCoordinator, async (req, res) => {
  const { data, error } = await supabase.from('candidates').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/candidates/me — próprio candidato
router.get('/me', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('candidates')
    .select('*')
    .eq('user_id', req.user.id)
    .single();
  if (error || !data) return res.status(404).json({ error: 'Candidato não encontrado' });
  res.json(data);
});

// GET /api/candidates/:id — próprio ou coordinator
router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (req.user.role !== 'coordinator') {
    const { data: own } = await supabase.from('candidates').select('user_id').eq('id', id).single();
    if (!own || own.user_id !== req.user.id) return res.status(403).json({ error: 'Proibido' });
  }
  const { data, error } = await supabase
    .from('candidates').select('*').eq('id', id).single();
  if (error) return res.status(404).json({ error: 'Não encontrado' });
  res.json(data);
});

// PATCH /api/candidates/:id/formalize — próprio candidato
// Must be registered BEFORE /:id to avoid Express matching 'formalize' as :id param
router.patch('/:id/formalize', requireAuth, async (req, res) => {
  const { signature } = req.body;
  if (!signature) return res.status(400).json({ error: 'signature é obrigatória' });

  const { data, error } = await supabase
    .from('candidates')
    .update({ signature, stage: 'ativo', updated_at: new Date() })
    .eq('id', req.params.id).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/candidates/:id — próprio ou coordinator (alteração de stage só para coordenacao)
router.patch('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (req.user.role !== 'coordinator') {
    const { data: own } = await supabase.from('candidates').select('user_id').eq('id', id).single();
    if (!own || own.user_id !== req.user.id) return res.status(403).json({ error: 'Proibido' });
  }
  const body = { ...req.body };
  if (body.stage && req.user.role === 'coordinator' && !['administracao', 'coordenacao'].includes(req.user.coord_role)) {
    return res.status(403).json({ error: 'Sem permissão para alterar o estado de candidatos' });
  }
  if (body.availability && Array.isArray(body.availability)) {
    body.periods = [...new Set(body.availability.map((a) => a.period))];
  }
  const { data, error } = await supabase
    .from('candidates')
    .update({ ...body, updated_at: new Date() })
    .eq('id', id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);

  // Aviso por email ao candidato — só quando é a coordenação a propor/editar
  // horários ou a confirmar um definitivo, nunca quando é o próprio candidato
  // a responder a uma proposta (não faz sentido avisá-lo do que ele mesmo fez).
  if (req.user.role === 'coordinator' && body.scheduling) {
    notifyScheduleChange({ name: data.name, email: data.email }, data.scheduling);
  }
});

module.exports = router;
