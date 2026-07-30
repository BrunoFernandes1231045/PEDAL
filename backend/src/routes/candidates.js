const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator, requireRole } = require('../middleware/auth');
const { notifyScheduleChange } = require('../lib/scheduleEmails');
const crypto = require('crypto');
const { verifyTurnstile } = require('../lib/turnstile');
const { clientIp } = require('../lib/clientIp');
const { signupSecurityConfig, validateSignupPayload } = require('../lib/signupSecurity');

const GENERIC_SIGNUP_RESPONSE = {
  message: 'Se o endereço puder ser registado, receberás um email para ativar a conta e definir a palavra-passe.',
  emailVerificationRequired: true,
};

function identifierHash(namespace, value) {
  return crypto.createHash('sha256').update(`${namespace}:${value}`).digest('hex');
}

function isDuplicateUserError(error) {
  if (!error) return false;
  return error.code === 'email_exists'
    || error.status === 422
    || /already (been )?registered|already exists|email.*exists/i.test(error.message || '');
}

async function consumeSignupRateLimit(identifiers, maxRequests, windowSeconds) {
  const { data, error } = await supabase.rpc('consume_signup_rate_limit', {
    p_identifier_hashes: identifiers,
    p_window_seconds: windowSeconds,
    p_max_requests: maxRequests,
  });
  if (error) throw error;
  if (!data || typeof data.limited !== 'boolean') {
    throw new Error('Resposta inválida do rate limit persistente');
  }
  return data;
}

function inviteRedirectUrl(req) {
  const configuredBase = process.env.PUBLIC_APP_URL;
  if (!configuredBase && process.env.NODE_ENV === 'production') return null;
  const base = configuredBase || `${req.protocol}://${req.get('host')}`;
  try {
    return new URL('/nova-palavra-passe?tipo=convite', base).toString();
  } catch (_) {
    return null;
  }
}

async function compensateAuthUser(userId) {
  if (!userId) return;
  try {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) console.error('[candidates] auth compensation error:', error.message);
  } catch (error) {
    console.error('[candidates] auth compensation error:', error.message);
  }
}

// GET /api/candidates/signup-config — configuração pública não sensível.
router.get('/signup-config', (_req, res) => {
  try {
    const config = signupSecurityConfig();
    res.json({
      turnstileSiteKey: config.siteKey,
      registrationAvailable: Boolean(config.siteKey && config.secretKey),
    });
  } catch (error) {
    console.error('[candidates] invalid signup configuration:', error.message);
    res.status(503).json({ turnstileSiteKey: '', registrationAvailable: false });
  }
});

// POST /api/candidates — público (inscrição)
router.post('/', async (req, res) => {
  const validated = validateSignupPayload(req.body);
  if (validated.error) return res.status(400).json(validated);
  const {
    name, email, dob, phone, cc, profissao, nif, rua, porta, codigo_postal, cidade, turnstileToken,
  } = validated.value;

  let security;
  try {
    security = signupSecurityConfig();
  } catch (error) {
    console.error('[candidates] invalid signup configuration:', error.message);
    return res.status(503).json({ error: 'O registo está temporariamente indisponível. Tenta novamente mais tarde.' });
  }
  if (!security.siteKey || !security.secretKey) {
    return res.status(503).json({ error: 'O registo está temporariamente indisponível. Tenta novamente mais tarde.' });
  }

  const requestIp = clientIp(req);

  // Bucket exclusivamente por IP antes da chamada externa. Usa namespace
  // próprio: tokens inválidos nunca consomem nem bloqueiam o bucket do email.
  let preRateLimit;
  try {
    preRateLimit = await consumeSignupRateLimit(
      [identifierHash('signup-pre-ip', requestIp)],
      security.preRateLimit,
      security.preRateWindowSeconds,
    );
  } catch (error) {
    console.error('[candidates] persistent pre-rate-limit error:', error.message);
    return res.status(503).json({ error: 'O registo está temporariamente indisponível. Tenta novamente mais tarde.' });
  }
  if (preRateLimit.limited) {
    const retryAfter = Math.max(1, Number(preRateLimit.retryAfter) || security.preRateWindowSeconds);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Demasiados pedidos. Tenta novamente mais tarde.' });
  }

  // O desafio é validado antes de consumir o bucket de email. Caso contrário,
  // um bot sem token poderia bloquear durante uma hora o email de uma vítima.
  const turnstile = await verifyTurnstile({
    token: turnstileToken,
    remoteIp: requestIp === 'unknown' ? undefined : requestIp,
    idempotencyKey: crypto.randomUUID(),
    secretKey: security.secretKey,
    expectedAction: security.expectedAction,
    expectedHostnames: security.expectedHostnames,
  });
  if (turnstile.configurationError || turnstile.serviceError) {
    console.error('[candidates] Turnstile unavailable or not configured');
    return res.status(503).json({ error: 'Não foi possível validar o registo. Tenta novamente mais tarde.' });
  }
  if (!turnstile.success) {
    console.error('[candidates] Turnstile falhou:', JSON.stringify({
      errorCodes: turnstile.errorCodes,
      bindingError: turnstile.bindingError,
      hostname: turnstile.hostname,
      action: turnstile.action,
      expectedAction: security.expectedAction,
      expectedHostnames: security.expectedHostnames,
    }));
    return res.status(400).json({ error: 'A validação anti-robô falhou. Atualiza a página e tenta novamente.' });
  }

  let rateLimit;
  try {
    rateLimit = await consumeSignupRateLimit(
      [
        identifierHash('signup-ip', requestIp),
        identifierHash('signup-email', email),
      ],
      security.signupRateLimit,
      security.signupRateWindowSeconds,
    );
  } catch (error) {
    console.error('[candidates] persistent rate-limit error:', error.message);
    return res.status(503).json({ error: 'O registo está temporariamente indisponível. Tenta novamente mais tarde.' });
  }
  if (rateLimit.limited) {
    const retryAfter = Math.max(1, Number(rateLimit.retryAfter) || security.signupRateWindowSeconds);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Demasiados pedidos. Tenta novamente mais tarde.' });
  }

  if (dob) {
    const parsedDob = new Date(dob);
    if (Number.isNaN(parsedDob.getTime())) return res.status(400).json({ error: 'A data de nascimento não é válida.' });
    if (parsedDob > new Date()) return res.status(400).json({ error: 'A data de nascimento não pode ser uma data futura.' });
    const age = Math.floor((Date.now() - parsedDob.getTime()) / 3.15576e10);
    if (age < 18) return res.status(400).json({ error: 'É preciso ter pelo menos 18 anos para te inscreveres.' });
  }

  const redirectTo = inviteRedirectUrl(req);
  if (!redirectTo) {
    console.error('[candidates] PUBLIC_APP_URL is missing or invalid');
    return res.status(503).json({ error: 'O registo está temporariamente indisponível. Tenta novamente mais tarde.' });
  }

  // O Supabase envia uma ligação de utilização única. O utilizador define a
  // própria password apenas depois de controlar o endereço de email.
  const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { name: String(name).trim() },
  });
  if (authError) {
    if (isDuplicateUserError(authError)) return res.status(202).json(GENERIC_SIGNUP_RESPONSE);
    console.error('[candidates] invite error:', authError.message);
    return res.status(500).json({ error: 'Não foi possível concluir o registo.' });
  }

  const authUserId = authData && authData.user && authData.user.id;
  if (!authUserId) {
    console.error('[candidates] invite succeeded without a user id');
    return res.status(500).json({ error: 'Não foi possível concluir o registo.' });
  }

  // app_metadata é escrita exclusivamente pelo backend e é a fonte de verdade
  // para autorização. Nunca se coloca o papel em user_metadata.
  const { error: metadataError } = await supabase.auth.admin.updateUserById(authUserId, {
    app_metadata: {
      role: 'candidate',
      authorization_version: crypto.randomUUID(),
    },
  });
  if (metadataError) {
    console.error('[candidates] app metadata error:', metadataError.message);
    await compensateAuthUser(authUserId);
    return res.status(500).json({ error: 'Não foi possível concluir o registo.' });
  }

  const { data, error } = await supabase
    .from('candidates')
    .insert({ name, email, dob, phone, cc, profissao, nif, rua, porta, codigo_postal, cidade, stage: 'inscricao', user_id: authUserId })
    .select()
    .single();

  if (error) {
    console.error('[candidates] insert error:', error.message, error.details);
    await compensateAuthUser(authUserId);
    if (error.code === '23505') return res.status(202).json(GENERIC_SIGNUP_RESPONSE);
    return res.status(500).json({ error: 'Não foi possível concluir o registo.' });
  }
  // Não devolver perfil, user id, token ou password: a resposta não permite
  // descobrir se um email já estava registado.
  return res.status(202).json(GENERIC_SIGNUP_RESPONSE);
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

  const { data: own } = await supabase.from('candidates').select('user_id, stage').eq('id', req.params.id).single();
  if (!own || own.user_id !== req.user.id) return res.status(403).json({ error: 'Proibido' });
  if (own.stage !== 'formalizacao') {
    return res.status(409).json({
      error: `Não é possível formalizar uma candidatura no estado ${own.stage || 'desconhecido'}`,
      code: 'invalid_stage_transition',
    });
  }

  const { data, error } = await supabase
    .from('candidates')
    .update({
      signature,
      stage: 'ativo',
      stage_since: new Date(),
      stage_reminder_sent_at: null,
      updated_at: new Date(),
    })
    .eq('id', req.params.id)
    .eq('stage', 'formalizacao')
    .select()
    .single();

  if (error || !data) {
    return res.status(409).json({
      error: 'O estado foi alterado noutro pedido. Atualiza e tenta novamente.',
      code: 'stage_transition_conflict',
    });
  }
  res.json(data);
});

// Campos que o próprio candidato pode escrever no seu registo. Tudo o resto é
// rejeitado para tornar tentativas de mass assignment visíveis (PED-58).
const CANDIDATE_WRITABLE_FIELDS = ['chat_messages', 'chat_node', 'scheduling', 'interview', 'periods', 'availability', 'locality'];
const COORDINATOR_WRITABLE_FIELDS = [...CANDIDATE_WRITABLE_FIELDS, 'stage'];
const VALID_STAGES = new Set([
  'inscricao', 'apresentacao', 'triagem', 'entrevista', 'validacao', 'espera',
  'onboarding', 'pratica', 'formalizacao', 'ativo', 'rejeitado',
]);
const CANDIDATE_STAGE_TRANSITIONS = {
  // O perfil só é criado depois do formulário, por isso a primeira alteração
  // persistida pode saltar o passo visual "apresentacao".
  inscricao: new Set(['apresentacao', 'triagem', 'espera']),
  apresentacao: new Set(['triagem']),
  triagem: new Set(['entrevista', 'espera']),
  entrevista: new Set(['validacao']),
  validacao: new Set(),
  espera: new Set(),
  onboarding: new Set(),
  pratica: new Set(),
  formalizacao: new Set(),
  ativo: new Set(),
  rejeitado: new Set(),
};

const INTERVIEW_FIELDS = new Set(['conhecimento', 'voluntariado', 'voluntariado_info', 'bicicleta', 'carta']);

function sanitizeCandidateInterview(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const result = {};
  for (const [key, answer] of Object.entries(value)) {
    if (INTERVIEW_FIELDS.has(key) && typeof answer === 'string') result[key] = answer.trim().slice(0, 4000);
  }
  return result;
}

function interviewIsComplete(value) {
  if (!value || typeof value !== 'object') return false;
  const required = ['conhecimento', 'voluntariado', 'bicicleta', 'carta'];
  if (!required.every((key) => typeof value[key] === 'string' && value[key].trim())) return false;
  if (!['Sim', 'Não'].includes(value.voluntariado)) return false;
  if (!['Sim', 'Não'].includes(value.bicicleta)) return false;
  if (!['Sim', 'Não'].includes(value.carta)) return false;
  return value.voluntariado !== 'Sim'
    || (typeof value.voluntariado_info === 'string' && Boolean(value.voluntariado_info.trim()));
}

function sanitizeCandidateChatMessages(value, trustedContactAnswers = []) {
  if (!Array.isArray(value)) return null;
  const trustedAnswers = new Set((trustedContactAnswers || []).map((request) => (
    `${request.answer || ''}\u0000${request.answered_by || 'Coordenação'}`
  )));
  return value.slice(-500).flatMap((message) => {
    if (!message || Array.isArray(message) || typeof message !== 'object') return [];
    const clean = { ...message };
    // Estas marcas significam "escrito pela coordenação" na interface. Um
    // candidato só as pode reenviar quando o texto e autor correspondem a uma
    // resposta real, já gravada pela coordenação num pedido de contacto.
    const trustedCoordinatorMessage = clean.coord === true
      && typeof clean.text === 'string'
      && trustedAnswers.has(`${clean.text}\u0000${clean.coordAuthor || 'Coordenação'}`);
    if (!trustedCoordinatorMessage) {
      delete clean.coord;
      delete clean.coordAuthor;
    }
    clean.client_unverified = !trustedCoordinatorMessage && clean.from !== 'user';
    if (trustedCoordinatorMessage) clean.authorTrust = 'contact_request';
    else delete clean.authorTrust;
    delete clean.answered_by;
    delete clean.authorRole;
    if (!['user', 'agent', 'system'].includes(clean.from)) clean.from = 'user';
    if (typeof clean.text === 'string') clean.text = clean.text.slice(0, 12000);
    return [clean];
  });
}

function sameValue(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function candidateSchedulingUpdate(currentValue, requestedValue) {
  if (!requestedValue || Array.isArray(requestedValue) || typeof requestedValue !== 'object') {
    return { error: 'scheduling tem de ser um objeto' };
  }
  const current = currentValue && !Array.isArray(currentValue) && typeof currentValue === 'object'
    ? currentValue
    : {};
  const requested = requestedValue;

  // O candidato pode reenviar estes valores porque o frontend faz merge local,
  // mas nunca pode alterá-los.
  for (const field of ['trainerId', 'stationId', 'chatNotify']) {
    if (Object.hasOwn(requested, field) && !sameValue(requested[field], current[field])) {
      return { error: `O candidato não pode alterar scheduling.${field}` };
    }
  }

  if (requested.rescheduleRequested === true) {
    return {
      // Pedir remarcação é um sinal adicional. Não apaga a marcação atual:
      // chosen/status continuam a ser a referência até a coordenação responder.
      data: { ...current, rescheduleRequested: true },
    };
  }

  if (requested.status === 'candidato_propoe') {
    const currentSlots = Array.isArray(current.slots) ? current.slots : [];
    const requestedSlots = Array.isArray(requested.slots) ? requested.slots : [];
    if (requestedSlots.length !== currentSlots.length + 1) {
      return { error: 'Só pode ser proposto um novo horário de cada vez' };
    }
    if (!currentSlots.every((slot, index) => sameValue(slot, requestedSlots[index]))) {
      return { error: 'Os horários existentes não podem ser alterados pelo candidato' };
    }
    const proposal = requestedSlots[requestedSlots.length - 1];
    if (!proposal || typeof proposal !== 'object'
      || !/^\d{4}-\d{2}-\d{2}$/.test(proposal.date || '')
      || !/^\d{2}:\d{2}$/.test(proposal.startTime || '')) {
      return { error: 'O horário proposto não é válido' };
    }
    return {
      data: {
        ...current,
        slots: [...currentSlots, {
          date: proposal.date,
          startTime: proposal.startTime,
          state: 'proposto_candidato',
        }],
        status: 'candidato_propoe',
        rescheduleRequested: false,
      },
    };
  }

  if (requested.status === 'aguarda_coordenacao') {
    const currentSlots = Array.isArray(current.slots) ? current.slots : [];
    const requestedSlots = Array.isArray(requested.slots) ? requested.slots : [];
    if (requestedSlots.length !== currentSlots.length) {
      return { error: 'A seleção de horários não corresponde à proposta atual' };
    }
    const selected = new Set();
    for (let index = 0; index < requestedSlots.length; index += 1) {
      const { state: _requestedState, ...requestedSlot } = requestedSlots[index] || {};
      const { state: _currentState, ...currentSlot } = currentSlots[index] || {};
      if (!sameValue(requestedSlot, currentSlot)) {
        return { error: 'Os horários propostos não podem ser alterados pelo candidato' };
      }
      if (requestedSlots[index].state === 'selecionado') selected.add(index);
    }
    if (!selected.size) return { error: 'Seleciona pelo menos um horário' };
    return {
      data: {
        ...current,
        slots: currentSlots.map((slot, index) => (
          selected.has(index) ? { ...slot, state: 'selecionado' } : slot
        )),
        status: 'aguarda_coordenacao',
        rescheduleRequested: false,
      },
    };
  }

  if (Number.isInteger(requested.chosen)) {
    const currentSlots = Array.isArray(current.slots) ? current.slots : [];
    if (requested.chosen < 0 || requested.chosen >= currentSlots.length) {
      return { error: 'O horário escolhido não existe na proposta atual' };
    }
    return {
      data: {
        ...current,
        chosen: requested.chosen,
        rescheduleRequested: false,
      },
    };
  }

  return { error: 'A alteração de scheduling pedida não é permitida ao candidato' };
}

// PATCH /api/candidates/:id — próprio ou coordinator (alteração de stage só para coordenacao)
router.patch('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (req.user.role !== 'coordinator') {
    const { data: own } = await supabase.from('candidates').select('user_id').eq('id', id).single();
    if (!own || own.user_id !== req.user.id) return res.status(403).json({ error: 'Proibido' });
  }

  let body;
  let expectedStage = null;
  if (req.user.role === 'coordinator') {
    const allowed = new Set(COORDINATOR_WRITABLE_FIELDS);
    const forbiddenFields = Object.keys(req.body).filter((key) => !allowed.has(key));
    if (forbiddenFields.length) {
      return res.status(400).json({
        error: 'O pedido contém campos que não podem ser alterados por este endpoint',
        fields: forbiddenFields,
      });
    }
    body = {};
    for (const key of COORDINATOR_WRITABLE_FIELDS) {
      if (key in req.body) body[key] = req.body[key];
    }
    if (body.stage && !VALID_STAGES.has(body.stage)) {
      return res.status(400).json({ error: 'Estado de candidato inválido' });
    }
    if (body.stage && !['administracao', 'coordenacao'].includes(req.user.coord_role)) {
      return res.status(403).json({ error: 'Sem permissão para alterar o estado de candidatos' });
    }
  } else {
    const allowed = new Set([...CANDIDATE_WRITABLE_FIELDS, 'stage']);
    const forbiddenFields = Object.keys(req.body).filter((key) => !allowed.has(key));
    if (forbiddenFields.length) {
      return res.status(400).json({
        error: 'O pedido contém campos que o candidato não pode alterar',
        fields: forbiddenFields,
      });
    }

    body = {};
    for (const key of CANDIDATE_WRITABLE_FIELDS) if (key in req.body) body[key] = req.body[key];
    if (Object.hasOwn(body, 'chat_messages')) {
      let trustedContactAnswers = [];
      if (Array.isArray(body.chat_messages) && body.chat_messages.some((message) => message?.coord === true)) {
        const { data } = await supabase
          .from('contact_requests')
          .select('answer, answered_by')
          .eq('candidate_id', id)
          .eq('status', 'answered');
        trustedContactAnswers = data || [];
      }
      const messages = sanitizeCandidateChatMessages(body.chat_messages, trustedContactAnswers);
      if (!messages) return res.status(400).json({ error: 'chat_messages tem de ser uma lista' });
      body.chat_messages = messages;
    }
    if (Object.hasOwn(body, 'interview')) {
      const interview = sanitizeCandidateInterview(body.interview);
      if (!interview) return res.status(400).json({ error: 'interview tem de ser um objeto' });
      body.interview = interview;
    }
    if (Object.hasOwn(body, 'scheduling')) {
      const { data: currentScheduling } = await supabase
        .from('candidates').select('scheduling').eq('id', id).single();
      const scheduling = candidateSchedulingUpdate(currentScheduling?.scheduling, body.scheduling);
      if (scheduling.error) return res.status(400).json({ error: scheduling.error });
      body.scheduling = scheduling.data;
    }
    if (req.body.stage) {
      const { data: current, error: currentError } = await supabase
        .from('candidates').select('stage, interview').eq('id', id).single();
      if (currentError || !current) return res.status(404).json({ error: 'Candidato não encontrado' });

      expectedStage = current.stage;
      if (req.body.stage !== current.stage) {
        const allowedNext = CANDIDATE_STAGE_TRANSITIONS[current.stage] || new Set();
        if (!allowedNext.has(req.body.stage)) {
          return res.status(409).json({
            error: `Transição de estado inválida: ${current.stage} → ${req.body.stage}`,
            code: 'invalid_stage_transition',
          });
        }
        const prospectiveInterview = body.interview || current.interview;
        if (current.stage === 'entrevista'
          && req.body.stage === 'validacao'
          && !interviewIsComplete(prospectiveInterview)) {
          return res.status(409).json({
            error: 'É necessário concluir o questionário antes de avançar para validação',
            code: 'stage_prerequisite_missing',
          });
        }
        body.stage = req.body.stage;
      }
    }
  }

  if (body.availability && Array.isArray(body.availability)) {
    body.periods = [...new Set(body.availability.map((a) => a.period))];
  }
  if (body.stage) {
    const { data: current } = expectedStage
      ? { data: { stage: expectedStage } }
      : await supabase.from('candidates').select('stage').eq('id', id).single();
    if (current && current.stage !== body.stage) {
      body.stage_since = new Date();
      body.stage_reminder_sent_at = null;
    }
  }
  let updateQuery = supabase
    .from('candidates')
    .update({ ...body, updated_at: new Date() })
    .eq('id', id);
  // Evita duas transições concorrentes partirem do mesmo estado observado.
  if (expectedStage && body.stage) updateQuery = updateQuery.eq('stage', expectedStage);
  const { data, error } = await updateQuery.select().single();
  if (expectedStage && body.stage && (error || !data)) {
    return res.status(409).json({
      error: 'O estado foi alterado noutro pedido. Atualiza e tenta novamente.',
      code: 'stage_transition_conflict',
    });
  }
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
