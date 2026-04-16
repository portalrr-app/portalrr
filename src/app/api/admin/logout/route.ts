import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logOnError } from '@/lib/logger';
import { hashSessionToken } from '@/lib/crypto';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_session')?.value;

    if (token) {
      await prisma.adminSession
        .delete({ where: { tokenHash: hashSessionToken(token) } })
        .catch(logOnError('admin/logout'));
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
