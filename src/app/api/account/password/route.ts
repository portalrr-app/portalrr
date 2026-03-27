import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { authenticateUser, isUserAuthError } from '@/lib/auth/user';
import { changePasswordSchema, validateBody } from '@/lib/validation';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { getJellyfinAuthToken, changeJellyfinPassword, findJellyfinUserByName } from '@/lib/servers/jellyfin';
import { decryptServerSecrets, generateSessionToken } from '@/lib/crypto';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`change-password:${ip}`, { maxAttempts: 5, windowMs: 15 * 60 * 1000 });
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    const auth = await authenticateUser(request);
    if (isUserAuthError(auth)) return auth;

    const body = await request.json();
    const parsed = validateBody(changePasswordSchema, body);
    if (!parsed.success) return parsed.response;

    const { currentPassword, newPassword } = parsed.data;

    // Get full user with invite/server info
    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      include: {
        invite: {
          include: { server: true },
        },
        server: true,
      },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Verify current password
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { message: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Update local password
    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    // Invalidate ALL sessions (including current) and issue a new one
    await prisma.userSession.deleteMany({
      where: { userId: user.id },
    });

    const newSession = await prisma.userSession.create({
      data: {
        id: generateSessionToken(),
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Sync password to all Jellyfin servers this user is on
    const userServers = await prisma.userServer.findMany({
      where: { userId: user.id },
      include: { server: true },
    });

    const syncResults: { serverName: string; synced: boolean }[] = [];

    for (const membership of userServers) {
      const server = decryptServerSecrets(membership.server);
      if (server.type === 'jellyfin' && server.adminUsername && server.adminPassword && server.apiKey) {
        try {
          const jellyfinUserId = membership.remoteUserId
            || await findJellyfinUserByName(server.url, server.apiKey, user.username);

          if (jellyfinUserId) {
            const authToken = await getJellyfinAuthToken(server.url, server.adminUsername, server.adminPassword);
            await changeJellyfinPassword(server.url, authToken, jellyfinUserId, newPassword);
            syncResults.push({ serverName: server.name, synced: true });
          } else {
            syncResults.push({ serverName: server.name, synced: false });
          }
        } catch (error) {
          console.error(`Failed to sync password to ${server.name}:`, error);
          syncResults.push({ serverName: server.name, synced: false });
        }
      }
    }

    // Fallback: also check legacy server/invite.server if no UserServer entries
    if (userServers.length === 0) {
      const rawServer = user.server || user.invite?.server;
      const server = rawServer ? decryptServerSecrets(rawServer) : null;
      if (server?.type === 'jellyfin' && server.adminUsername && server.adminPassword && server.apiKey) {
        try {
          const jellyfinUserId = await findJellyfinUserByName(server.url, server.apiKey, user.username);
          if (jellyfinUserId) {
            const authToken = await getJellyfinAuthToken(server.url, server.adminUsername, server.adminPassword);
            await changeJellyfinPassword(server.url, authToken, jellyfinUserId, newPassword);
            syncResults.push({ serverName: server.name, synced: true });
          }
        } catch (error) {
          console.error('Failed to sync password to Jellyfin:', error);
        }
      }
    }

    const allSynced = syncResults.length > 0 && syncResults.every(r => r.synced);
    const hasJellyfin = syncResults.length > 0 || userServers.some(m => m.server.type === 'jellyfin');

    const response = NextResponse.json({
      success: true,
      jellyfinSynced: allSynced,
      serverType: hasJellyfin ? 'jellyfin' : (userServers[0]?.server.type || null),
      syncResults,
    });

    // Set the new rotated session cookie
    response.cookies.set('user_session', newSession.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && process.env.INSECURE_COOKIES !== 'true',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json(
      { message: 'Failed to change password' },
      { status: 500 }
    );
  }
}
