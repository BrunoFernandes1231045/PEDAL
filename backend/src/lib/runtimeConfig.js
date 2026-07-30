function normaliseSupabaseUrl(value, name, { required = false, production = false } = {}) {
  const raw = String(value || '').trim();
  if (!raw) {
    if (required) throw new Error(`${name} é obrigatório em produção`);
    return '';
  }

  let url;
  try {
    url = new URL(raw);
  } catch (_) {
    throw new Error(`${name} não é um URL válido`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${name} tem de usar HTTP ou HTTPS`);
  }
  if (production && url.protocol !== 'https:') {
    throw new Error(`${name} tem de usar HTTPS em produção`);
  }

  return raw.replace(/\/+$/, '');
}

function publicRuntimeConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const supabaseUrl = normaliseSupabaseUrl(
    env.SUPABASE_PUBLIC_URL || (production ? '' : env.SUPABASE_URL),
    'SUPABASE_PUBLIC_URL',
    { required: production, production },
  );

  return {
    supabaseUrl,
    supabaseAnonKey: String(env.SUPABASE_ANON_KEY || '').trim(),
  };
}

function validateProductionRuntimeConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') return;

  const backendUrl = normaliseSupabaseUrl(env.SUPABASE_URL, 'SUPABASE_URL', {
    required: true,
    production: true,
  });
  const publicConfig = publicRuntimeConfig(env);

  if (!publicConfig.supabaseAnonKey) {
    throw new Error('SUPABASE_ANON_KEY é obrigatório em produção');
  }
  if (publicConfig.supabaseUrl !== backendUrl) {
    throw new Error('SUPABASE_PUBLIC_URL tem de coincidir com SUPABASE_URL em produção');
  }
}

module.exports = {
  normaliseSupabaseUrl,
  publicRuntimeConfig,
  validateProductionRuntimeConfig,
};
