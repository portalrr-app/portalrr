import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logOnError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('admin_session')?.value;

    if (sessionId) {
      await prisma.adminSession.delete({ where: { id: sessionId } }).catch(logOnError('admin/logout'));
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete('admin_session');
    return response;
  } catch {
    const response = NextResponse.json({ success: true });
    response.cookies.delete('admin_session');
    return response;
  }
}
