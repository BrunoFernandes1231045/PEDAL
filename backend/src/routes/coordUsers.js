const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const supabase = require('../db/supabase');
const { requireAuth, requireCoordinator, requireRole } = require('../middleware/auth');

const ROLE_MAP = {
  'Administração': 'administracao',
  'Coordenação': 'coordenacao',
};

const ROLE_DISPLAY = {
  administracao: 'Administração',
  coordenacao: 'Coordenação',
};

function coordinatorInviteRedirectUrl() {
  const explicitUrl = process.env.COORDINATOR_INVITE_REDIRECT_URL;
  if (explicitUrl) return explicitUrl;
  const publicAppUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, '');
  return publicAppUrl ? `${publicAppUrl}/nova-palavra-passe?tipo=convite-coordenacao` : null;
}

// listUsers() só devolve 50 contas por página — com dezenas de candidatos
// registados (cada um cria uma conta Auth), os coordenadores podem cair
// numa página seguinte e desaparecer desta lista. Percorre todas as páginas.
async function listAllUsers() {
  const all = [];
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    all.push(...data.users);
    if (data.users.length < perPage) break;
    page++;
  }
  return all;
}

// GET /api/coord-users — listar coordenadores (só administracao pode)
router.get('/', requireAuth, requireCoordinator, requireRole(['administracao']), async (req, res) => {
  let allUsers;
  try { allUsers = await listAllUsers(); }
  catch (error) { return res.status(500).json({ error: error.message }); }

  const coordinators = allUsers
    .filter((u) => u.app_metadata?.role === 'coordinator')
    .map((u) => ({
      id: u.id,
      name: u.user_metadata?.name || u.email,
      email: u.email,
      phone: u.user_metadata?.phone || '',
      coordRole: u.app_metadata?.coord_role || 'coordenacao',
      role: ROLE_DISPLAY[u.app_metadata?.coord_role] || 'Coordenação',
      createdAt: u.created_at?.slice(0, 10) || '',
    }));

  res.json(coordinators);
});

// POST /api/coord-users — criar conta (só administracao pode)
router.post('/', requireAuth, requireCoordinator, requireRole(['administracao']), async (req, res) => {
  const { name, email, phone, role } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name e email são obrigatórios' });

  const coordRole = ROLE_MAP[role] || 'coordenacao';
  const redirectTo = coordinatorInviteRedirectUrl();
  if (!redirectTo) {
    return res.status(503).json({
      error: 'Convites não configurados. Defina PUBLIC_APP_URL ou COORDINATOR_INVITE_REDIRECT_URL.',
    });
  }

  // O Supabase envia uma ligação de uso único. Não se gera, devolve nem
  // transmite uma password temporária (PED-59).
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
    data: { name, phone: phone || '' },
    redirectTo,
  });

  if (error) return res.status(500).json({ error: error.message });

  const authorizationVersion = crypto.randomUUID();
  const { error: metadataError } = await supabase.auth.admin.updateUserById(data.user.id, {
    app_metadata: {
      ...(data.user.app_metadata || {}),
      role: 'coordinator',
      coord_role: coordRole,
      authorization_version: authorizationVersion,
    },
  });

  if (metadataError) {
    // Não deixar uma conta convidada sem o papel seguro. A ligação entretanto
    // enviada deixa de ser utilizável porque a conta é removida.
    await supabase.auth.admin.deleteUser(data.user.id);
    return res.status(500).json({ error: 'Não foi possível concluir a criação segura do utilizador.' });
  }

  res.status(201).json({
    id: data.user.id,
    name,
    email: email.trim().toLowerCase(),
    phone,
    role: ROLE_DISPLAY[coordRole] || role,
    coordRole,
    invitationSent: true,
  });
});

// PATCH /api/coord-users/:email — alterar função (só administracao pode)
router.patch('/:email', requireAuth, requireCoordinator, requireRole(['administracao']), async (req, res) => {
  const email = decodeURIComponent(req.params.email);
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: 'role é obrigatório' });

  const coordRole = ROLE_MAP[role];
  if (!coordRole) return res.status(400).json({ error: `Função inválida. Valores aceites: ${Object.keys(ROLE_MAP).join(', ')}` });

  // Encontrar utilizador pelo email
  let allUsers;
  try { allUsers = await listAllUsers(); }
  catch (listError) { return res.status(500).json({ error: listError.message }); }

  const user = allUsers.find((u) => u.email === email);
  if (!user) return res.status(404).json({ error: 'Utilizador não encontrado' });

  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...user.app_metadata,
      coord_role: coordRole,
      authorization_version: crypto.randomUUID(),
    },
  });

  if (error) return res.status(500).json({ error: error.message });

  const { error: sessionError } = await supabase.rpc('invalidate_user_auth_sessions', {
    target_user_id: user.id,
  });
  if (sessionError) {
    return res.status(500).json({
      error: 'A função foi alterada, mas não foi possível terminar as sessões existentes. O utilizador deve iniciar sessão novamente.',
    });
  }

  res.json({ id: user.id, email, coordRole, role: ROLE_DISPLAY[coordRole] });
});

// DELETE /api/coord-users/:email — eliminar conta (só administracao pode)
router.delete('/:email', requireAuth, requireCoordinator, requireRole(['administracao']), async (req, res) => {
  const email = decodeURIComponent(req.params.email);

  let allUsers;
  try { allUsers = await listAllUsers(); }
  catch (listError) { return res.status(500).json({ error: listError.message }); }

  const user = allUsers.find((u) => u.email === email);
  if (!user) return res.status(404).json({ error: 'Utilizador não encontrado' });

  const { error } = await supabase.auth.admin.deleteUser(user.id);
  if (error) return res.status(500).json({ error: error.message });

  res.status(204).send();
});

module.exports = router;
