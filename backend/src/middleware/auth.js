const supabase = require('../db/supabase');

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token em falta' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Token inválido' });

  // role/coord_role vêm de app_metadata, não de user_metadata — só o backend
  // (com a service_role key) consegue escrever em app_metadata; o próprio
  // utilizador não o consegue alterar via supabase.auth.updateUser().
  req.user = { id: user.id, role: user.app_metadata?.role || 'candidate', coord_role: user.app_metadata?.coord_role || 'coordenacao' };
  next();
}

function requireCoordinator(req, res, next) {
  if (req.user?.role !== 'coordinator') {
    return res.status(403).json({ error: 'Acesso reservado a coordenadores' });
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

module.exports = { requireAuth, requireCoordinator, requireRole, attachOwnCandidateId };
