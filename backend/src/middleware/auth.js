const supabase = require('../db/supabase');

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token em falta' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Token inválido' });

  req.user = { id: user.id, role: user.user_metadata?.role || 'candidate', coord_role: user.user_metadata?.coord_role || 'coordenacao' };
  next();
}

function requireCoordinator(req, res, next) {
  if (req.user?.role !== 'coordinator') {
    return res.status(403).json({ error: 'Acesso reservado a coordenadores' });
  }
  next();
}

module.exports = { requireAuth, requireCoordinator };
