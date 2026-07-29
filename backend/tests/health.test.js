jest.mock('../src/db/supabase', () => ({
  from: jest.fn(),
  auth: { admin: { createUser: jest.fn() } },
}));

const request = require('supertest');
const app = require('../src/app');

describe('GET /health', () => {
  it('returns status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('GET /runtime-config.js', () => {
  const previousPublicUrl = process.env.SUPABASE_PUBLIC_URL;
  const previousAnonKey = process.env.SUPABASE_ANON_KEY;
  const previousServiceKey = process.env.SUPABASE_SERVICE_KEY;

  function restoreEnv(name, value) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  afterAll(() => {
    restoreEnv('SUPABASE_PUBLIC_URL', previousPublicUrl);
    restoreEnv('SUPABASE_ANON_KEY', previousAnonKey);
    restoreEnv('SUPABASE_SERVICE_KEY', previousServiceKey);
  });

  it('serves browser-safe configuration without caching or service credentials', async () => {
    process.env.SUPABASE_PUBLIC_URL = 'https://greenfield-project.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'public-anon-key';
    process.env.SUPABASE_SERVICE_KEY = 'never-expose-this';

    const res = await request(app).get('/runtime-config.js');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/javascript/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.text).toContain('window.__PEDAL_AUTH_CONFIG');
    expect(res.text).toContain('https://greenfield-project.supabase.co');
    expect(res.text).toContain('public-anon-key');
    expect(res.text).not.toContain('never-expose-this');
    expect(res.text).not.toContain('SUPABASE_SERVICE_KEY');
  });
});
