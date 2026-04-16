import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, RATE_LIMITS, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { logOnError } from '@/lib/logger';
import { hashSessionToken } from '@/lib/crypto';

function unauthorized() {
  return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
}

/**
 * Validates the admin session from request headers/cookies.
 * Returns the admin object if valid, or a 401 Response if not.
 * For state-changing requests (POST/PATCH/DELETE), also applies rate limiting.
 */
export async function authenticateAdmin(
  request: NextRequest
): Promise<{ admin: { id: string; username: string; source: string } } | NextResponse> {
  const token = request.cookies.get('admin_session')?.value;

  if (!token) return unauthorized();

  try {
    const session = await prisma.adminSession.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { admin: { select: { id: true, username: true, source: true } } },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await prisma.adminSession.delete({ where: { id: session.id } }).catch(logOnError('auth/admin:session-cleanup'));
      }
      return unauthorized();
    }

    // Rate limit state-changing admin requests
    const method = request.method.toUpperCase();
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      const ip = getClientIp(request);
      const rl = checkRateLimit(`admin-write:${ip}`, RATE_LIMITS.adminWrite);
      if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs) as unknown as NextResponse;
    }

    return { admin: session.admin };
  } catch {
    return unauthorized();
  }
}

/**
 * Helper: returns true if the result is an error response (not authenticated)
 */
export function isAuthError(
  result: { admin: { id: string; username: string; source: string } } | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
