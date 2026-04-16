import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logOnError } from '@/lib/logger';
import { hashSessionToken } from '@/lib/crypto';

function unauthorized() {
  return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
}

export async function authenticateUser(
  request: NextRequest
): Promise<{ user: { id: string; username: string; email: string | null; inviteId: string | null } } | NextResponse> {
  const token = request.cookies.get('user_session')?.value;

  if (!token) return unauthorized();

  try {
    const session = await prisma.userSession.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: { select: { id: true, username: true, email: true, inviteId: true, accessUntil: true } } },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await prisma.userSession.delete({ where: { id: session.id } }).catch(logOnError('auth/user:session-cleanup'));
      }
      return unauthorized();
    }

    const settings = await prisma.settings.findFirst({
      select: { expiryPolicy: true },
    });

    if (
      session.user.accessUntil &&
      session.user.accessUntil < new Date() &&
      settings &&
      ['disable', 'disable_then_delete'].includes(settings.expiryPolicy)
    ) {
      return unauthorized();
    }

    return {
      user: {
        id: session.user.id,
        username: session.user.username,
        email: session.user.email,
        inviteId: session.user.inviteId,
      },
    };
  } catch {
    return unauthorized();
  }
}

export function isUserAuthError(
  result: { user: { id: string; username: string; email: string | null; inviteId: string | null } } | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
