jest.mock('../../src/db/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };
  return { from: jest.fn(() => chain), auth: { admin: { createUser: jest.fn() } } };
});
jest.mock('../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = { id: 'cand-1', role: 'candidate' }; next(); },
  requireCoordinator: (req, res, next) => next(),
}));

const request = require('supertest');
const app = require('../../src/app');
const supabase = require('../../src/db/supabase');

beforeEach(() => {
  const chain = supabase.from();
  chain.select.mockReset().mockReturnThis();
  chain.insert.mockReset().mockReturnThis();
  chain.update.mockReset().mockReturnThis();
  chain.eq.mockReset().mockReturnThis();
  chain.single.mockReset();
});

describe('POST /api/candidates', () => {
  it('creates candidate and auth user, returns 201', async () => {
    supabase.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } }, error: null,
    });
    supabase.from().single.mockResolvedValue({
      data: { id: 'cand-1', name: 'Maria', email: 'maria@test.com', stage: 'inscricao' },
      error: null,
    });

    const res = await request(app)
      .post('/api/candidates')
      .send({ name: 'Maria', email: 'maria@test.com', dob: '1950-01-01', phone: '912345678' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('cand-1');
    expect(res.body.initialPassword).toBeDefined();
  });

  it('returns 400 when name or email missing', async () => {
    const res = await request(app).post('/api/candidates').send({ name: 'Maria' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/candidates', () => {
  it('returns list of candidates for coordinator', async () => {
    supabase.from().select.mockResolvedValue({
      data: [{ id: 'cand-1', name: 'Maria' }], error: null,
    });
    const res = await request(app)
      .get('/api/candidates')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('GET /api/candidates/:id', () => {
  it('returns candidate data', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 'cand-1', name: 'Maria', stage: 'triagem' }, error: null,
    });
    const res = await request(app)
      .get('/api/candidates/cand-1')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Maria');
  });
});

describe('PATCH /api/candidates/:id', () => {
  it('updates candidate data', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 'cand-1', stage: 'triagem' }, error: null,
    });
    const res = await request(app)
      .patch('/api/candidates/cand-1')
      .set('Authorization', 'Bearer valid-token')
      .send({ stage: 'triagem' });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('triagem');
  });
});

describe('PATCH /api/candidates/:id/formalize', () => {
  it('sets nif, signature and stage to ativo', async () => {
    supabase.from().single.mockResolvedValue({
      data: { id: 'cand-1', stage: 'ativo', nif: '123456789' }, error: null,
    });
    const res = await request(app)
      .patch('/api/candidates/cand-1/formalize')
      .set('Authorization', 'Bearer valid-token')
      .send({ nif: '123456789', signature: 'sig-base64' });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('ativo');
  });

  it('returns 400 when nif or signature missing', async () => {
    const res = await request(app)
      .patch('/api/candidates/cand-1/formalize')
      .set('Authorization', 'Bearer valid-token')
      .send({ nif: '123456789' });
    expect(res.status).toBe(400);
  });
});
