#!/usr/bin/env node

const crypto = require('crypto');
const path = require('path');

const PAGE_SIZE = 200;

class BootstrapError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'BootstrapError';
    this.code = code;
  }
}

function usage() {
  return [
    'Uso:',
    '  node scripts/bootstrap-first-admin.js --confirm --email <email> --name "<nome>"',
    '',
    'Também aceita FIRST_ADMIN_EMAIL e FIRST_ADMIN_NAME no ambiente.',
    'O redirect vem de COORDINATOR_INVITE_REDIRECT_URL ou PUBLIC_APP_URL.',
    'SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórias.',
  ].join('\n');
}

function parseArgs(argv) {
  const parsed = { confirm: false };
  const valueFlags = new Map([
    ['--email', 'email'],
    ['--name', 'name'],
    ['--redirect-url', 'redirectUrl'],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--confirm') {
      parsed.confirm = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    const key = valueFlags.get(arg);
    if (!key) throw new BootstrapError(`Argumento desconhecido: ${arg}`, 'invalid_arguments');
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new BootstrapError(`Falta o valor de ${arg}`, 'invalid_arguments');
    }
    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

function normaliseInput({ email, name, redirectUrl, publicAppUrl }) {
  const normalisedEmail = String(email || '').trim().toLowerCase();
  const normalisedName = String(name || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalisedEmail)) {
    throw new BootstrapError('FIRST_ADMIN_EMAIL/--email não é válido.', 'invalid_email');
  }
  if (normalisedName.length < 2 || normalisedName.length > 120) {
    throw new BootstrapError('FIRST_ADMIN_NAME/--name deve ter entre 2 e 120 caracteres.', 'invalid_name');
  }

  let resolvedRedirect = String(redirectUrl || '').trim();
  if (!resolvedRedirect && publicAppUrl) {
    resolvedRedirect = `${String(publicAppUrl).replace(/\/+$/, '')}/nova-palavra-passe?tipo=convite-coordenacao`;
  }
  let parsedRedirect;
  try {
    parsedRedirect = new URL(resolvedRedirect);
  } catch (_) {
    throw new BootstrapError(
      'COORDINATOR_INVITE_REDIRECT_URL/--redirect-url não é válido.',
      'invalid_redirect',
    );
  }
  if (parsedRedirect.protocol !== 'https:'
    || parsedRedirect.pathname !== '/nova-palavra-passe'
    || parsedRedirect.searchParams.get('tipo') !== 'convite-coordenacao') {
    throw new BootstrapError(
      'O redirect deve usar HTTPS e terminar em /nova-palavra-passe?tipo=convite-coordenacao.',
      'invalid_redirect',
    );
  }

  return {
    email: normalisedEmail,
    name: normalisedName,
    redirectTo: parsedRedirect.toString(),
  };
}

async function listAllUsers(client) {
  const users = [];
  let page = 1;
  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error || !data || !Array.isArray(data.users)) {
      throw new BootstrapError('Não foi possível verificar as contas existentes.', 'list_users_failed');
    }
    users.push(...data.users);
    if (data.users.length < PAGE_SIZE) return users;
    page += 1;
  }
}

function isAdministrator(user) {
  return user?.app_metadata?.role === 'coordinator'
    && user?.app_metadata?.coord_role === 'administracao';
}

async function compensateUser(client, userId) {
  if (!userId) return false;
  try {
    const { error } = await client.auth.admin.deleteUser(userId);
    return !error;
  } catch (_) {
    return false;
  }
}

async function bootstrapFirstAdmin({
  client,
  email,
  name,
  redirectTo,
  confirm,
  randomUUID = () => crypto.randomUUID(),
}) {
  if (!confirm) {
    throw new BootstrapError(
      'Operação recusada: volte a executar com --confirm depois de rever o ambiente e o email.',
      'confirmation_required',
    );
  }

  const users = await listAllUsers(client);
  if (users.some(isAdministrator)) {
    throw new BootstrapError(
      'Operação recusada: já existe uma conta de administração neste projeto.',
      'administrator_exists',
    );
  }

  const { data: inviteData, error: inviteError } = await client.auth.admin.inviteUserByEmail(email, {
    data: { name },
    redirectTo,
  });
  const userId = inviteData?.user?.id;
  if (inviteError || !userId) {
    throw new BootstrapError('Não foi possível enviar o convite inicial.', 'invite_failed');
  }

  const { error: metadataError } = await client.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...(inviteData.user.app_metadata || {}),
      role: 'coordinator',
      coord_role: 'administracao',
      authorization_version: randomUUID(),
    },
  });

  if (metadataError) {
    const compensated = await compensateUser(client, userId);
    throw new BootstrapError(
      compensated
        ? 'Não foi possível aplicar as permissões; a conta convidada foi removida.'
        : 'Não foi possível aplicar as permissões nem confirmar a remoção da conta. Reveja o Auth manualmente.',
      compensated ? 'metadata_failed_compensated' : 'metadata_failed_cleanup_required',
    );
  }

  return { userId, email };
}

function maskEmail(email) {
  const [local, domain] = String(email).split('@');
  if (!domain) return '<email>';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

async function runCli(argv = process.argv.slice(2), env = process.env, logger = console) {
  const args = parseArgs(argv);
  if (args.help) {
    logger.log(usage());
    return 0;
  }
  if (!args.confirm) {
    throw new BootstrapError(
      'Operação recusada: volte a executar com --confirm depois de rever o ambiente e o email.',
      'confirmation_required',
    );
  }

  const dotenv = require('dotenv');
  dotenv.config({
    path: path.join(__dirname, '..', `.env.${env.NODE_ENV || 'development'}`),
  });

  const supabaseUrl = String(env.SUPABASE_URL || '').trim();
  const serviceKey = String(env.SUPABASE_SERVICE_KEY || '').trim();
  if (!supabaseUrl || !serviceKey) {
    throw new BootstrapError(
      'SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórias.',
      'missing_supabase_config',
    );
  }
  let parsedSupabaseUrl;
  try {
    parsedSupabaseUrl = new URL(supabaseUrl);
  } catch (_) {
    throw new BootstrapError('SUPABASE_URL não é válido.', 'invalid_supabase_url');
  }
  if (parsedSupabaseUrl.protocol !== 'https:') {
    throw new BootstrapError('SUPABASE_URL deve usar HTTPS.', 'invalid_supabase_url');
  }

  const input = normaliseInput({
    email: args.email || env.FIRST_ADMIN_EMAIL,
    name: args.name || env.FIRST_ADMIN_NAME,
    redirectUrl: args.redirectUrl || env.COORDINATOR_INVITE_REDIRECT_URL,
    publicAppUrl: env.PUBLIC_APP_URL,
  });

  const { createClient } = require('@supabase/supabase-js');
  const client = createClient(parsedSupabaseUrl.toString(), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await bootstrapFirstAdmin({
    client,
    ...input,
    confirm: args.confirm,
  });

  logger.log(`Convite inicial enviado com segurança para ${maskEmail(input.email)}.`);
  logger.log('A pessoa convidada deve definir a password e configurar TOTP no primeiro acesso.');
  return 0;
}

async function main() {
  try {
    process.exitCode = await runCli();
  } catch (error) {
    const message = error instanceof BootstrapError
      ? error.message
      : 'Falha inesperada no bootstrap. Reveja o projeto Auth sem expor segredos.';
    console.error(`Bootstrap não concluído: ${message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  BootstrapError,
  PAGE_SIZE,
  bootstrapFirstAdmin,
  isAdministrator,
  listAllUsers,
  maskEmail,
  normaliseInput,
  parseArgs,
  runCli,
  usage,
};
