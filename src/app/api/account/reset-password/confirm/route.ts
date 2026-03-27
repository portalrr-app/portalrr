import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resetPasswordSchema, validateBody } from '@/lib/validation';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { auditLog } from '@/lib/audit';
import { decryptServerSecrets } from '@/lib/crypto';
import { getJellyfinAuthToken, changeJellyfinPassword, findJellyfinUserByName } from '@/lib/servers/jellyfin';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`password-reset:${ip}`, RATE_LIMITS.passwordReset);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    const body = await request.json();
    const parsed = validateBody(resetPasswordSchema, body);
    if (!parsed.success) return parsed.response;

    const { token, newPassword } = parsed.data;

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { message: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password, mark token as used, and invalidate all sessions in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.userSession.deleteMany({
        where: { userId: resetToken.userId },
      }),
    ]);

    // Sync password to all Jellyfin servers this user is on
    let serverSynced = false;
    const userServers = await prisma.userServer.findMany({
      where: { userId: resetToken.userId },
      include: { server: true },
    });

    for (const membership of userServers) {
      const server = decryptServerSecrets(membership.server);
      if (server.type === 'jellyfin' && server.adminUsername && server.adminPassword && server.apiKey) {
        try {
          const jellyfinUserId = membership.remoteUserId
            || await findJellyfinUserByName(server.url, server.apiKey, resetToken.user.username);
          if (jellyfinUserId) {
            const authToken = await getJellyfinAuthToken(server.url, server.adminUsername, server.adminPassword);
            await changeJellyfinPassword(server.url, authToken, jellyfinUserId, newPassword);
            serverSynced = true;
          }
        } catch (error) {
          console.error(`Failed to sync password reset to ${server.name}:`, error);
        }
      }
    }

    // Fallback for legacy users without UserServer entries
    if (userServers.length === 0) {
      const user = await prisma.user.findUnique({
        where: { id: resetToken.userId },
        include: { server: true, invite: { include: { server: true } } },
      });
      if (user) {
        const rawServer = user.server || user.invite?.server;
        const server = rawServer ? decryptServerSecrets(rawServer) : null;
        if (server?.type === 'jellyfin' && server.adminUsername && server.adminPassword && server.apiKey) {
          try {
            const jellyfinUserId = await findJellyfinUserByName(server.url, server.apiKey, user.username);
            if (jellyfinUserId) {
              const authToken = await getJellyfinAuthToken(server.url, server.adminUsername, server.adminPassword);
              await changeJellyfinPassword(server.url, authToken, jellyfinUserId, newPassword);
              serverSynced = true;
            }
          } catch (error) {
            console.error('Failed to sync password reset to Jellyfin:', error);
          }
        }
      }
    }

    auditLog(
      'password_reset_completed',
      { method: 'token', serverSynced },
      { actor: resetToken.userId, ip }
    );

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully.',
      serverSynced,
    });
  } catch (error) {
    console.error('Password reset confirm error:', error);
    return NextResponse.json(
      { message: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
