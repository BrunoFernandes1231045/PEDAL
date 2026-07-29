const {
  normaliseSupabaseUrl,
  publicRuntimeConfig,
  validateProductionRuntimeConfig,
} = require('../../src/lib/runtimeConfig');

const productionEnv = {
  NODE_ENV: 'production',
  SUPABASE_URL: 'https://greenfield-project.supabase.co/',
  SUPABASE_PUBLIC_URL: 'https://greenfield-project.supabase.co',
  SUPABASE_ANON_KEY: 'public-anon-key',
};

describe('runtimeConfig', () => {
  it('normalises URLs and exposes only the public browser settings', () => {
    expect(publicRuntimeConfig(productionEnv)).toEqual({
      supabaseUrl: 'https://greenfield-project.supabase.co',
      supabaseAnonKey: 'public-anon-key',
    });
  });

  it('allows SUPABASE_URL as a development fallback', () => {
    expect(publicRuntimeConfig({
      NODE_ENV: 'development',
      SUPABASE_URL: 'http://localhost:54321/',
      SUPABASE_ANON_KEY: 'dev-anon-key',
    })).toEqual({
      supabaseUrl: 'http://localhost:54321',
      supabaseAnonKey: 'dev-anon-key',
    });
  });

  it('requires matching backend and public project URLs in production', () => {
    expect(() => validateProductionRuntimeConfig({
      ...productionEnv,
      SUPABASE_PUBLIC_URL: 'https://another-project.supabase.co',
    })).toThrow(/tem de coincidir/);
  });

  it.each([
    ['SUPABASE_URL', ''],
    ['SUPABASE_PUBLIC_URL', ''],
    ['SUPABASE_ANON_KEY', ''],
  ])('requires %s in production', (name, value) => {
    expect(() => validateProductionRuntimeConfig({
      ...productionEnv,
      [name]: value,
    })).toThrow(new RegExp(name));
  });

  it('requires HTTPS for production Supabase URLs', () => {
    expect(() => validateProductionRuntimeConfig({
      ...productionEnv,
      SUPABASE_URL: 'http://greenfield-project.supabase.co',
      SUPABASE_PUBLIC_URL: 'http://greenfield-project.supabase.co',
    })).toThrow(/HTTPS/);
  });

  it('does nothing outside production', () => {
    expect(() => validateProductionRuntimeConfig({ NODE_ENV: 'test' })).not.toThrow();
  });

  it('rejects malformed URLs when they are consumed', () => {
    expect(() => normaliseSupabaseUrl('not a url', 'SUPABASE_URL')).toThrow(/URL válido/);
  });
});
