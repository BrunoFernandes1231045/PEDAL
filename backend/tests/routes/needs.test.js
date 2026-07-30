jest.mock('../../src/db/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
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
  chain.upsert.mockReturnThis();
  chain.eq.mockReturnThis();
});

describe('GET /api/needs', () => {
  it('returns needs', async () => {
    supabase.from().maybeSingle.mockResolvedValue({
      data: { value: { Porto: { Manhã: 2 } } }, error: null,
    });
    const res = await request(app)
      .get('/api/needs').set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ Porto: { Manhã: 2 } });
  });
});

describe('PUT /api/needs', () => {
  it('replaces the needs schedule', async () => {
    supabase.from().single.mockResolvedValue({
      data: { value: { Porto: { Manhã: 3 } } }, error: null,
    });
    const res = await request(app)
      .put('/api/needs').set('Authorization', 'Bearer valid-token')
      .send({ Porto: { Manhã: 3 } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ Porto: { Manhã: 3 } });
    expect(supabase.from().upsert).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'needs_schedule', value: { Porto: { Manhã: 3 } } }),
      { onConflict: 'key' },
    );
  });
});
