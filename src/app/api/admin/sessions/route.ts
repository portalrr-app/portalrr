import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { auditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const [adminSessions, userSessions] = await Promise.all([
      prisma.adminSession.findMany({
        where: { expiresAt: { gt: new Date() } },
        include: { admin: { select: { username: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.userSession.findMany({
        where: { expiresAt: { gt: new Date() } },
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // s.id is an opaque random identifier — the actual session cookie value is
    // only stored server-side as a sha256 hash in s.tokenHash and is never
    // returned by this endpoint. The id is safe to expose because it's only
    // used to address the session row (e.g. for revocation via DELETE) and
    // cannot be replayed as a cookie.
    const sessions = [
      ...adminSessions.map((s) => ({
        id: s.id,
        type: 'admin' as const,
        username: s.admin.username,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
      })),
      ...userSessions.map((s) => ({
        id: s.id,
        type: 'user' as const,
        username: s.user.username,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
      })),
    ];

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { message: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    if (auth.admin.source !== 'local') {
      return NextResponse.json({ message: 'Only the Portalrr admin can manage sessions' }, { status: 403 });
    }

    let body: { sessionId?: string; type?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { message: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { sessionId, type } = body;

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { message: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (type !== 'admin' && type !== 'user') {
      return NextResponse.json(
        { message: 'type must be "admin" or "user"' },
        { status: 400 }
      );
    }

    if (type === 'admin') {
      await prisma.adminSession.delete({ where: { id: sessionId } });
    } else {
      await prisma.userSession.delete({ where: { id: sessionId } });
    }

    auditLog('session.revoked', {
      admin: auth.admin.username,
      sessionId,
      sessionType: type,
    });

    return NextResponse.json({ message: 'Session revoked' });
  } catch (error) {
    console.error('Error revoking session:', error);
    return NextResponse.json(
      { message: 'Failed to revoke session' },
      { status: 500 }
    );
  }
}
