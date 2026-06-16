jest.mock('../../src/db/supabase', () => {
  const chain = { select: jest.fn().mockReturnThis() };
  return { from: jest.fn(() => chain) };
});
jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = { id: 'coord-1', role: 'coordinator' }; next(); },
  requireCoordinator: (req, res, next) => next(),
}));

const request = require('supertest');
const app = require('../../src/app');
const supabase = require('../../src/db/supabase');

beforeEach(() => { jest.clearAllMocks(); });

describe('GET /api/dashboard/stats', () => {
  it('returns aggregated stats', async () => {
    supabase.from().select.mockResolvedValue({
      data: [
        { stage: 'inscricao' },
        { stage: 'triagem' },
        { stage: 'triagem' },
        { stage: 'ativo' },
      ],
      error: null,
    });
    const res = await request(app)
      .get('/api/dashboard/stats').set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.totalCandidates).toBe(4);
    expect(res.body.byStage.triagem).toBe(2);
    expect(res.body.byStage.ativo).toBe(1);
    expect(res.body.activeCount).toBe(1);
  });
});
