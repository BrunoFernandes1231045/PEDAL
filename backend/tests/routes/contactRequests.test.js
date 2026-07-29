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
let mockUser = { id: 'coord-1', role: 'coordinator' };
jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => {
    req.user = mockUser;
    next();
  },
  requireCoordinator: (req, res, next) => next(),
  requireRole: () => (req, res, next) => next(),
  attachOwnCandidateId: (req, res, next) => { req.ownCandidateId = mockUser.role === 'coordinator' ? null : mockUser.id; next(); },
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

describe('GET /api/contact-requests', () => {
  it('returns pending requests', async () => {
    supabase.from().eq.mockResolvedValue({
      data: [{ id: 'cr-1', status: 'pending' }], error: null,
    });
    mockUser = { id: 'coord-1', role: 'coordinator' };
    const res = await request(app)
      .get('/api/contact-requests').set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body[0].status).toBe('pending');
  });
});

describe('POST /api/contact-requests', () => {
  beforeEach(() => {
    mockUser = { id: 'cand-1', role: 'candidate' };
  });

  it('creates request and returns 201', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 'cr-2', status: 'pending' }, error: null,
    });
    const res = await request(app)
      .post('/api/contact-requests').set('Authorization', 'Bearer valid-token')
      .send({ candidate_id: 'cand-1', question: 'Como funciona?' });
    expect(res.status).toBe(201);
  });

  it('returns 400 when question missing', async () => {
    const res = await request(app)
      .post('/api/contact-requests').set('Authorization', 'Bearer valid-token')
      .send({ candidate_id: 'cand-1' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/contact-requests/:id', () => {
  it('answers a request', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 'cr-1', status: 'answered', answer: 'Resposta aqui' }, error: null,
    });
    const res = await request(app)
      .patch('/api/contact-requests/cr-1').set('Authorization', 'Bearer valid-token')
      .send({ answer: 'Resposta aqui' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('answered');
  });

  it('returns 400 when answer missing', async () => {
    const res = await request(app)
      .patch('/api/contact-requests/cr-1').set('Authorization', 'Bearer valid-token')
      .send({});
    expect(res.status).toBe(400);
  });
});
