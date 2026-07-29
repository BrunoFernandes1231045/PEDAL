const mockCandidateIds = { 'user-a': 'cand-a', 'user-b': 'cand-b' };
let mockUser = { id: 'coord-1', role: 'coordinator', coord_role: 'coordenacao' };

jest.mock('../../src/db/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };
  return { from: jest.fn(() => chain), __chain: chain };
});
jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = mockUser; next(); },
  requireCoordinator: (req, res, next) => {
    if (req.user.role !== 'coordinator') return res.status(403).json({ error: 'Acesso reservado a coordenadores' });
    next();
  },
  requireRole: () => (req, res, next) => next(),
  attachOwnCandidateId: (req, res, next) => {
    req.ownCandidateId = mockUser.role === 'coordinator' ? null : mockCandidateIds[mockUser.id];
    next();
  },
}));

const request = require('supertest');
const app = require('../../src/app');
const supabase = require('../../src/db/supabase');

beforeEach(() => {
  jest.clearAllMocks();
  supabase.__chain.select.mockReturnThis();
  supabase.__chain.insert.mockReturnThis();
  supabase.__chain.update.mockReturnThis();
  supabase.__chain.eq.mockReturnThis();
  supabase.__chain.order.mockReturnThis();
  mockUser = { id: 'coord-1', role: 'coordinator', coord_role: 'coordenacao' };
});

describe('GET /api/contact-requests', () => {
  it('permite à coordenação listar todos os pedidos', async () => {
    supabase.__chain.order.mockResolvedValue({
      data: [{ id: 'cr-1', status: 'pending' }],
      error: null,
    });

    const res = await request(app)
      .get('/api/contact-requests')
      .set('Authorization', 'Bearer coord-token');

    expect(res.status).toBe(200);
    expect(res.body[0].status).toBe('pending');
  });

  test.each([
    ['user-a', 'cand-a'],
    ['user-b', 'cand-b'],
  ])('filtra os pedidos pelo candidato da sessão (%s)', async (userId, ownCandidateId) => {
    mockUser = { id: userId, role: 'candidate', coord_role: 'coordenacao' };
    supabase.__chain.eq.mockResolvedValue({
      data: [{ id: `request-${ownCandidateId}`, candidate_id: ownCandidateId }],
      error: null,
    });

    const res = await request(app)
      .get('/api/contact-requests')
      .set('Authorization', `Bearer token-${userId}`);

    expect(res.status).toBe(200);
    expect(supabase.__chain.eq).toHaveBeenCalledWith('candidate_id', ownCandidateId);
  });

  test.each([
    ['user-a', 'cand-b'],
    ['user-b', 'cand-a'],
  ])('bloqueia filtro explícito do utilizador %s para outro candidato', async (userId, foreignCandidateId) => {
    mockUser = { id: userId, role: 'candidate', coord_role: 'coordenacao' };

    const res = await request(app)
      .get(`/api/contact-requests?candidate_id=${foreignCandidateId}`)
      .set('Authorization', `Bearer token-${userId}`);

    expect(res.status).toBe(403);
    expect(supabase.__chain.eq).not.toHaveBeenCalled();
  });
});

describe('POST /api/contact-requests — ownership (PED-58)', () => {
  test.each([
    ['user-a', 'cand-b'],
    ['user-b', 'cand-a'],
  ])('bloqueia submissão do utilizador %s em nome de outro candidato', async (userId, foreignCandidateId) => {
    mockUser = { id: userId, role: 'candidate', coord_role: 'coordenacao' };

    const res = await request(app)
      .post('/api/contact-requests')
      .set('Authorization', `Bearer token-${userId}`)
      .send({ candidate_id: foreignCandidateId, question: 'Como funciona?' });

    expect(res.status).toBe(403);
    expect(supabase.__chain.insert).not.toHaveBeenCalled();
  });

  it('cria o pedido com candidate_id derivado da sessão e allowlist', async () => {
    mockUser = { id: 'user-a', role: 'candidate', coord_role: 'coordenacao' };
    supabase.__chain.single.mockResolvedValue({
      data: { id: 'cr-2', candidate_id: 'cand-a', status: 'pending' },
      error: null,
    });

    const res = await request(app)
      .post('/api/contact-requests')
      .set('Authorization', 'Bearer token-a')
      .send({
        candidate_id: 'cand-a',
        question: '  Como funciona?  ',
        module_id: 2,
        answer: 'Resposta forjada',
        status: 'answered',
        answered_by: 'Eu próprio',
      });

    expect(res.status).toBe(201);
    expect(supabase.__chain.insert).toHaveBeenCalledWith({
      candidate_id: 'cand-a',
      question: 'Como funciona?',
      module_id: 2,
    });
  });

  it('rejeita module_id inválido', async () => {
    mockUser = { id: 'user-a', role: 'candidate', coord_role: 'coordenacao' };

    const res = await request(app)
      .post('/api/contact-requests')
      .set('Authorization', 'Bearer token-a')
      .send({ question: 'Dúvida', module_id: 99 });

    expect(res.status).toBe(400);
    expect(supabase.__chain.insert).not.toHaveBeenCalled();
  });

  it('bloqueia coordenadores de submeter dúvidas', async () => {
    const res = await request(app)
      .post('/api/contact-requests')
      .set('Authorization', 'Bearer coord-token')
      .send({ question: 'Dúvida' });

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/contact-requests/:id — identidade segura', () => {
  it('deriva answered_by da função autenticada, ignorando o corpo', async () => {
    mockUser = { id: 'admin-1', role: 'coordinator', coord_role: 'administracao' };
    supabase.__chain.single.mockResolvedValue({
      data: { id: 'cr-1', status: 'answered', answer: 'Resposta aqui', answered_by: 'Administração' },
      error: null,
    });

    const res = await request(app)
      .patch('/api/contact-requests/cr-1')
      .set('Authorization', 'Bearer admin-token')
      .send({
        answer: '  Resposta aqui  ',
        answered_by: 'Outra pessoa',
        status: 'pending',
        candidate_id: 'cand-b',
      });

    expect(res.status).toBe(200);
    expect(supabase.__chain.update).toHaveBeenCalledWith(expect.objectContaining({
      answer: 'Resposta aqui',
      answered_by: 'Administração',
      status: 'answered',
    }));
    expect(supabase.__chain.update.mock.calls[0][0]).not.toHaveProperty('candidate_id');
  });

  it('mantém o atalho de resolver sem resposta livre', async () => {
    supabase.__chain.single.mockResolvedValue({
      data: { id: 'cr-1', status: 'answered', answer: 'Resolvido pela coordenação.' },
      error: null,
    });

    const res = await request(app)
      .patch('/api/contact-requests/cr-1')
      .set('Authorization', 'Bearer coord-token')
      .send({});

    expect(res.status).toBe(200);
    expect(supabase.__chain.update).toHaveBeenCalledWith(expect.objectContaining({
      answer: 'Resolvido pela coordenação.',
      answered_by: 'Coordenação',
    }));
  });

  it('bloqueia candidatos', async () => {
    mockUser = { id: 'user-a', role: 'candidate', coord_role: 'coordenacao' };

    const res = await request(app)
      .patch('/api/contact-requests/cr-1')
      .set('Authorization', 'Bearer token-a')
      .send({ answer: 'Resposta forjada' });

    expect(res.status).toBe(403);
    expect(supabase.__chain.update).not.toHaveBeenCalled();
  });
});
