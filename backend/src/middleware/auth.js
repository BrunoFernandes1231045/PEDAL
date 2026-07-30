const supabase = require('../db/supabase');

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return {};
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch (_) {
    return {};
  }
}

function coordinatorMfaRequired() {
  // Produção nunca pode desativar MFA por engano através de configuração.
  // O bypass explícito existe apenas para desenvolvimento/testes locais.
  return process.env.NODE_ENV === 'production'
    || process.env.COORDINATOR_MFA_REQUIRED !== 'false';
}

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token em falta' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Token inválido' });

  const claims = decodeJwtPayload(token);
  const currentAuthorizationVersion = user.app_metadata?.authorization_version;
  const tokenAuthorizationVersion = claims.app_metadata?.authorization_version;
  if (currentAuthorizationVersion && tokenAuthorizationVersion !== currentAuthorizationVersion) {
    return res.status(401).json({
      error: 'As permissões desta conta foram alteradas. Inicie sessão novamente.',
      code: 'session_stale',
    });
  }

  // role/coord_role vêm de app_metadata, não de user_metadata — só o backend
  // (com a service_role key) consegue escrever em app_metadata; o próprio
  // utilizador não o consegue alterar via supabase.auth.updateUser().
  req.user = { id: user.id, role: user.app_metadata?.role || 'candidate', coord_role: user.app_metadata?.coord_role || 'coordenacao' };
  req.authAal = claims.aal || 'aal1';
  // Algumas rotas aceitam candidatos e coordenadores no mesmo handler e não
  // passam por requireCoordinator. A verificação vive também aqui para que
  // nenhum acesso de coordenação contorne AAL2.
  if (req.user.role === 'coordinator' && coordinatorMfaRequired() && req.authAal !== 'aal2') {
    return res.status(403).json({
      error: 'É necessária autenticação de dois fatores para aceder à coordenação.',
      code: 'mfa_required',
    });
  }
  next();
}

function requireCoordinator(req, res, next) {
  if (req.user?.role !== 'coordinator') {
    return res.status(403).json({ error: 'Acesso reservado a coordenadores' });
  }
  if (coordinatorMfaRequired() && req.authAal !== 'aal2') {
    return res.status(403).json({
      error: 'É necessária autenticação de dois fatores para aceder à coordenação.',
      code: 'mfa_required',
    });
  }
  next();
}

function requireRole(roles) {
  return (req, res, next) => {
    const coordRole = req.user?.coord_role || 'coordenacao';
    if (!roles.includes(coordRole)) {
      return res.status(403).json({ error: 'Acesso não autorizado para este papel' });
    }
    next();
  };
}

// Resolve o candidate_id do próprio utilizador autenticado a partir da sessão
// (candidates.user_id === req.user.id) — nunca a partir de um ID enviado pelo
// cliente. Coordenadores não têm um "próprio candidato", por isso ficam com
// req.ownCandidateId === null e continuam a ser tratados à parte nas rotas.
// Corrige o IDOR de PED-58: comparar req.user.id (auth user) diretamente com
// um candidate_id (chave da tabela candidates) nunca foi a comparação certa.
async function attachOwnCandidateId(req, res, next) {
  if (req.user.role === 'coordinator') { req.ownCandidateId = null; return next(); }
  const { data } = await supabase.from('candidates').select('id').eq('user_id', req.user.id).maybeSingle();
  req.ownCandidateId = data ? data.id : null;
  next();
}

module.exports = { requireAuth, requireCoordinator, requireRole, attachOwnCandidateId, decodeJwtPayload, coordinatorMfaRequired };
