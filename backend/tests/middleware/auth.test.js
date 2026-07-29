jest.mock('../../src/db/supabase', () => ({
  auth: { getUser: jest.fn() },
}));

const supabase = require('../../src/db/supabase');
const { requireAuth, requireCoordinator } = require('../../src/middleware/auth');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('requireAuth', () => {
  it('returns 401 when no Authorization header', async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is invalid', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid') });
    const req = { headers: { authorization: 'Bearer bad-token' } };
    const res = mockRes();
    const next = jest.fn();
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('sets req.user and calls next when token is valid', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', app_metadata: { role: 'candidate' } } },
      error: null,
    });
    const req = { headers: { authorization: 'Bearer valid-token' } };
    const res = mockRes();
    const next = jest.fn();
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 'user-123', role: 'candidate', coord_role: 'coordenacao' });
  });

  // PED-61: user_metadata é editável pelo próprio utilizador via
  // supabase.auth.updateUser() — nunca pode decidir permissões.
  it('ignores role/coord_role vindos de user_metadata (PED-61)', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123', user_metadata: { role: 'coordinator', coord_role: 'administracao' }, app_metadata: {} } },
      error: null,
    });
    const req = { headers: { authorization: 'Bearer valid-token' } };
    const res = mockRes();
    const next = jest.fn();
    await requireAuth(req, res, next);
    expect(req.user).toEqual({ id: 'user-123', role: 'candidate', coord_role: 'coordenacao' });
  });
});

describe('requireCoordinator', () => {
  it('returns 403 when user is candidate', () => {
    const req = { user: { id: 'u1', role: 'candidate' } };
    const res = mockRes();
    const next = jest.fn();
    requireCoordinator(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when user is coordinator', () => {
    const req = { user: { id: 'u1', role: 'coordinator' } };
    const res = mockRes();
    const next = jest.fn();
    requireCoordinator(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
