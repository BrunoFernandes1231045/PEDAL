const mockCandidateIds = { 'user-a': 'cand-a', 'user-b': 'cand-b' };
let mockUser = { id: 'user-a', role: 'candidate', coord_role: 'coordenacao' };

jest.mock('../../src/db/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn(),
    maybeSingle: jest.fn(),
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
  mockUser = { id: 'user-a', role: 'candidate', coord_role: 'coordenacao' };
});

describe('GET /api/notifications', () => {
  it('bloqueia candidatos', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', 'Bearer token-a');

    expect(res.status).toBe(403);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('permite o feed apenas à coordenação', async () => {
    mockUser = { id: 'coord-1', role: 'coordinator', coord_role: 'coordenacao' };
    supabase.__chain.limit.mockResolvedValue({ data: [{ id: 'notif-1' }], error: null });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', 'Bearer coord-token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'notif-1' }]);
  });
});

describe('POST /api/notifications — identidade e ownership (PED-58)', () => {
  test.each([
    ['user-a', 'cand-b'],
    ['user-b', 'cand-a'],
  ])('bloqueia referência do utilizador %s ao outro candidato', async (userId, foreignCandidateId) => {
    mockUser = { id: userId, role: 'candidate', coord_role: 'coordenacao' };

    const res = await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer token-${userId}`)
      .send({ candidate_id: foreignCandidateId, type: 'concluido', who: 'Nome falso', text: 'Terminou' });

    expect(res.status).toBe(403);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('deriva candidate_id e who da relação autenticada do candidato', async () => {
    supabase.__chain.maybeSingle.mockResolvedValue({
      data: { name: 'Candidata A', stage: 'pratica' },
      error: null,
    });
    supabase.__chain.single.mockResolvedValue({
      data: { id: 'notif-1', candidate_id: 'cand-a', who: 'Candidata A' },
      error: null,
    });

    const res = await request(app)
      .post('/api/notifications')
      .set('Authorization', 'Bearer token-a')
      .send({
        candidate_id: 'cand-a',
        type: 'concluido',
        who: 'Candidato B',
        text: '  concluiu o módulo  ',
        created_at: '1900-01-01',
      });

    expect(res.status).toBe(201);
    expect(supabase.__chain.insert).toHaveBeenCalledWith({
      candidate_id: 'cand-a',
      type: 'concluido',
      who: 'Candidata A',
      text: 'concluiu o onboarding e aguarda a formação prática',
    });
  });

  it('valida e deriva who a partir do candidato escolhido por um coordenador', async () => {
    mockUser = { id: 'coord-1', role: 'coordinator', coord_role: 'coordenacao' };
    supabase.__chain.maybeSingle.mockResolvedValue({
      data: { name: 'Candidato B', stage: 'onboarding' },
      error: null,
    });
    supabase.__chain.single.mockResolvedValue({
      data: { id: 'notif-2', candidate_id: 'cand-b', who: 'Candidato B' },
      error: null,
    });

    const res = await request(app)
      .post('/api/notifications')
      .set('Authorization', 'Bearer coord-token')
      .send({ candidate_id: 'cand-b', type: 'validado', who: 'Nome falso', text: 'Validado' });

    expect(res.status).toBe(201);
    expect(supabase.__chain.insert).toHaveBeenCalledWith({
      candidate_id: 'cand-b',
      type: 'validado',
      who: 'Candidato B',
      text: 'Validado',
    });
  });

  it('rejeita candidato inexistente escolhido pela coordenação', async () => {
    mockUser = { id: 'coord-1', role: 'coordinator', coord_role: 'coordenacao' };
    supabase.__chain.maybeSingle.mockResolvedValue({ data: null, error: null });

    const res = await request(app)
      .post('/api/notifications')
      .set('Authorization', 'Bearer coord-token')
      .send({ candidate_id: 'cand-inexistente', type: 'validado', text: 'Validado' });

    expect(res.status).toBe(404);
    expect(supabase.__chain.insert).not.toHaveBeenCalled();
  });

  it('impede um candidato de forjar um evento administrativo', async () => {
    supabase.__chain.maybeSingle.mockResolvedValue({
      data: { name: 'Candidata A', stage: 'validacao' },
      error: null,
    });

    const res = await request(app)
      .post('/api/notifications')
      .set('Authorization', 'Bearer token-a')
      .send({ candidate_id: 'cand-a', type: 'validado', text: 'Fui validada' });

    expect(res.status).toBe(403);
    expect(supabase.__chain.insert).not.toHaveBeenCalled();
  });

  it('rejeita uma notificação incompatível com o estado atual', async () => {
    supabase.__chain.maybeSingle.mockResolvedValue({
      data: { name: 'Candidata A', stage: 'inscricao' },
      error: null,
    });

    const res = await request(app)
      .post('/api/notifications')
      .set('Authorization', 'Bearer token-a')
      .send({ candidate_id: 'cand-a', type: 'ativo', text: 'Já estou ativa' });

    expect(res.status).toBe(403);
    expect(supabase.__chain.insert).not.toHaveBeenCalled();
  });
});
