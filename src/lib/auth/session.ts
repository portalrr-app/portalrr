import { prisma } from '@/lib/prisma';
import type { NextRequest } from 'next/server';
import { logOnError } from '@/lib/logger';
import { hashSessionToken } from '@/lib/crypto';

export async function validateSession(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value;
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash },
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
