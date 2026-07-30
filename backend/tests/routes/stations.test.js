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

beforeEach(() => {
  jest.clearAllMocks();
  const chain = supabase.from();
  chain.select.mockReturnThis();
  chain.insert.mockReturnThis();
  chain.update.mockReturnThis();
    chain.delete.mockReturnThis();
    chain.eq.mockReturnThis();
    chain.order.mockReset();
});

describe('GET /api/stations', () => {
  it('returns stations', async () => {
    supabase.from().order.mockResolvedValue({
      data: [{ id: 'st-1', name: 'Parque das Marinhas' }], error: null,
    });
    const res = await request(app)
      .get('/api/stations').set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('POST /api/stations', () => {
  it('creates station and returns 201', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 'st-2', name: 'Jardim do Morro' }, error: null,
    });
    const res = await request(app)
      .post('/api/stations').set('Authorization', 'Bearer valid-token')
      .send({ name: 'Jardim do Morro', address: 'Rua X' });
    expect(res.status).toBe(201);
  });

  it('returns 400 when name missing', async () => {
    const res = await request(app)
      .post('/api/stations').set('Authorization', 'Bearer valid-token').send({});
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/stations/:id', () => {
  it('deletes station and returns 204', async () => {
    supabase.from().eq.mockResolvedValue({ error: null });
    const res = await request(app)
      .delete('/api/stations/st-1').set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(204);
  });
});
