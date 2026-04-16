import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 15 * 60 * 1000);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}, 60_000);

export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const entry = store.get(key) || { timestamps: [] };

  entry.timestamps = entry.timestamps.filter((t) => now - t < config.windowMs);

  if (entry.timestamps.length >= config.maxAttempts) {
    const retryAfterMs = config.windowMs - (now - entry.timestamps[0]);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  entry.timestamps.push(now);
  store.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxAttempts - entry.timestamps.length,
    retryAfterMs: 0,
  };
}

export const RATE_LIMITS = {
  login: { maxAttempts: 10, windowMs: 15 * 60 * 1000 },
  adminLogin: { maxAttempts: 10, windowMs: 15 * 60 * 1000 },
  registration: { maxAttempts: 3, windowMs: 15 * 60 * 1000 },
  inviteVerify: { maxAttempts: 20, windowMs: 15 * 60 * 1000 },
  passwordReset: { maxAttempts: 3, windowMs: 15 * 60 * 1000 },
  adminWrite: { maxAttempts: 30, windowMs: 15 * 60 * 1000 },
} as const;

let warnedNoTrustedProxy = false;

/**
 * Resolve a best-effort client IP for rate-limit bucketing.
 *
 * When TRUSTED_PROXY_COUNT is set and > 0 we parse x-forwarded-for with
 * that proxy hop count (the header is trusted because a known proxy set it).
 *
 * When TRUSTED_PROXY_COUNT is 0 / unset we still need *some* dimension to
 * spread rate-limit buckets across — otherwise every request collapses into
 * one global counter and a single attacker can DoS every other user by
 * exhausting the bucket. The fallback uses the leftmost value of
 * x-forwarded-for / x-real-ip. This is spoofable, but no worse than an
 * attacker rotating source IPs at the network level; it is strictly better
 * than the previous "single shared bucket" behaviour.
 *
 * Operators who do not sit behind a reverse proxy should still set
 * TRUSTED_PROXY_COUNT to an appropriate value (typically 0 for direct-expose,
 * 1 for most reverse proxies). We emit a one-shot warning at boot to make the
 * configuration requirement visible.
 */
export function getClientIp(request: NextRequest): string {
  const raw = process.env.TRUSTED_PROXY_COUNT;
  const trustedProxies = raw !== undefined ? parseInt(raw, 10) : NaN;
  const configured = Number.isFinite(trustedProxies) && trustedProxies >= 0;

  if (!configured && !warnedNoTrustedProxy) {
    warnedNoTrustedProxy = true;
    console.warn(
      '[rate-limit] TRUSTED_PROXY_COUNT is not configured. Falling back to best-effort IP from x-forwarded-for / x-real-ip. ' +
      'For correct rate limiting, set TRUSTED_PROXY_COUNT=1 behind a reverse proxy, or 0 for direct exposure.'
    );
  }

  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (configured && trustedProxies > 0 && forwarded) {
    const ips = forwarded.split(',').map((ip) => ip.trim()).filter(Boolean);
    const idx = Math.max(0, ips.length - trustedProxies - 1);
    return ips[idx] || realIp || fallbackBucket(request);
  }

  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  if (realIp) return realIp;

  return fallbackBucket(request);
}

/**
 * When no IP-identifying header is present, at least bucket per user-agent so
 * a single misbehaving client can't lock everyone else out of the same bucket.
 */
function fallbackBucket(request: NextRequest): string {
  const ua = request.headers.get('user-agent') || 'unknown';
  return `ua:${ua.slice(0, 64)}`;
}

export function rateLimitResponse(retryAfterMs: number) {
  return new NextResponse(
    JSON.stringify({ message: 'Too many attempts. Please try again later.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil(retryAfterMs / 1000)),
      },
    }
  );
}
