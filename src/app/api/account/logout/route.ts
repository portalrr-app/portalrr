import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logOnError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('user_session')?.value;

    if (sessionId) {
      await prisma.userSession.delete({ where: { id: sessionId } }).catch(logOnError('account/logout'));
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete('user_session');
    return response;
  } catch {
    const response = NextResponse.json({ success: true });
    response.cookies.delete('user_session');
    return response;
  }
}
