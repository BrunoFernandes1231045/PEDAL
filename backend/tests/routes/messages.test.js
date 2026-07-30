const mockCandidateIds = { 'user-a': 'cand-a', 'user-b': 'cand-b' };
let mockUser = { id: 'user-a', role: 'candidate' };

jest.mock('../../src/db/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };
  return { from: jest.fn(() => chain), __chain: chain };
});
jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = mockUser; next(); },
  requireCoordinator: (req, res, next) => next(),
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
  mockUser = { id: 'user-a', role: 'candidate' };
});

describe('ownership de /api/candidates/:id/messages (PED-58)', () => {
  const calls = [
    ['GET', (id) => request(app).get(`/api/candidates/${id}/messages`)],
    ['POST', (id) => request(app).post(`/api/candidates/${id}/messages`).send({ content: 'Olá' })],
  ];

  test.each(calls)('%s bloqueia candidato A → candidato B', async (_label, makeRequest) => {
    mockUser = { id: 'user-a', role: 'candidate' };
    const res = await makeRequest('cand-b').set('Authorization', 'Bearer token-a');
    expect(res.status).toBe(403);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test.each(calls)('%s bloqueia candidato B → candidato A', async (_label, makeRequest) => {
    mockUser = { id: 'user-b', role: 'candidate' };
    const res = await makeRequest('cand-a').set('Authorization', 'Bearer token-b');
    expect(res.status).toBe(403);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe('GET /api/candidates/:id/messages', () => {
  it('devolve mensagens do próprio candidato por ordem cronológica', async () => {
    supabase.__chain.order.mockResolvedValue({
      data: [{ id: 'msg-1', role: 'assistant', content: 'Olá!' }],
      error: null,
    });

    const res = await request(app)
      .get('/api/candidates/cand-a/messages')
      .set('Authorization', 'Bearer token-a');

    expect(res.status).toBe(200);
    expect(res.body[0].content).toBe('Olá!');
    expect(supabase.__chain.eq).toHaveBeenCalledWith('candidate_id', 'cand-a');
  });
});

describe('POST /api/candidates/:id/messages', () => {
  it('deriva role=candidate da sessão e ignora campos protegidos', async () => {
    supabase.__chain.single.mockResolvedValue({
      data: { id: 'msg-2', role: 'user', content: 'Tenho dúvidas' },
      error: null,
    });

    const res = await request(app)
      .post('/api/candidates/cand-a/messages')
      .set('Authorization', 'Bearer token-a')
      .send({
        candidate_id: 'cand-b',
        role: 'assistant',
        content: '  Tenho dúvidas  ',
        node: 'formacao',
        created_at: '1900-01-01',
      });

    expect(res.status).toBe(201);
    expect(supabase.__chain.insert).toHaveBeenCalledWith({
      candidate_id: 'cand-a',
      role: 'user',
      content: 'Tenho dúvidas',
      node: 'formacao',
    });
  });

  it('deriva role=assistant para coordenadores', async () => {
    mockUser = { id: 'coord-1', role: 'coordinator', coord_role: 'coordenacao' };
    supabase.__chain.single.mockResolvedValue({
      data: { id: 'msg-3', role: 'assistant', content: 'Resposta' },
      error: null,
    });

    const res = await request(app)
      .post('/api/candidates/cand-b/messages')
      .set('Authorization', 'Bearer coord-token')
      .send({ role: 'user', content: 'Resposta' });

    expect(res.status).toBe(201);
    expect(supabase.__chain.insert).toHaveBeenCalledWith({
      candidate_id: 'cand-b',
      role: 'assistant',
      content: 'Resposta',
      node: null,
    });
  });

  it('rejeita conteúdo vazio', async () => {
    const res = await request(app)
      .post('/api/candidates/cand-a/messages')
      .set('Authorization', 'Bearer token-a')
      .send({ content: '   ', role: 'assistant' });

    expect(res.status).toBe(400);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
