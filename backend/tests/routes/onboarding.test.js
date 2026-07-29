const mockCandidateIds = { 'user-a': 'cand-a', 'user-b': 'cand-b' };
let mockUser = { id: 'user-a', role: 'candidate' };

jest.mock('../../src/db/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
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

describe('ownership de /api/candidates/:id/onboarding (PED-58)', () => {
  const calls = [
    ['GET', (id) => request(app).get(`/api/candidates/${id}/onboarding`)],
    ['PATCH onboarding', (id) => request(app).patch(`/api/candidates/${id}/onboarding`).send({ formalization_data: { nif: '123' } })],
    ['PATCH progress', (id) => request(app).patch(`/api/candidates/${id}/onboarding/progress/2`).send({ completed: true })],
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

describe('GET /api/candidates/:id/onboarding', () => {
  it('devolve os dados do próprio candidato', async () => {
    supabase.__chain.single.mockResolvedValue({
      data: { id: 'onb-1', candidate_id: 'cand-a', practical_date: null },
      error: null,
    });

    const res = await request(app)
      .get('/api/candidates/cand-a/onboarding')
      .set('Authorization', 'Bearer token-a');

    expect(res.status).toBe(200);
    expect(res.body.candidate_id).toBe('cand-a');
  });
});

describe('PATCH /api/candidates/:id/onboarding/progress/:moduleId', () => {
  it('deriva candidate_id do URL autorizado e aceita apenas completed', async () => {
    supabase.__chain.single.mockResolvedValue({
      data: { candidate_id: 'cand-a', module_id: 2, completed: true },
      error: null,
    });

    const res = await request(app)
      .patch('/api/candidates/cand-a/onboarding/progress/2')
      .set('Authorization', 'Bearer token-a')
      .send({ candidate_id: 'cand-b', completed: true, completed_at: '1900-01-01' });

    expect(res.status).toBe(200);
    expect(supabase.__chain.upsert).toHaveBeenCalledWith(expect.objectContaining({
      candidate_id: 'cand-a',
      module_id: 2,
      completed: true,
    }));
    expect(supabase.__chain.upsert.mock.calls[0][0].completed_at).toBeInstanceOf(Date);
  });

  it('rejeita módulo fora do intervalo e completed não booleano', async () => {
    const badModule = await request(app)
      .patch('/api/candidates/cand-a/onboarding/progress/99')
      .set('Authorization', 'Bearer token-a')
      .send({ completed: true });
    const badCompleted = await request(app)
      .patch('/api/candidates/cand-a/onboarding/progress/2')
      .set('Authorization', 'Bearer token-a')
      .send({ completed: 'true' });

    expect(badModule.status).toBe(400);
    expect(badCompleted.status).toBe(400);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/candidates/:id/onboarding', () => {
  it('permite ao candidato apenas os seus dados de formalização e impede overwrite de candidate_id', async () => {
    supabase.__chain.single.mockResolvedValue({
      data: { candidate_id: 'cand-a', formalization_data: { nif: '123' } },
      error: null,
    });

    const res = await request(app)
      .patch('/api/candidates/cand-a/onboarding')
      .set('Authorization', 'Bearer token-a')
      .send({
        candidate_id: 'cand-b',
        formalization_data: { nif: '123' },
      });

    expect(res.status).toBe(200);
    const payload = supabase.__chain.upsert.mock.calls[0][0];
    expect(payload.candidate_id).toBe('cand-a');
    expect(payload.formalization_data).toEqual({ nif: '123' });
    expect(payload).not.toHaveProperty('id');
  });

  it('bloqueia campos de planeamento reservados à coordenação', async () => {
    const res = await request(app)
      .patch('/api/candidates/cand-a/onboarding')
      .set('Authorization', 'Bearer token-a')
      .send({ practical_date: '2026-09-01', scheduling: [{ date: '2026-09-01' }] });

    expect(res.status).toBe(400);
    expect(res.body.fields).toEqual(expect.arrayContaining(['practical_date', 'scheduling']));
    expect(supabase.__chain.upsert).not.toHaveBeenCalled();
  });

  it('permite à coordenação atualizar os campos de planeamento', async () => {
    mockUser = { id: 'coord-1', role: 'coordinator', coord_role: 'coordenacao' };
    supabase.__chain.single.mockResolvedValue({
      data: { candidate_id: 'cand-b', practical_date: '2026-09-01' },
      error: null,
    });

    const res = await request(app)
      .patch('/api/candidates/cand-b/onboarding')
      .set('Authorization', 'Bearer coord-token')
      .send({ practical_date: '2026-09-01', scheduling: [{ date: '2026-09-01' }] });

    expect(res.status).toBe(200);
    expect(supabase.__chain.upsert).toHaveBeenCalledWith(expect.objectContaining({
      candidate_id: 'cand-b',
      practical_date: '2026-09-01',
      scheduling: [{ date: '2026-09-01' }],
    }));
  });

  it('rejeita um corpo sem campos autorizados', async () => {
    const res = await request(app)
      .patch('/api/candidates/cand-a/onboarding')
      .set('Authorization', 'Bearer token-a')
      .send({ candidate_id: 'cand-b', created_at: '1900-01-01' });

    expect(res.status).toBe(400);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
