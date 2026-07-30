const TEST_SITE_KEYS = new Set([
  '1x00000000000000000000AA',
  '2x00000000000000000000AB',
  '1x00000000000000000000BB',
  '2x00000000000000000000BB',
  '3x00000000000000000000FF',
]);

const TEST_SECRET_KEYS = new Set([
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
]);

function positiveInteger(env, name, fallback, { min = 1, max = 86400 } = {}) {
  const raw = env[name] == null || env[name] === '' ? String(fallback) : String(env[name]);
  if (!/^\d+$/.test(raw)) throw new Error(`${name} tem de ser um número inteiro positivo`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} tem de estar entre ${min} e ${max}`);
  }
  return value;
}

function publicAppHostname(env) {
  if (!env.PUBLIC_APP_URL) return null;
  let url;
  try {
    url = new URL(env.PUBLIC_APP_URL);
  } catch (_) {
    throw new Error('PUBLIC_APP_URL não é um URL válido');
  }
  if (env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('PUBLIC_APP_URL tem de usar HTTPS em produção');
  }
  return url.hostname.toLowerCase();
}

function signupSecurityConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const siteKey = String(env.TURNSTILE_SITE_KEY || '').trim();
  const secretKey = String(env.TURNSTILE_SECRET_KEY || '').trim();
  const configuredHostnames = String(env.TURNSTILE_EXPECTED_HOSTNAMES || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const appHostname = publicAppHostname(env);
  const expectedHostnames = configuredHostnames.length
    ? [...new Set(configuredHostnames)]
    : (production && appHostname ? [appHostname] : []);

  if (production) {
    if (!siteKey || !secretKey) throw new Error('TURNSTILE_SITE_KEY e TURNSTILE_SECRET_KEY são obrigatórias em produção');
    if (TEST_SITE_KEYS.has(siteKey) || TEST_SECRET_KEYS.has(secretKey)) {
      throw new Error('As chaves oficiais de teste do Turnstile não podem ser usadas em produção');
    }
    if (!expectedHostnames.length) {
      throw new Error('TURNSTILE_EXPECTED_HOSTNAMES ou PUBLIC_APP_URL é obrigatório em produção');
    }
  }

  return {
    siteKey,
    secretKey,
    expectedAction: 'signup',
    expectedHostnames,
    preRateLimit: positiveInteger(env, 'SIGNUP_PRE_RATE_LIMIT', 30, { max: 10000 }),
    preRateWindowSeconds: positiveInteger(env, 'SIGNUP_PRE_RATE_WINDOW_SECONDS', 60),
    signupRateLimit: positiveInteger(env, 'SIGNUP_RATE_LIMIT', 5, { max: 1000 }),
    signupRateWindowSeconds: positiveInteger(env, 'SIGNUP_RATE_WINDOW_SECONDS', 3600),
  };
}

function optionalText(payload, field, maxLength) {
  const value = payload[field];
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return { error: `${field} tem de ser texto` };
  const trimmed = value.trim();
  if (trimmed.length > maxLength) return { error: `${field} excede ${maxLength} caracteres` };
  return trimmed || null;
}

const SIGNUP_FIELDS = new Set([
  'name', 'email', 'dob', 'phone', 'cc', 'profissao', 'nif', 'rua', 'porta',
  'codigo_postal', 'cidade', 'turnstileToken',
]);

function validateSignupPayload(payload) {
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
    return { error: 'O pedido de inscrição não é válido' };
  }
  if (Object.hasOwn(payload, 'password') || Object.hasOwn(payload, 'initialPassword')) {
    return { error: 'A palavra-passe é definida apenas através da ligação enviada por email' };
  }
  const unknown = Object.keys(payload).filter((field) => !SIGNUP_FIELDS.has(field));
  if (unknown.length) return { error: 'O pedido contém campos desconhecidos', fields: unknown };

  const name = optionalText(payload, 'name', 120);
  if (!name || typeof name === 'object' || name.length < 2) return { error: name?.error || 'name é obrigatório' };
  const email = optionalText(payload, 'email', 320);
  if (!email || typeof email === 'object') return { error: email?.error || 'email é obrigatório' };
  const normalisedEmail = email.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalisedEmail)) return { error: 'O email não é válido' };

  const limits = {
    dob: 10,
    phone: 40,
    cc: 40,
    profissao: 120,
    nif: 32,
    rua: 200,
    porta: 30,
    codigo_postal: 20,
    cidade: 120,
    turnstileToken: 4096,
  };
  const values = {};
  for (const [field, maxLength] of Object.entries(limits)) {
    const value = optionalText(payload, field, maxLength);
    if (value && typeof value === 'object') return { error: value.error };
    values[field] = value;
  }
  if (values.dob && !/^\d{4}-\d{2}-\d{2}$/.test(values.dob)) {
    return { error: 'A data de nascimento não é válida' };
  }

  return {
    value: {
      name,
      email: normalisedEmail,
      ...values,
    },
  };
}

module.exports = {
  TEST_SITE_KEYS,
  TEST_SECRET_KEYS,
  positiveInteger,
  signupSecurityConfig,
  validateSignupPayload,
};
