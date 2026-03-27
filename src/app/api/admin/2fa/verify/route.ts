import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verify } from 'otplib';
import { validateSession } from '@/lib/auth/session';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { decrypt } from '@/lib/crypto';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`2fa-verify:${ip}`, { maxAttempts: 5, windowMs: 15 * 60 * 1000 });
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    const result = await validateSession(request);
    if (!result) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ message: 'Verification code required' }, { status: 400 });
    }

    // Read the secret from the database instead of accepting it from the client
    if (!result.admin.totpSecret) {
      return NextResponse.json(
        { message: 'No 2FA setup in progress. Please start setup first.' },
        { status: 400 }
      );
    }

    const secret = decrypt(result.admin.totpSecret);
    const isValid = verify({ token: code, secret });

    if (!isValid) {
      return NextResponse.json({ message: 'Invalid verification code' }, { status: 401 });
    }

    // Secret is already stored from the GET step; just enable 2FA now
    await prisma.admin.update({
      where: { id: result.admin.id },
      data: { totpEnabled: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('2FA verify error:', error);
    return NextResponse.json({ message: 'Failed to verify 2FA' }, { status: 500 });
  }
}
