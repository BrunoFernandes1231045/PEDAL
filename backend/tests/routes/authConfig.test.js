jest.mock('../../src/db/supabase', () => ({
  from: jest.fn(),
  auth: { admin: { createUser: jest.fn() }, getUser: jest.fn() },
}));

const request = require('supertest');
const app = require('../../src/app');

describe('GET /api/auth-config', () => {
  const originalMfaSetting = process.env.COORDINATOR_MFA_REQUIRED;
  const originalRecoverySetting = process.env.PASSWORD_RECOVERY_EMAIL_ENABLED;

  function restoreEnv(name, value) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  afterEach(() => {
    restoreEnv('COORDINATOR_MFA_REQUIRED', originalMfaSetting);
    restoreEnv('PASSWORD_RECOVERY_EMAIL_ENABLED', originalRecoverySetting);
  });

  it('reports MFA as disabled when the flag is unset', async () => {
    delete process.env.COORDINATOR_MFA_REQUIRED;

    const res = await request(app).get('/api/auth-config');

    expect(res.status).toBe(200);
    expect(res.body.coordinatorMfaEnabled).toBe(false);
  });

  it('reports MFA as enabled only when the flag is exactly true', async () => {
    process.env.COORDINATOR_MFA_REQUIRED = 'true';
    await expect(request(app).get('/api/auth-config').then((r) => r.body.coordinatorMfaEnabled))
      .resolves.toBe(true);

    process.env.COORDINATOR_MFA_REQUIRED = 'yes';
    await expect(request(app).get('/api/auth-config').then((r) => r.body.coordinatorMfaEnabled))
      .resolves.toBe(false);
  });

  it('does not leak anything beyond the public auth flags', async () => {
    const res = await request(app).get('/api/auth-config');

    expect(Object.keys(res.body).sort()).toEqual([
      'coordinatorMfaEnabled',
      'passwordRecoveryEmailEnabled',
    ]);
  });
});
