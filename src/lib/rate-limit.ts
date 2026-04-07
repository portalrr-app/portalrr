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
  login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 },
  adminLogin: { maxAttempts: 3, windowMs: 30 * 60 * 1000 },
  registration: { maxAttempts: 3, windowMs: 15 * 60 * 1000 },
  inviteVerify: { maxAttempts: 20, windowMs: 15 * 60 * 1000 },
  passwordReset: { maxAttempts: 3, windowMs: 15 * 60 * 1000 },
  adminWrite: { maxAttempts: 30, windowMs: 15 * 60 * 1000 },
} as const;

export function getClientIp(request: NextRequest): string {
  // Only trust x-forwarded-for if TRUSTED_PROXY_COUNT is configured.
  // This prevents clients from spoofing their IP via the header.
  const trustedProxies = parseInt(process.env.TRUSTED_PROXY_COUNT || '0', 10);
  if (trustedProxies > 0) {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      const ips = forwarded.split(',').map(ip => ip.trim()).filter(Boolean);
      // Each trusted proxy appends one IP. The client IP is just before the trusted proxies.
      const idx = Math.max(0, ips.length - trustedProxies - 1);
      return ips[idx] || '127.0.0.1';
    }
  }
  return request.headers.get('x-real-ip') || '127.0.0.1';
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
