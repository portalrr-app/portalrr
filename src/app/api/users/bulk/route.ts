import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { bulkUsersSchema, validateBody } from '@/lib/validation';
import { decryptServerSecrets } from '@/lib/crypto';
import { logOnError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const auth = await authenticateAdmin(request);
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const parsed = validateBody(bulkUsersSchema, body);
  if (!parsed.success) return parsed.response;

  const { action, userIds, localIds, remoteUserIds, serverId, profile } = parsed.data;
  const effectiveLocalIds = (localIds || userIds).filter(Boolean);
  const effectiveRemoteIds = (remoteUserIds || userIds).filter(Boolean);

  if (action === 'delete') {
    if (serverId) {
      const server = await prisma.server.findUnique({ where: { id: serverId } }).then(s => s ? decryptServerSecrets(s) : null);
      if (server?.type === 'jellyfin' && server.apiKey) {
        for (const remoteId of effectiveRemoteIds) {
          await fetch(`${server.url}/Users/${remoteId}`, {
            method: 'DELETE',
            headers: { 'X-MediaBrowser-Token': server.apiKey },
          }).catch(logOnError('users/bulk:jellyfin-delete'));
        }
      } else if (server?.type === 'plex' && server.token) {
        // Fetch the friends list once, then remove each matching user
        try {
          const friendsRes = await fetch('https://plex.tv/api/v2/friends', {
            headers: {
              'X-Plex-Token': server.token,
              'Accept': 'application/json',
              'X-Plex-Client-Identifier': 'portalrr',
            },
          });

          if (friendsRes.ok) {
            const friendList = await friendsRes.json() as Array<{ id?: string | number; username?: string; title?: string }>;

            // Build a set of remote IDs for fast lookup
            const remoteIdSet = new Set(effectiveRemoteIds.map(String));

            // Also look up local usernames for matching by name
            const localUsers = effectiveLocalIds.length > 0
              ? await prisma.user.findMany({
                  where: { id: { in: effectiveLocalIds } },
                  select: { username: true },
                })
              : [];
            const localUsernameSet = new Set(localUsers.map(u => u.username.toLowerCase()));

            for (const friend of friendList) {
              const friendId = String(friend.id);
              const friendName = (friend.title || friend.username || '').toLowerCase();

              if (remoteIdSet.has(friendId) || localUsernameSet.has(friendName)) {
                await fetch(`https://plex.tv/api/v2/friends/${friend.id}`, {
                  method: 'DELETE',
                  headers: {
                    'X-Plex-Token': server.token!,
                    'X-Plex-Client-Identifier': 'portalrr',
                  },
                }).catch(logOnError('users/bulk:plex-delete'));
              }
            }
          }
        } catch (err) {
          console.error('Failed to remove Plex friends during bulk delete:', err);
        }
      }
    }

    await prisma.user.deleteMany({
      where: { id: { in: effectiveLocalIds } },
    });

    return NextResponse.json({ success: true, count: effectiveLocalIds.length });
  }

  if (action === 'disable') {
    await prisma.user.updateMany({
      where: { id: { in: effectiveLocalIds } },
      data: { disabled: true, disabledAt: new Date() },
    });
    return NextResponse.json({ success: true, count: effectiveLocalIds.length });
  }

  if (action === 'enable') {
    await prisma.user.updateMany({
      where: { id: { in: effectiveLocalIds } },
      data: { disabled: false, disabledAt: null, disabledReason: null },
    });
    return NextResponse.json({ success: true, count: effectiveLocalIds.length });
  }

  if (action === 'apply_profile' && profile) {
    const updateData: Record<string, unknown> = {};
    if (profile.autoRemove !== undefined) updateData.autoRemove = profile.autoRemove;
    if (profile.enableLiveTv !== undefined) updateData.enableLiveTv = profile.enableLiveTv;
    if (profile.allLibraries !== undefined) updateData.allLibraries = profile.allLibraries;
    if (profile.libraries !== undefined) updateData.libraries = JSON.stringify(profile.libraries);
    if (profile.accessDurationDays !== undefined) {
      updateData.accessUntil =
        profile.accessDurationDays > 0
          ? new Date(Date.now() + profile.accessDurationDays * 24 * 60 * 60 * 1000)
          : null;
    }

    await prisma.user.updateMany({
      where: { id: { in: effectiveLocalIds } },
      data: updateData,
    });

    return NextResponse.json({ success: true, count: effectiveLocalIds.length });
  }

  return NextResponse.json({ message: 'Unsupported bulk action' }, { status: 400 });
}
