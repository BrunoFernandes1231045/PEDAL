const express = require('express');
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

function genPassword() {
  const words = ['pedal', 'bici', 'porto', 'piloto', 'rota', 'vento'];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${word}${num}`;
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
    .filter((u) => u.user_metadata?.role === 'coordinator')
    .map((u) => ({
      id: u.id,
      name: u.user_metadata?.name || u.email,
      email: u.email,
      phone: u.user_metadata?.phone || '',
      coordRole: u.user_metadata?.coord_role || 'coordenacao',
      role: ROLE_DISPLAY[u.user_metadata?.coord_role] || 'Coordenação',
      createdAt: u.created_at?.slice(0, 10) || '',
    }));

  res.json(coordinators);
});

// POST /api/coord-users — criar conta (só administracao pode)
router.post('/', requireAuth, requireCoordinator, requireRole(['administracao']), async (req, res) => {
  const { name, email, phone, role } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name e email são obrigatórios' });

  const coordRole = ROLE_MAP[role] || 'coordenacao';
  const tempPassword = genPassword();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    user_metadata: { role: 'coordinator', coord_role: coordRole, name, phone: phone || '' },
    email_confirm: true,
  });

  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json({ id: data.user.id, name, email, phone, role: ROLE_DISPLAY[coordRole] || role, coordRole, tempPassword });
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
    user_metadata: { ...user.user_metadata, coord_role: coordRole },
  });

  if (error) return res.status(500).json({ error: error.message });

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
