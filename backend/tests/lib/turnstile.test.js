const { verifyTurnstile, VERIFY_URL } = require('../../src/lib/turnstile');

describe('verifyTurnstile', () => {
  const originalSecret = process.env.TURNSTILE_SECRET_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = originalSecret;
    global.fetch = originalFetch;
  });

  it('fails closed without a server-side secret', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    global.fetch = jest.fn();

    await expect(verifyTurnstile({ token: 'token' })).resolves.toEqual({
      success: false,
      configurationError: true,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a missing client token without calling Cloudflare', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    global.fetch = jest.fn();

    const result = await verifyTurnstile({ token: '' });

    expect(result).toEqual({
      success: false,
      errorCodes: ['missing-input-response'],
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('validates the token server-side without exposing the secret in JSON', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret-for-test';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, hostname: 'pedal.example', action: 'signup' }),
    });

    const result = await verifyTurnstile({
      token: 'official-test-token',
      remoteIp: '203.0.113.10',
      idempotencyKey: 'request-id',
      expectedAction: 'signup',
      expectedHostnames: ['pedal.example'],
    });

    expect(result).toEqual({
      success: true,
      errorCodes: [],
      hostname: 'pedal.example',
      action: 'signup',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      VERIFY_URL,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );
    const body = global.fetch.mock.calls[0][1].body;
    expect(body.get('secret')).toBe('secret-for-test');
    expect(body.get('response')).toBe('official-test-token');
    expect(body.get('remoteip')).toBe('203.0.113.10');
    expect(body.get('idempotency_key')).toBe('request-id');
  });

  it('rejects a valid token minted for another action or hostname', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true, hostname: 'pedal.example', action: 'login' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true, hostname: 'evil.example', action: 'signup' }),
      });

    await expect(verifyTurnstile({
      token: 'wrong-action',
      expectedAction: 'signup',
      expectedHostnames: ['pedal.example'],
    })).resolves.toEqual({
      success: false,
      bindingError: true,
      errorCodes: ['action-mismatch'],
    });
    await expect(verifyTurnstile({
      token: 'wrong-host',
      expectedAction: 'signup',
      expectedHostnames: ['pedal.example'],
    })).resolves.toEqual({
      success: false,
      bindingError: true,
      errorCodes: ['hostname-mismatch'],
    });
  });

  it('fails closed on a network or malformed service response', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    global.fetch = jest.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ unexpected: true }) });

    await expect(verifyTurnstile({ token: 'one' })).resolves.toEqual(
      expect.objectContaining({ success: false, serviceError: true }),
    );
    await expect(verifyTurnstile({ token: 'two' })).resolves.toEqual({
      success: false,
      serviceError: true,
    });
  });
});
