const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verifyTurnstile({
  token,
  remoteIp,
  idempotencyKey,
  secretKey,
  expectedAction,
  expectedHostnames = [],
}) {
  const secret = secretKey || process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { success: false, configurationError: true };
  }
  if (!token || typeof token !== 'string') {
    return { success: false, errorCodes: ['missing-input-response'] };
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });
  if (remoteIp) body.set('remoteip', remoteIp);
  if (idempotencyKey) body.set('idempotency_key', idempotencyKey);

  let response;
  try {
    response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    return { success: false, serviceError: true, cause: error };
  }

  if (!response.ok) {
    return { success: false, serviceError: true };
  }

  const result = await response.json().catch(() => null);
  if (!result || typeof result.success !== 'boolean') {
    return { success: false, serviceError: true };
  }
  if (!result.success) return { success: false, errorCodes: result['error-codes'] || [] };

  const hostname = String(result.hostname || '').toLowerCase();
  if (expectedAction && result.action !== expectedAction) {
    return { success: false, bindingError: true, errorCodes: ['action-mismatch'] };
  }
  if (expectedHostnames.length && !expectedHostnames.includes(hostname)) {
    return { success: false, bindingError: true, errorCodes: ['hostname-mismatch'] };
  }
  return { success: true, errorCodes: [], hostname, action: result.action || null };
}

module.exports = { verifyTurnstile, VERIFY_URL };
