import { prisma } from '@/lib/prisma';
import type { NextRequest } from 'next/server';
import { logOnError } from '@/lib/logger';

export async function validateSession(request: NextRequest) {
  const sessionId = request.cookies.get('admin_session')?.value;
  if (!sessionId) return null;

  const session = await prisma.adminSession.findUnique({
    where: { id: sessionId },
    include: { admin: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.adminSession.delete({ where: { id: session.id } }).catch(logOnError('auth/session:cleanup'));
    }
    return null;
  }

  return { admin: session.admin, session };
}

export async function requireAdmin(request: NextRequest) {
  const result = await validateSession(request);
  if (!result) return null;
  return result;
}

export async function isSetupComplete() {
  const count = await prisma.admin.count();
  return count > 0;
}
