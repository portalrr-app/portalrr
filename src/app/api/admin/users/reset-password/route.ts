import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { adminResetPasswordSchema, validateBody } from '@/lib/validation';
import { getJellyfinAuthToken, changeJellyfinPassword, findJellyfinUserByName } from '@/lib/servers/jellyfin';
import { decryptServerSecrets } from '@/lib/crypto';
import { auditLog } from '@/lib/audit';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`reset-password:${ip}`, RATE_LIMITS.passwordReset);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const parsed = validateBody(adminResetPasswordSchema, body);
    if (!parsed.success) return parsed.response;

    const { userId, localId, remoteUserId, newPassword, source, serverId } = parsed.data;

    // For local/Portalrr users, update the local password
    if (source === 'local') {
      const user = await prisma.user.findUnique({
        where: { id: localId || userId },
        include: {
          invite: { include: { server: true } },
          server: true,
        },
      });

      if (!user) {
        return NextResponse.json({ message: 'User not found' }, { status: 404 });
      }

      const newHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });

      // Sync to all Jellyfin servers this user is on
      let jellyfinSynced = false;
      const userServers = await prisma.userServer.findMany({
        where: { userId: user.id },
        include: { server: true },
      });

      for (const membership of userServers) {
        const srv = decryptServerSecrets(membership.server);
        if (srv.type === 'jellyfin' && srv.adminUsername && srv.adminPassword && srv.apiKey) {
          try {
            const authToken = await getJellyfinAuthToken(srv.url, srv.adminUsername, srv.adminPassword);
            const jfUserId = membership.remoteUserId
              || await findJellyfinUserByName(srv.url, srv.apiKey, user.username);
            if (jfUserId) {
              await changeJellyfinPassword(srv.url, authToken, jfUserId, newPassword);
              jellyfinSynced = true;
            }
          } catch (error) {
            console.error(`Failed to sync password to ${srv.name}:`, error);
          }
        }
      }

      // Fallback for legacy users without UserServer entries
      if (userServers.length === 0) {
        const rawServer = user.server || user.invite?.server;
        const server = rawServer ? decryptServerSecrets(rawServer) : null;
        if (server?.type === 'jellyfin' && server.adminUsername && server.adminPassword && server.apiKey) {
          try {
            const authToken = await getJellyfinAuthToken(server.url, server.adminUsername, server.adminPassword);
            const jfUserId = remoteUserId || await findJellyfinUserByName(server.url, server.apiKey, user.username);
            if (jfUserId) {
              await changeJellyfinPassword(server.url, authToken, jfUserId, newPassword);
              jellyfinSynced = true;
            }
          } catch (error) {
            console.error('Failed to sync password to Jellyfin:', error);
          }
        }
      }

      auditLog('admin.password_reset', { admin: auth.admin.username, targetUser: userId, source });
      return NextResponse.json({ success: true, jellyfinSynced });
    }

    // For Jellyfin server users (direct server users, not local)
    if (source === 'jellyfin' && serverId) {
      const server = await prisma.server.findUnique({
        where: { id: serverId },
      }).then(s => s ? decryptServerSecrets(s) : null);

      if (!server) {
        return NextResponse.json({ message: 'Server not found' }, { status: 404 });
      }

      if (!server.adminUsername || !server.adminPassword) {
        return NextResponse.json(
          { message: 'Jellyfin admin credentials not configured for this server. Add them in server settings to enable password management.' },
          { status: 400 }
        );
      }

      try {
        const authToken = await getJellyfinAuthToken(
          server.url,
          server.adminUsername,
          server.adminPassword
        );

        await changeJellyfinPassword(server.url, authToken, remoteUserId || userId, newPassword);

        return NextResponse.json({ success: true, jellyfinSynced: true });
      } catch (error) {
        console.error('Failed to reset Jellyfin password:', error);
        return NextResponse.json(
          { message: 'Failed to reset password on Jellyfin server' },
          { status: 500 }
        );
      }
    }

    // Plex users — cannot reset
    if (source === 'plex') {
      return NextResponse.json(
        { message: 'Plex passwords are managed through plex.tv and cannot be reset here.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: 'Invalid source' }, { status: 400 });
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json(
      { message: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
