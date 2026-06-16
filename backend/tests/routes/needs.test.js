jest.mock('../../src/db/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };
  return { from: jest.fn(() => chain) };
});
jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = { id: 'coord-1', role: 'coordinator' }; next(); },
  requireCoordinator: (req, res, next) => next(),
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
  chain.eq.mockReturnThis();
});

describe('GET /api/needs', () => {
  it('returns needs', async () => {
    supabase.from().select.mockResolvedValue({
      data: [{ id: 'n-1', status: 'open' }], error: null,
    });
    const res = await request(app)
      .get('/api/needs').set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body[0].status).toBe('open');
  });
});

describe('POST /api/needs', () => {
  it('creates need and returns 201', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 'n-2', status: 'open' }, error: null,
    });
    const res = await request(app)
      .post('/api/needs').set('Authorization', 'Bearer valid-token')
      .send({ locality_id: 'loc-1', periods: ['Manhãs'] });
    expect(res.status).toBe(201);
  });
});

describe('PATCH /api/needs/:id', () => {
  it('closes a need', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 'n-1', status: 'closed' }, error: null,
    });
    const res = await request(app)
      .patch('/api/needs/n-1').set('Authorization', 'Bearer valid-token')
      .send({ status: 'closed' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('closed');
  });
});
