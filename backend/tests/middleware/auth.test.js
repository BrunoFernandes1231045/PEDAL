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

function fakeJwt(claims) {
  const encoded = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `header.${encoded}.signature`;
}

describe('requireAuth', () => {
  const originalMfaSetting = process.env.COORDINATOR_MFA_REQUIRED;

  afterEach(() => {
    if (originalMfaSetting === undefined) delete process.env.COORDINATOR_MFA_REQUIRED;
    else process.env.COORDINATOR_MFA_REQUIRED = originalMfaSetting;
  });

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
    const req = { headers: { authorization: `Bearer ${fakeJwt({ iat: 100, aal: 'aal1' })}` } };
    const res = mockRes();
    const next = jest.fn();
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 'user-123', role: 'candidate', coord_role: 'coordenacao' });
    expect(req.authAal).toBe('aal1');
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

  it('rejects a token carrying an obsolete authorization version', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'coord-1',
          app_metadata: {
            role: 'coordinator',
            coord_role: 'administracao',
            authorization_version: 'version-2',
          },
        },
      },
      error: null,
    });
    const req = {
      headers: {
        authorization: `Bearer ${fakeJwt({
          iat: 200,
          aal: 'aal2',
          app_metadata: { authorization_version: 'version-1' },
        })}`,
      },
    };
    const res = mockRes();
    const next = jest.fn();
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'session_stale' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an AAL1 coordinator even on a mixed candidate/coordinator route', async () => {
    process.env.COORDINATOR_MFA_REQUIRED = 'true';
    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'coord-1',
          app_metadata: { role: 'coordinator', coord_role: 'coordenacao' },
        },
      },
      error: null,
    });
    const req = { headers: { authorization: `Bearer ${fakeJwt({ iat: 200, aal: 'aal1' })}` } };
    const res = mockRes();
    const next = jest.fn();
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'mfa_required' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('lets an AAL1 coordinator through when the MFA flag is off', async () => {
    delete process.env.COORDINATOR_MFA_REQUIRED;
    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'coord-1',
          app_metadata: { role: 'coordinator', coord_role: 'coordenacao' },
        },
      },
      error: null,
    });
    const req = { headers: { authorization: `Bearer ${fakeJwt({ iat: 200, aal: 'aal1' })}` } };
    const res = mockRes();
    const next = jest.fn();
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('accepts an AAL2 coordinator only when the JWT carries the current authorization version', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'coord-1',
          app_metadata: {
            role: 'coordinator',
            coord_role: 'administracao',
            authorization_version: 'current-version',
          },
        },
      },
      error: null,
    });
    const req = {
      headers: {
        authorization: `Bearer ${fakeJwt({
          iat: 200,
          aal: 'aal2',
          app_metadata: { authorization_version: 'current-version' },
        })}`,
      },
    };
    const res = mockRes();
    const next = jest.fn();
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({
      id: 'coord-1',
      role: 'coordinator',
      coord_role: 'administracao',
    });
  });
});

describe('requireCoordinator', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalMfaSetting = process.env.COORDINATOR_MFA_REQUIRED;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalMfaSetting === undefined) delete process.env.COORDINATOR_MFA_REQUIRED;
    else process.env.COORDINATOR_MFA_REQUIRED = originalMfaSetting;
  });

  it('returns 403 when user is candidate', () => {
    const req = { user: { id: 'u1', role: 'candidate' } };
    const res = mockRes();
    const next = jest.fn();
    requireCoordinator(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('requires AAL2 when user is coordinator and the MFA flag is on', () => {
    process.env.COORDINATOR_MFA_REQUIRED = 'true';
    const req = { user: { id: 'u1', role: 'coordinator' }, authAal: 'aal1' };
    const res = mockRes();
    const next = jest.fn();
    requireCoordinator(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'mfa_required' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when coordinator has an AAL2 session', () => {
    process.env.COORDINATOR_MFA_REQUIRED = 'true';
    const req = { user: { id: 'u1', role: 'coordinator' }, authAal: 'aal2' };
    const res = mockRes();
    const next = jest.fn();
    requireCoordinator(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  // A flag é opt-in: qualquer valor que não seja exatamente 'true' deixa a
  // exigência desligada, incluindo quando a variável não está definida.
  it.each([
    ['unset', undefined],
    ['false', 'false'],
    ['empty', ''],
  ])('skips the MFA check when COORDINATOR_MFA_REQUIRED is %s', (_label, value) => {
    if (value === undefined) delete process.env.COORDINATOR_MFA_REQUIRED;
    else process.env.COORDINATOR_MFA_REQUIRED = value;
    const req = { user: { id: 'u1', role: 'coordinator' }, authAal: 'aal1' };
    const res = mockRes();
    const next = jest.fn();
    requireCoordinator(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  // Ao contrário do comportamento anterior, produção deixou de forçar MFA por
  // si só — passou a depender exclusivamente da flag, nos dois sentidos.
  it('leaves the MFA check off in production when the flag is off', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.COORDINATOR_MFA_REQUIRED;
    const req = { user: { id: 'u1', role: 'coordinator' }, authAal: 'aal1' };
    const res = mockRes();
    const next = jest.fn();
    requireCoordinator(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('enforces the MFA check in production when the flag is on', () => {
    process.env.NODE_ENV = 'production';
    process.env.COORDINATOR_MFA_REQUIRED = 'true';
    const req = { user: { id: 'u1', role: 'coordinator' }, authAal: 'aal1' };
    const res = mockRes();
    const next = jest.fn();
    requireCoordinator(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
