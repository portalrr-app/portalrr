import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { setupSchema, validateBody } from '@/lib/validation';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { generateSessionToken } from '@/lib/crypto';

// GET: check if setup is needed
export async function GET() {
  try {
    const adminCount = await prisma.admin.count();
    return NextResponse.json({ setupRequired: adminCount === 0 });
  } catch (error) {
    console.error('Error checking setup status:', error);
    return NextResponse.json({ message: 'Failed to check setup status' }, { status: 500 });
  }
}

// POST: create initial admin account (only works if no admins exist)
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`setup:${ip}`, { maxAttempts: 5, windowMs: 15 * 60 * 1000 });
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    // Only allow setup when no admins exist
    const adminCount = await prisma.admin.count();
    if (adminCount > 0) {
      return NextResponse.json(
        { message: 'Setup already complete. An admin account already exists.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = validateBody(setupSchema, body);
    if (!parsed.success) return parsed.response;

    const { username, password } = parsed.data;

    const passwordHash = await bcrypt.hash(password, 12);

    // Use a transaction with a post-create count check to prevent race conditions
    // where two simultaneous requests both pass the count === 0 check above.
    const admin = await prisma.$transaction(async (tx) => {
      const created = await tx.admin.create({
        data: { username, passwordHash },
      });
      const count = await tx.admin.count();
      if (count > 1) {
        // Another request won the race — roll back by throwing
        throw new Error('SETUP_RACE_CONDITION');
      }
      return created;
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const session = await prisma.adminSession.create({
      data: { id: generateSessionToken(), adminId: admin.id, expiresAt },
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set('admin_session', session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && process.env.INSECURE_COOKIES !== 'true',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    if (error instanceof Error && error.message === 'SETUP_RACE_CONDITION') {
      return NextResponse.json(
        { message: 'Setup already complete. An admin account already exists.' },
        { status: 403 }
      );
    }
    console.error('Error during admin setup:', error);
    return NextResponse.json({ message: 'Setup failed' }, { status: 500 });
  }
}
