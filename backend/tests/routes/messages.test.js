jest.mock('../../src/db/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };
  return { from: jest.fn(() => chain) };
});
jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = { id: 'cand-1', role: 'candidate' }; next(); },
  requireCoordinator: (req, res, next) => next(),
}));

const request = require('supertest');
const app = require('../../src/app');
const supabase = require('../../src/db/supabase');

beforeEach(() => { jest.clearAllMocks(); });

describe('GET /api/candidates/:id/messages', () => {
  it('returns messages ordered by created_at', async () => {
    supabase.from().order.mockResolvedValue({
      data: [{ id: 'msg-1', role: 'assistant', content: 'Olá!' }], error: null,
    });
    const res = await request(app)
      .get('/api/candidates/cand-1/messages')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body[0].content).toBe('Olá!');
  });
});

describe('POST /api/candidates/:id/messages', () => {
  it('adds a message and returns 201', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 'msg-2', role: 'user', content: 'Tenho dúvidas' }, error: null,
    });
    const res = await request(app)
      .post('/api/candidates/cand-1/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ role: 'user', content: 'Tenho dúvidas' });
    expect(res.status).toBe(201);
    expect(res.body.content).toBe('Tenho dúvidas');
  });

  it('returns 400 when role or content missing', async () => {
    const res = await request(app)
      .post('/api/candidates/cand-1/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({ role: 'user' });
    expect(res.status).toBe(400);
  });
});
