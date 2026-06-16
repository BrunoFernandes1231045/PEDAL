describe('supabase client', () => {
  it('exports an object with from and auth properties', () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-key';
    jest.resetModules();
    const supabase = require('../src/db/supabase');
    expect(typeof supabase.from).toBe('function');
    expect(typeof supabase.auth).toBe('object');
  });
});
