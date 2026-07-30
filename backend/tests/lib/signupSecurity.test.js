const {
  positiveInteger,
  signupSecurityConfig,
  validateSignupPayload,
} = require('../../src/lib/signupSecurity');

const productionEnv = {
  NODE_ENV: 'production',
  PUBLIC_APP_URL: 'https://pedal.example',
  TURNSTILE_SITE_KEY: 'real-site-key',
  TURNSTILE_SECRET_KEY: 'real-secret-key',
};

describe('signupSecurityConfig', () => {
  it('parses positive limits and derives the production hostname', () => {
    expect(signupSecurityConfig({
      ...productionEnv,
      SIGNUP_RATE_LIMIT: '7',
      SIGNUP_RATE_WINDOW_SECONDS: '900',
      SIGNUP_PRE_RATE_LIMIT: '20',
      SIGNUP_PRE_RATE_WINDOW_SECONDS: '30',
    })).toEqual(expect.objectContaining({
      signupRateLimit: 7,
      signupRateWindowSeconds: 900,
      preRateLimit: 20,
      preRateWindowSeconds: 30,
      expectedAction: 'signup',
      expectedHostnames: ['pedal.example'],
    }));
  });

  it.each(['abc', '0', '-1', '1.5', '999999999'])(
    'fails closed for an invalid rate setting: %s',
    (value) => {
      expect(() => signupSecurityConfig({
        ...productionEnv,
        SIGNUP_RATE_LIMIT: value,
      })).toThrow(/SIGNUP_RATE_LIMIT/);
    },
  );

  it('rejects official Turnstile test keys in production', () => {
    expect(() => signupSecurityConfig({
      ...productionEnv,
      TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
    })).toThrow(/teste do Turnstile/);
    expect(() => signupSecurityConfig({
      ...productionEnv,
      TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
    })).toThrow(/teste do Turnstile/);
  });

  it('only binds the action in production, so the official test keys work in development', () => {
    expect(signupSecurityConfig({
      ...productionEnv,
      NODE_ENV: 'development',
      TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
      TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
    })).toEqual(expect.objectContaining({
      expectedAction: null,
      expectedHostnames: [],
    }));
  });

  it('requires HTTPS and a hostname binding in production', () => {
    expect(() => signupSecurityConfig({
      ...productionEnv,
      PUBLIC_APP_URL: 'http://pedal.example',
    })).toThrow(/HTTPS/);
    expect(() => signupSecurityConfig({
      ...productionEnv,
      PUBLIC_APP_URL: '',
    })).toThrow(/HOSTNAMES|PUBLIC_APP_URL/);
  });
});

describe('validateSignupPayload', () => {
  const valid = {
    name: '  Maria Silva  ',
    email: ' Maria@Example.com ',
    dob: '1950-01-01',
    phone: '912345678',
    turnstileToken: 'token',
  };

  it('normalises the allowed public fields', () => {
    expect(validateSignupPayload(valid).value).toEqual(expect.objectContaining({
      name: 'Maria Silva',
      email: 'maria@example.com',
      dob: '1950-01-01',
      phone: '912345678',
    }));
  });

  it.each([
    [{ ...valid, password: 'secret' }, /palavra-passe/],
    [{ ...valid, admin: true }, /desconhecidos/],
    [{ ...valid, phone: { value: '912' } }, /phone/],
    [{ ...valid, name: 'x'.repeat(121) }, /name/],
    [{ ...valid, turnstileToken: 'x'.repeat(4097) }, /turnstileToken/],
    [{ ...valid, dob: '01/01/1950' }, /data/],
  ])('rejects malformed or oversized payloads', (payload, expected) => {
    expect(validateSignupPayload(payload).error).toMatch(expected);
  });
});

describe('positiveInteger', () => {
  it('never accepts NaN-like values', () => {
    expect(() => positiveInteger({ LIMIT: 'NaN' }, 'LIMIT', 5)).toThrow();
  });
});
