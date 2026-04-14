import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkRateLimit, RATE_LIMITS, getClientIp, rateLimitResponse } from '../rate-limit';

describe('checkRateLimit', () => {
  // Use unique keys per test to avoid interference
  let keyCounter = 0;
  const uniqueKey = () => `test-${++keyCounter}-${Date.now()}`;

  it('allows requests under the limit', () => {
    const key = uniqueKey();
    const config = { maxAttempts: 3, windowMs: 60000 };

    const r1 = checkRateLimit(key, config);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit(key, config);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit(key, config);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('blocks requests over the limit', () => {
    const key = uniqueKey();
    const config = { maxAttempts: 2, windowMs: 60000 };

    checkRateLimit(key, config);
    checkRateLimit(key, config);

    const r3 = checkRateLimit(key, config);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
    expect(r3.retryAfterMs).toBeGreaterThan(0);
    expect(r3.retryAfterMs).toBeLessThanOrEqual(60000);
  });

  it('allows requests again after window expires', () => {
    const key = uniqueKey();
    const config = { maxAttempts: 1, windowMs: 100 };

    const r1 = checkRateLimit(key, config);
    expect(r1.allowed).toBe(true);

    const r2 = checkRateLimit(key, config);
    expect(r2.allowed).toBe(false);

    // Simulate time passing by manipulating Date.now
    const realNow = Date.now;
    vi.spyOn(Date, 'now').mockReturnValue(realNow() + 200);

    const r3 = checkRateLimit(key, config);
    expect(r3.allowed).toBe(true);

    vi.restoreAllMocks();
  });

  it('tracks different keys independently', () => {
    const key1 = uniqueKey();
    const key2 = uniqueKey();
    const config = { maxAttempts: 1, windowMs: 60000 };

    checkRateLimit(key1, config);
    const r1 = checkRateLimit(key1, config);
    expect(r1.allowed).toBe(false);

    // key2 should still be allowed
    const r2 = checkRateLimit(key2, config);
    expect(r2.allowed).toBe(true);
  });

  it('retryAfterMs is correct', () => {
    const key = uniqueKey();
    const config = { maxAttempts: 1, windowMs: 30000 };

    checkRateLimit(key, config);
    const blocked = checkRateLimit(key, config);

    expect(blocked.allowed).toBe(false);
    // retryAfterMs should be roughly windowMs (within a few ms tolerance)
    expect(blocked.retryAfterMs).toBeGreaterThan(29000);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(30000);
  });
});

describe('getClientIp', () => {
  const makeRequest = (headers: Record<string, string>) => ({
    headers: {
      get: (key: string) => headers[key.toLowerCase()] || null,
    },
  }) as unknown as import('next/server').NextRequest;

  const originalEnv = process.env.TRUSTED_PROXY_COUNT;
  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.TRUSTED_PROXY_COUNT;
    } else {
      process.env.TRUSTED_PROXY_COUNT = originalEnv;
    }
  });

  it('ignores x-forwarded-for and x-real-ip when TRUSTED_PROXY_COUNT is not set', () => {
    delete process.env.TRUSTED_PROXY_COUNT;
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '5.5.5.5' });
    // Should not trust any client-supplied headers without trusted proxies
    expect(getClientIp(req)).toBe('127.0.0.1');
  });

  it('ignores x-forwarded-for when TRUSTED_PROXY_COUNT is 0', () => {
    process.env.TRUSTED_PROXY_COUNT = '0';
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4' });
    expect(getClientIp(req)).toBe('127.0.0.1');
  });

  it('extracts correct client IP with TRUSTED_PROXY_COUNT=1', () => {
    process.env.TRUSTED_PROXY_COUNT = '1';
    // client -> proxy: "client_ip, proxy_ip" — we want client_ip (length - 1 = index 0)
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.50, 10.0.0.1' });
    expect(getClientIp(req)).toBe('203.0.113.50');
  });

  it('extracts correct client IP with TRUSTED_PROXY_COUNT=2', () => {
    process.env.TRUSTED_PROXY_COUNT = '2';
    // client -> proxy1 -> proxy2: "client, proxy1, proxy2"
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.50, 10.0.0.1, 10.0.0.2' });
    expect(getClientIp(req)).toBe('203.0.113.50');
  });

  it('handles single IP with TRUSTED_PROXY_COUNT=1', () => {
    process.env.TRUSTED_PROXY_COUNT = '1';
    // Single IP means the proxy didn't append — use it as-is (index 0)
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.50' });
    expect(getClientIp(req)).toBe('203.0.113.50');
  });

  it('trusts x-real-ip when TRUSTED_PROXY_COUNT is set', () => {
    process.env.TRUSTED_PROXY_COUNT = '1';
    const req = makeRequest({ 'x-real-ip': '1.2.3.4' });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('ignores x-real-ip when TRUSTED_PROXY_COUNT is not set', () => {
    delete process.env.TRUSTED_PROXY_COUNT;
    const req = makeRequest({ 'x-real-ip': '1.2.3.4' });
    expect(getClientIp(req)).toBe('127.0.0.1');
  });

  it('falls back to 127.0.0.1 when no headers present', () => {
    const req = makeRequest({});
    expect(getClientIp(req)).toBe('127.0.0.1');
  });

  it('prevents spoofing without TRUSTED_PROXY_COUNT', () => {
    delete process.env.TRUSTED_PROXY_COUNT;
    // Attacker sends fake x-forwarded-for directly to the app
    const req = makeRequest({ 'x-forwarded-for': 'fake-ip' });
    // Should NOT trust it
    expect(getClientIp(req)).toBe('127.0.0.1');
  });
});

describe('rateLimitResponse', () => {
  it('returns 429 status', () => {
    const res = rateLimitResponse(5000);
    expect(res.status).toBe(429);
  });

  it('sets Retry-After header in seconds', () => {
    const res = rateLimitResponse(15000);
    expect(res.headers.get('Retry-After')).toBe('15');
  });

  it('rounds up fractional seconds', () => {
    const res = rateLimitResponse(1500);
    expect(res.headers.get('Retry-After')).toBe('2');
  });

  it('includes error message in body', async () => {
    const res = rateLimitResponse(5000);
    const body = await res.json();
    expect(body.message).toContain('Too many attempts');
  });
});

describe('RATE_LIMITS config', () => {
  it('has expected rate limit configs', () => {
    expect(RATE_LIMITS.login.maxAttempts).toBe(10);
    expect(RATE_LIMITS.adminLogin.maxAttempts).toBe(10);
    expect(RATE_LIMITS.registration.maxAttempts).toBe(3);
    expect(RATE_LIMITS.inviteVerify.maxAttempts).toBe(20);
    expect(RATE_LIMITS.passwordReset.maxAttempts).toBe(3);
  });

  it('all windows are positive', () => {
    for (const config of Object.values(RATE_LIMITS)) {
      expect(config.windowMs).toBeGreaterThan(0);
      expect(config.maxAttempts).toBeGreaterThan(0);
    }
  });
});
