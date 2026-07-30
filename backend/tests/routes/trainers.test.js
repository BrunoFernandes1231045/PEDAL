jest.mock('../../src/db/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn(),
    single: jest.fn(),
  };
  return { from: jest.fn(() => chain) };
});
jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = { id: 'coord-1', role: 'coordinator' }; next(); },
  requireCoordinator: (req, res, next) => next(),
  requireRole: () => (req, res, next) => next(),
  attachOwnCandidateId: (req, res, next) => { req.ownCandidateId = req.user.role === 'coordinator' ? null : req.user.id; next(); },
}));

const request = require('supertest');
const app = require('../../src/app');
const supabase = require('../../src/db/supabase');

beforeEach(() => { jest.clearAllMocks(); });

describe('GET /api/trainers', () => {
  it('returns active trainers', async () => {
    supabase.from().order.mockResolvedValue({
      data: [{ id: 't-1', name: 'Ana Costa', active: true }], error: null,
    });
    const res = await request(app)
      .get('/api/trainers').set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('POST /api/trainers', () => {
  it('creates trainer and returns 201', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 't-2', name: 'João Silva' }, error: null,
    });
    const res = await request(app)
      .post('/api/trainers').set('Authorization', 'Bearer valid-token')
      .send({ name: 'João Silva', specialty: 'Segurança' });
    expect(res.status).toBe(201);
  });

  it('returns 400 when name missing', async () => {
    const res = await request(app)
      .post('/api/trainers').set('Authorization', 'Bearer valid-token').send({});
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/trainers/:id', () => {
  it('deletes trainer and returns 204', async () => {
    supabase.from().eq.mockResolvedValue({ error: null });
    const res = await request(app)
      .delete('/api/trainers/t-1').set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(204);
  });
});
