jest.mock('../../src/db/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };
  return { from: jest.fn(() => chain) };
});
jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = { id: 'cand-1', role: 'candidate' }; next(); },
  requireCoordinator: (req, res, next) => next(),
  requireRole: () => (req, res, next) => next(),
  attachOwnCandidateId: (req, res, next) => { req.ownCandidateId = req.user.role === 'coordinator' ? null : req.user.id; next(); },
}));

const request = require('supertest');
const app = require('../../src/app');
const supabase = require('../../src/db/supabase');

beforeEach(() => { jest.clearAllMocks(); });

describe('GET /api/candidates/:id/onboarding', () => {
  it('returns onboarding data', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 'onb-1', candidate_id: 'cand-1', practical_date: null }, error: null,
    });
    const res = await request(app)
      .get('/api/candidates/cand-1/onboarding')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.candidate_id).toBe('cand-1');
  });
});

describe('PATCH /api/candidates/:id/onboarding/progress/:moduleId', () => {
  it('marks module as complete', async () => {
    supabase.from().single.mockResolvedValue({
      data: { candidate_id: 'cand-1', module_id: 2, completed: true }, error: null,
    });
    const res = await request(app)
      .patch('/api/candidates/cand-1/onboarding/progress/2')
      .set('Authorization', 'Bearer valid-token')
      .send({ completed: true });
    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(true);
  });
});
