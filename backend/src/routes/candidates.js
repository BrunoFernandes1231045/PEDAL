const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator, requireRole } = require('../middleware/auth');
const { notifyScheduleChange } = require('../lib/scheduleEmails');

// Gera password com entropia real (crypto), não a partir de um dicionário
// pequeno — usada tanto para candidatos como para contas de coordenação.
const crypto = require('crypto');
function genPassword() {
  return crypto.randomBytes(18).toString('base64url'); // ~24 carateres, ~144 bits
}

// Limite persistente (em memória, sobrevive a pedidos mas não a reinícios do
// processo) contra registo automatizado em massa — PED-57. Por IP e por
// email, para não deixar nem um IP nem um endereço abusarem do endpoint.
const SIGNUP_LIMIT = 5;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000; // 1 hora
const signupHits = new Map(); // chave (ip ou email) -> { count, resetAt }
function signupLimited(key) {
  const now = Date.now();
  const entry = signupHits.get(key);
  if (!entry || now > entry.resetAt) { signupHits.set(key, { count: 1, resetAt: now + SIGNUP_WINDOW_MS }); return false; }
  entry.count += 1;
  return entry.count > SIGNUP_LIMIT;
}

// POST /api/candidates — público (inscrição)
router.post('/', async (req, res) => {
  const { name, email, dob, phone, cc, profissao, nif, rua, porta, codigo_postal, cidade } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name e email são obrigatórios' });

  if (signupLimited(req.ip) || signupLimited(String(email).toLowerCase())) {
    return res.status(429).json({ error: 'Demasiados pedidos. Tenta de novo dentro de uma hora.' });
  }

  if (dob) {
    if (new Date(dob) > new Date()) return res.status(400).json({ error: 'A data de nascimento não pode ser uma data futura.' });
    const age = Math.floor((Date.now() - new Date(dob).getTime()) / 3.15576e10);
    if (age < 18) return res.status(400).json({ error: 'É preciso ter pelo menos 18 anos para te inscreveres.' });
  }

  // A password nunca vem do cliente — só o servidor a gera (PED-57).
  const initialPassword = genPassword();

  const emailVerification = process.env.EMAIL_VERIFICATION === 'true';

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: initialPassword,
    app_metadata: { role: 'candidate' },
    email_confirm: !emailVerification,
  });
  if (authError) { console.error('[candidates] auth error:', authError.message); return res.status(500).json({ error: authError.message }); }

  const { data, error } = await supabase
    .from('candidates')
    .insert({ name, email, dob, phone, cc: cc || null, profissao: profissao || null, nif: nif || null, rua: rua || null, porta: porta || null, codigo_postal: codigo_postal || null, cidade: cidade || null, stage: 'inscricao', user_id: authData.user.id })
    .select()
    .single();

  if (error) {
    console.error('[candidates] insert error:', error.message, error.details);
    // Compensa a conta Auth já criada para não deixar utilizadores órfãos sem perfil.
    await supabase.auth.admin.deleteUser(authData.user.id).catch(() => {});
    return res.status(500).json({ error: error.message });
  }
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

  const { data: own } = await supabase.from('candidates').select('user_id').eq('id', req.params.id).single();
  if (!own || own.user_id !== req.user.id) return res.status(403).json({ error: 'Proibido' });

  const { data, error } = await supabase
    .from('candidates')
    .update({ signature, stage: 'ativo', updated_at: new Date() })
    .eq('id', req.params.id).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Campos que o próprio candidato pode escrever no seu registo — tudo o resto
// (incluindo stage fora do funil de auto-serviço) é ignorado para evitar
// mass assignment (PED-58). `stage` só pode entrar nos valores que o próprio
// candidato avança sozinho; onboarding/formalização/prática/ativo/rejeitado
// só a coordenação pode definir.
const CANDIDATE_WRITABLE_FIELDS = ['chat_messages', 'chat_node', 'scheduling', 'interview', 'periods', 'availability', 'locality'];
const CANDIDATE_SELF_STAGES = ['inscricao', 'apresentacao', 'triagem', 'entrevista', 'validacao', 'espera'];

// PATCH /api/candidates/:id — próprio ou coordinator (alteração de stage só para coordenacao)
router.patch('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (req.user.role !== 'coordinator') {
    const { data: own } = await supabase.from('candidates').select('user_id').eq('id', id).single();
    if (!own || own.user_id !== req.user.id) return res.status(403).json({ error: 'Proibido' });
  }

  let body;
  if (req.user.role === 'coordinator') {
    body = { ...req.body };
    if (body.stage && !['administracao', 'coordenacao'].includes(req.user.coord_role)) {
      return res.status(403).json({ error: 'Sem permissão para alterar o estado de candidatos' });
    }
  } else {
    // Allowlist estrita — ignora silenciosamente qualquer campo administrativo
    // que o cliente tente enviar (stage, dados de outro candidato, etc.).
    body = {};
    for (const key of CANDIDATE_WRITABLE_FIELDS) if (key in req.body) body[key] = req.body[key];
    if (req.body.stage && CANDIDATE_SELF_STAGES.includes(req.body.stage)) body.stage = req.body.stage;
  }

  if (body.availability && Array.isArray(body.availability)) {
    body.periods = [...new Set(body.availability.map((a) => a.period))];
  }
  if (body.stage) {
    const { data: current } = await supabase.from('candidates').select('stage').eq('id', id).single();
    if (current && current.stage !== body.stage) {
      body.stage_since = new Date();
      body.stage_reminder_sent_at = null;
    }
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
