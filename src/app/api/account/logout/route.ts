import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logOnError } from '@/lib/logger';
import { hashSessionToken } from '@/lib/crypto';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('user_session')?.value;

    if (token) {
      await prisma.userSession
        .delete({ where: { tokenHash: hashSessionToken(token) } })
        .catch(logOnError('account/logout'));
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
