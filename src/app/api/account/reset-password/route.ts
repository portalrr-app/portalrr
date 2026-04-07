import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requestPasswordResetSchema, validateBody } from '@/lib/validation';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { generateSessionToken } from '@/lib/crypto';
import { sendTemplatedEmail } from '@/lib/notifications/email-templates';
import { auditLog } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`password-reset:${ip}`, RATE_LIMITS.passwordReset);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    const body = await request.json();
    const parsed = validateBody(requestPasswordResetSchema, body);
    if (!parsed.success) return parsed.response;

    const { email } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (user) {
      const token = generateSessionToken();

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        },
      });

      const resetLink = `${request.nextUrl.origin}/forgot-password?token=${token}`;

      await sendTemplatedEmail(email, 'password_reset', {
        username: user.username,
        resetLink,
      });

      auditLog('password_reset_requested', { email }, { actor: user.id, ip });
    }

    // Always return success to avoid revealing whether the email exists
    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json(
      { message: 'Failed to process password reset request' },
      { status: 500 }
    );
  }
}
