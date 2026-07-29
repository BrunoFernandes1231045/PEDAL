const { clientIp, normaliseIp } = require('../../src/lib/clientIp');

describe('clientIp', () => {
  it('uses req.ip calculated by the configured trusted proxy boundary', () => {
    const req = {
      get: (name) => (name === 'x-real-ip' ? '203.0.113.10' : undefined),
      socket: { remoteAddress: '10.0.0.8' },
      ip: '198.51.100.99',
    };

    expect(clientIp(req)).toBe('198.51.100.99');
  });

  it('normalises IPv4-mapped IPv6 from req.ip', () => {
    const req = {
      get: () => undefined,
      socket: { remoteAddress: '10.0.0.8' },
      ip: '::ffff:192.0.2.44',
    };

    expect(clientIp(req)).toBe('192.0.2.44');
  });

  it('rejects malformed header values', () => {
    expect(normaliseIp('203.0.113.10, 198.51.100.1')).toBeNull();
    expect(normaliseIp('not-an-ip')).toBeNull();
  });
});
