import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { updateUserSchema, deleteUserSchema, validateBody } from '@/lib/validation';
import { decryptServerSecrets } from '@/lib/crypto';
import { findJellyfinUserByName } from '@/lib/servers/jellyfin';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { dispatchWebhook } from '@/lib/notifications/webhooks';
import { auditLog } from '@/lib/audit';
import { sendTemplatedEmail } from '@/lib/notifications/email-templates';
import { dispatchDiscordNotification } from '@/lib/notifications/discord';
import { dispatchTelegramNotification } from '@/lib/notifications/telegram';
import { logOnError } from '@/lib/logger';

interface ServerUser {
  id: string;
  name: string;
  email?: string;
  lastSeen?: string;
  enableLiveTv?: boolean;
  allLibraries?: boolean;
  libraries?: string[];
  isAdmin?: boolean;
}

async function fetchJellyfinUsers(serverUrl: string, apiKey: string): Promise<ServerUser[]> {
  try {
    const response = await fetch(`${serverUrl}/Users`, {
      headers: {
        'X-MediaBrowser-Token': apiKey,
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.map((user: Record<string, unknown>) => {
      const policy = user.Policy as Record<string, unknown> | undefined;
      return {
        id: user.Id as string,
        name: user.Name as string,
        email: user.Email as string || undefined,
        lastSeen: user.LastActivityDate as string || undefined,
        enableLiveTv: policy?.EnableLiveTvAccess as boolean ?? true,
        allLibraries: policy?.EnableAllFolders as boolean ?? true,
        libraries: (policy?.EnabledFolders as string[]) || [],
        isAdmin: policy?.IsAdministrator === true,
      };
    });
  } catch (error) {
    console.error('Failed to fetch Jellyfin users:', error);
    return [];
  }
}

async function fetchPlexUsers(serverUrl: string, token: string): Promise<ServerUser[]> {
  try {
    const response = await fetch('https://plex.tv/api/v2/friends', {
      headers: {
        'X-Plex-Token': token,
        'Accept': 'application/json',
        'X-Plex-Client-Identifier': 'portalrr',
      },
    });

    if (!response.ok) return [];

    const friends = await response.json();
    return (friends as Array<Record<string, unknown>>)
      .filter((user) => user && user.id)
      .map((user) => ({
        id: String(user.id),
        name: (user.title || user.username || 'Unknown') as string,
        email: (user.email as string) || undefined,
      }));
  } catch (error) {
    console.error('Failed to fetch Plex users:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    const source = searchParams.get('source') || 'all';

    const localWhereClause: Record<string, unknown> = {};

    if (filter === 'active') {
      localWhereClause.OR = [
        { accessUntil: null },
        { accessUntil: { gt: new Date() } },
      ];
    } else if (filter === 'expired') {
      localWhereClause.accessUntil = { not: null, lt: new Date() };
    }

    const localUsers = await prisma.user.findMany({
      where: localWhereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        invite: {
          include: {
            server: true,
          },
        },
        server: true,
        userServers: {
          include: { server: true },
        },
      },
    });

    const servers = (await prisma.server.findMany({
      where: { isActive: true },
    })).map(decryptServerSecrets);

    const serverUsers: Array<{
      id: string;
      username: string;
      email: string | null;
      source: 'jellyfin' | 'plex';
      serverId: string;
      serverName: string;
      lastSeen?: string;
      enableLiveTv?: boolean;
      allLibraries?: boolean;
      libraries?: string[];
      isAdmin?: boolean;
    }> = [];

    const serverUserPromises = servers.map(async (server) => {
      if (server.type === 'jellyfin' && server.apiKey) {
        const users = await fetchJellyfinUsers(server.url, server.apiKey);
        return users.map((user) => ({
          id: user.id,
          username: user.name,
          email: user.email || null,
          source: 'jellyfin' as const,
          serverId: server.id,
          serverName: server.name,
          lastSeen: user.lastSeen,
          enableLiveTv: user.enableLiveTv,
          allLibraries: user.allLibraries,
          libraries: user.libraries,
          isAdmin: user.isAdmin,
        }));
      } else if (server.type === 'plex' && server.token) {
        const users = await fetchPlexUsers(server.url, server.token);
        return users.map((user) => ({
          id: user.id,
          username: user.name,
          email: user.email || null,
          source: 'plex' as const,
          serverId: server.id,
          serverName: server.name,
        }));
      }
      return [];
    });

    const results = await Promise.all(serverUserPromises);
    for (const result of results) {
      serverUsers.push(...result);
    }

    // Auto-create Admin records for Jellyfin admins that don't exist in Portalrr yet
    const settings = await prisma.settings.findFirst();
    if (settings?.mediaServerAuth) {
      const jellyfinAdmins = serverUsers.filter(u => u.source === 'jellyfin' && u.isAdmin);
      if (jellyfinAdmins.length > 0) {
        const existingAdmins = await prisma.admin.findMany({
          select: { username: true },
        });
        const existingUsernames = new Set(existingAdmins.map(a => a.username.toLowerCase()));

        for (const jfAdmin of jellyfinAdmins) {
          if (!existingUsernames.has(jfAdmin.username.toLowerCase())) {
            // Create admin with a random password — they'll authenticate via Jellyfin
            await prisma.admin.create({
              data: {
                username: jfAdmin.username,
                passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
                source: 'jellyfin',
                serverId: jfAdmin.serverId,
              },
            });
            auditLog('admin.auto_created', { username: jfAdmin.username, source: 'jellyfin' });
          }
        }
      }
    }

    const formattedLocalUsers = localUsers.map((user) => {
      const server = user.server || user.invite?.server;
      return {
        id: user.id,
        localId: user.id,
        remoteUserId: null,
        username: user.username,
        email: user.email,
        accessUntil: user.accessUntil?.toISOString() || null,
        autoRemove: user.autoRemove,
        enableLiveTv: user.enableLiveTv,
        allLibraries: user.allLibraries,
        libraries: JSON.parse(user.libraries || '[]'),
        createdAt: user.createdAt.toISOString(),
        source: server?.type || 'local',
        serverId: server?.id || '',
        serverName: server?.name || 'Unknown',
        invite: user.invite ? {
          code: user.invite.code,
        } : null,
        disabled: user.disabled,
        disabledAt: user.disabledAt?.toISOString() || null,
        disabledReason: user.disabledReason,
        notes: user.notes,
        labels: JSON.parse(user.labels || '[]'),
        discordUsername: user.discordUsername,
        telegramUsername: user.telegramUsername,
        matrixId: user.matrixId,
        servers: user.userServers.map((us) => ({
          serverId: us.serverId,
          serverName: us.server.name,
          serverType: us.server.type,
          remoteUserId: us.remoteUserId,
          libraries: JSON.parse(us.libraries || '[]'),
          disabled: us.disabled || false,
        })),
      };
    });

    // Deduplicate: if a local user matches a server user by username, merge them
    // (prefer server user data but keep local metadata like accessUntil, invite, createdAt)
    const localByUsername = new Map(
      formattedLocalUsers.map(u => [u.username.toLowerCase(), u])
    );

    // Include admin users in the list (for stats/watch history) — they'll be tagged with isAdmin
    const mergedServerUsers = serverUsers.map(su => {
      const localMatch = localByUsername.get(su.username.toLowerCase());
      if (localMatch) {
        // Remove from local list — we'll use the merged version
        localByUsername.delete(su.username.toLowerCase());
        return {
          ...localMatch,
          source: su.source,
          serverId: su.serverId,
          serverName: su.serverName,
          remoteUserId: su.id,
          email: su.email || localMatch.email,
          lastSeen: su.lastSeen,
          enableLiveTv: su.enableLiveTv ?? localMatch.enableLiveTv,
          allLibraries: su.allLibraries ?? localMatch.allLibraries,
          libraries: su.libraries ?? localMatch.libraries,
          isAdmin: su.isAdmin || false,
        };
      }
      return {
        ...su,
        localId: null,
        remoteUserId: su.id,
        isAdmin: su.isAdmin || false,
      };
    });

    // Remaining local users that didn't match any server user
    const unmatchedLocalUsers = [...localByUsername.values()];

    // Flag ghost servers: for each user's server memberships, check if they still exist on the server
    const queriedServerIds = new Set(servers.map(s => s.id));
    const usernamesByServer = new Map<string, Set<string>>();
    for (const su of serverUsers) {
      if (!usernamesByServer.has(su.serverId)) usernamesByServer.set(su.serverId, new Set());
      usernamesByServer.get(su.serverId)!.add(su.username.toLowerCase());
    }

    for (const localUser of unmatchedLocalUsers) {
      // Check per-server ghost status using UserServer memberships
      const userServerList = (localUser as Record<string, unknown>).servers as Array<{ serverId: string; serverName: string; serverType: string }> | undefined;
      if (userServerList && userServerList.length > 0) {
        const ghostServers: string[] = [];
        for (const us of userServerList) {
          if (!queriedServerIds.has(us.serverId)) continue; // Server wasn't queried (offline) — don't flag
          const serverNames = usernamesByServer.get(us.serverId);
          if (!serverNames || !serverNames.has(localUser.username.toLowerCase())) {
            ghostServers.push(us.serverId);
          }
        }
        if (ghostServers.length > 0) {
          (localUser as Record<string, unknown>).ghost = true;
          (localUser as Record<string, unknown>).ghostServers = ghostServers;
        }
      } else {
        // Legacy: no UserServer entries, fall back to checking serverId
        if (!localUser.serverId || !queriedServerIds.has(localUser.serverId)) continue;
        const serverNames = usernamesByServer.get(localUser.serverId);
        if (!serverNames || !serverNames.has(localUser.username.toLowerCase())) {
          (localUser as Record<string, unknown>).ghost = true;
          (localUser as Record<string, unknown>).ghostServers = [localUser.serverId];
        }
      }
    }

    const allUsers = [...unmatchedLocalUsers, ...mergedServerUsers].map(u => ({
      ...u,
      source: u.source as 'local' | 'jellyfin' | 'plex',
    }));

    if (source === 'jellyfin') {
      return NextResponse.json(allUsers.filter(u => u.source === 'jellyfin'));
    }

    if (source === 'plex') {
      return NextResponse.json(allUsers.filter(u => u.source === 'plex'));
    }

    return NextResponse.json(allUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { message: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const parsed = validateBody(updateUserSchema, body);
    if (!parsed.success) return parsed.response;

    const { userId, localId, remoteUserId, email, accessUntil, autoRemove, enableLiveTv, allLibraries, libraries, source, serverId,
      disabled, disabledReason, notes, labels, discordUsername, telegramUsername, matrixId, extendDays } = parsed.data;
    const localTargetId = localId || (source === 'local' || !source ? userId : undefined);
    const remoteTargetId = remoteUserId || (source === 'jellyfin' || source === 'plex' ? userId : undefined);

    const updateData: Record<string, unknown> = {};
    if (email !== undefined) {
      if (email) {
        // Check for duplicate email (exclude current user)
        const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (existingUser && existingUser.id !== (localId || userId)) {
          return NextResponse.json({ message: 'This email is already in use by another account' }, { status: 409 });
        }
        updateData.email = email.toLowerCase();
      } else {
        updateData.email = null;
      }
    }
    if (accessUntil !== undefined) updateData.accessUntil = accessUntil ? new Date(accessUntil) : null;
    if (autoRemove !== undefined) updateData.autoRemove = autoRemove;
    if (enableLiveTv !== undefined) updateData.enableLiveTv = enableLiveTv;
    if (allLibraries !== undefined) updateData.allLibraries = allLibraries;
    if (libraries !== undefined) updateData.libraries = JSON.stringify(libraries);
    if (notes !== undefined) updateData.notes = notes;
    if (labels !== undefined) updateData.labels = JSON.stringify(labels);
    if (discordUsername !== undefined) updateData.discordUsername = discordUsername;
    if (telegramUsername !== undefined) updateData.telegramUsername = telegramUsername;
    if (matrixId !== undefined) updateData.matrixId = matrixId;

    // Handle disable/enable
    if (disabled !== undefined) {
      updateData.disabled = disabled;
      if (disabled) {
        updateData.disabledAt = new Date();
        updateData.disabledReason = disabledReason || null;
      } else {
        updateData.disabledAt = null;
        updateData.disabledReason = null;
      }
    }

    // Handle extend expiry
    if (extendDays && localTargetId) {
      const user = await prisma.user.findUnique({ where: { id: localTargetId }, select: { accessUntil: true } });
      if (user) {
        const base = user.accessUntil && user.accessUntil > new Date() ? user.accessUntil : new Date();
        const extended = new Date(base);
        extended.setDate(extended.getDate() + extendDays);
        updateData.accessUntil = extended;
      }
    }

    let user;

    if (source === 'local' || !source) {
      user = await prisma.user.update({
        where: { id: localTargetId! },
        data: updateData,
      });
    } else {
      const server = await prisma.server.findUnique({
        where: { id: serverId },
      }).then(s => s ? decryptServerSecrets(s) : null);

      if (!server) {
        return NextResponse.json(
          { message: 'Server not found' },
          { status: 404 }
        );
      }

      if (server.type === 'jellyfin' && server.apiKey) {
        const jellyfinUserRes = await fetch(`${server.url}/Users/${remoteTargetId}`, {
          headers: { 'X-MediaBrowser-Token': server.apiKey },
        });

        if (jellyfinUserRes.ok) {
          const userData = await jellyfinUserRes.json();
          const currentPolicy = userData.Policy || {};

          const updatedPolicy = {
            ...currentPolicy,
            ...(disabled !== undefined && { IsDisabled: disabled }),
            ...(enableLiveTv !== undefined && { EnableLiveTvAccess: enableLiveTv }),
            ...(allLibraries !== undefined && {
              EnableAllFolders: allLibraries,
              ...(allLibraries && { EnabledFolders: [] }),
            }),
            ...(!allLibraries && libraries && Array.isArray(libraries) && { EnabledFolders: libraries }),
          };

          const policyRes = await fetch(`${server.url}/Users/${remoteTargetId}/Policy`, {
            method: 'POST',
            headers: {
              'X-MediaBrowser-Token': server.apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatedPolicy),
          });

          if (!policyRes.ok) {
            console.error(`Failed to update Jellyfin policy for user ${remoteTargetId}: ${policyRes.status}`);
          }
        }
      } else if (server.type === 'plex' && server.token && libraries !== undefined) {
        // Update Plex shared library access
        try {
          // Get machine identifier
          const identityRes = await fetch(`${server.url}/identity`, {
            headers: { 'X-Plex-Token': server.token, 'Accept': 'application/json' },
          });
          if (identityRes.ok) {
            const identity = await identityRes.json();
            const machineId = identity?.MediaContainer?.machineIdentifier;
            if (machineId) {
              // Get shared servers to find this user's sharing entry
              const sharedRes = await fetch(`https://plex.tv/api/v2/shared_servers/${machineId}`, {
                headers: { 'X-Plex-Token': server.token, 'Accept': 'application/json' },
              });
              if (sharedRes.ok) {
                const shared = await sharedRes.json();
                // Find the shared entry for this user by their Plex ID
                let plexUserId = remoteTargetId;
                if (!plexUserId && localTargetId) {
                  // Look up Plex ID from friends list
                  const friendsRes = await fetch('https://plex.tv/api/users', {
                    headers: { 'X-Plex-Token': server.token, 'Accept': 'application/json' },
                  });
                  if (friendsRes.ok) {
                    const friendsData = await friendsRes.json();
                    const friends = friendsData?.MediaContainer?.User || [];
                    const friendList = Array.isArray(friends) ? friends : [friends];
                    const localUser = await prisma.user.findUnique({ where: { id: localTargetId }, select: { username: true } });
                    if (localUser) {
                      const match = friendList.find(
                        (f: { title?: string; username?: string }) =>
                          (f.title || f.username || '').toLowerCase() === localUser.username.toLowerCase()
                      );
                      if (match) plexUserId = String(match.id);
                    }
                  }
                }

                const sharedServers = Array.isArray(shared) ? shared : [];
                const userShared = sharedServers.find(
                  (s: { userID?: string | number }) => String(s.userID) === plexUserId
                );

                if (userShared?.id) {
                  // Strip the 'plex-lib-' prefix from library IDs to get section IDs
                  const sectionIds = (libraries || []).map((id: string) =>
                    id.startsWith('plex-lib-') ? Number(id.replace('plex-lib-', '')) : Number(id)
                  ).filter(Boolean);

                  const updateRes = await fetch(`https://plex.tv/api/v2/shared_servers/${userShared.id}`, {
                    method: 'PUT',
                    headers: {
                      'X-Plex-Token': server.token,
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                    },
                    body: JSON.stringify({ librarySectionIds: sectionIds }),
                  });
                  if (!updateRes.ok) {
                    console.error(`Failed to update Plex shared libraries: ${updateRes.status}`);
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error('Failed to update Plex library access:', err);
        }
      }

      if (localTargetId) {
        user = await prisma.user.update({
          where: { id: localTargetId },
          data: updateData,
        });
      } else if (Object.keys(updateData).length > 0 && remoteTargetId) {
        // Remote-only user with no local record — create one to store metadata
        const username = (await (async () => {
          if (server && server.type === 'jellyfin' && server.apiKey) {
            const res = await fetch(`${server.url}/Users/${remoteTargetId}`, {
              headers: { 'X-MediaBrowser-Token': server.apiKey },
            });
            if (res.ok) { const d = await res.json(); return d.Name; }
          }
          return remoteTargetId;
        })());

        user = await prisma.user.create({
          data: {
            username: username.toLowerCase(),
            email: (updateData.email as string) || '',
            passwordHash: '',
            serverId: serverId || undefined,
            notes: (updateData.notes as string) || null,
            discordUsername: (updateData.discordUsername as string) || null,
            telegramUsername: (updateData.telegramUsername as string) || null,
            matrixId: (updateData.matrixId as string) || null,
            disabled: (updateData.disabled as boolean) || false,
            libraries: (updateData.libraries as string) || '[]',
          },
        });

        // Create UserServer membership so the user is linked
        if (serverId) {
          await prisma.userServer.create({
            data: {
              userId: user.id,
              serverId,
              remoteUserId: remoteTargetId,
            },
          }).catch(() => {}); // Ignore if already exists
        }
      }
    }

    // Fire webhook events for disable/enable
    if (disabled !== undefined && user) {
      const event = disabled ? 'user.disabled' : 'user.enabled';
      dispatchWebhook(event, { username: user.username, email: user.email, reason: disabledReason });
      auditLog(event, { admin: auth.admin.username, targetUser: user.username, reason: disabledReason });
      if (disabled) {
        sendTemplatedEmail(user.email, 'account_disabled', { username: user.username, reason: disabledReason }).catch(logOnError('users:disable-email'));
        dispatchDiscordNotification('user.disabled', {
          username: user.username,
          reason: disabledReason,
          discordId: user.discordId,
        }).catch(logOnError('users:discord-notify'));
      }
      // Telegram bot notification (fire-and-forget)
      dispatchTelegramNotification(event, {
        username: user.username,
        email: user.email,
        reason: disabledReason,
      }).catch(logOnError('users:telegram-notify'));
    }

    return NextResponse.json(
      user
        ? {
            id: user.id,
            email: user.email,
            username: user.username,
            accessUntil: user.accessUntil?.toISOString() || null,
            autoRemove: user.autoRemove,
            enableLiveTv: user.enableLiveTv,
            allLibraries: user.allLibraries,
            libraries: JSON.parse(user.libraries || '[]'),
            disabled: user.disabled,
            disabledAt: user.disabledAt?.toISOString() || null,
            disabledReason: user.disabledReason,
            notes: user.notes,
            labels: JSON.parse(user.labels || '[]'),
            discordUsername: user.discordUsername,
            telegramUsername: user.telegramUsername,
            matrixId: user.matrixId,
          }
        : { success: true }
    );
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { message: 'Failed to update user' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const parsed = validateBody(deleteUserSchema, body);
    if (!parsed.success) return parsed.response;

    const { userId, localId, remoteUserId, source, serverId } = parsed.data;
    const localTargetId = localId || (source === 'local' ? userId : undefined);
    const remoteTargetId = remoteUserId || (source === 'jellyfin' || source === 'plex' ? userId : undefined);

    if (source === 'local') {
      const user = await prisma.user.findUnique({ where: { id: localTargetId! }, select: { username: true, email: true, discordId: true } });
      await prisma.user.delete({
        where: { id: localTargetId! },
      });
      if (user) {
        dispatchWebhook('user.deleted', { username: user.username, email: user.email });
        auditLog('user.deleted', { admin: auth.admin.username, targetUser: user.username });
        dispatchDiscordNotification('user.deleted', {
          username: user.username,
          discordId: user.discordId,
        }).catch(logOnError('users:delete-discord'));
        dispatchTelegramNotification('user.deleted', {
          username: user.username,
          email: user.email,
        }).catch(logOnError('users:delete-telegram'));
      }
      return NextResponse.json({ success: true });
    }

    if (source === 'jellyfin' || source === 'plex') {
      const server = await prisma.server.findUnique({
        where: { id: serverId },
      }).then(s => s ? decryptServerSecrets(s) : null);

      if (!server) {
        return NextResponse.json(
          { message: 'Server not found' },
          { status: 404 }
        );
      }

      if (source === 'jellyfin') {
        // Resolve the Jellyfin user ID — remoteTargetId may be a cuid if the user was created via Portalrr
        let jellyfinUserId = remoteTargetId;
        if (localTargetId && server.apiKey) {
          const localUser = await prisma.user.findUnique({ where: { id: localTargetId }, select: { username: true } });
          if (localUser) {
            const resolved = await findJellyfinUserByName(server.url, server.apiKey, localUser.username);
            if (resolved) jellyfinUserId = resolved;
          }
        }

        const response = await fetch(`${server.url}/Users/${jellyfinUserId}`, {
          method: 'DELETE',
          headers: {
            'X-MediaBrowser-Token': server.apiKey!,
          },
        });

        // 404 is fine — user already gone from server (e.g. after a server wipe)
        if (!response.ok && response.status !== 404) {
          return NextResponse.json(
            { message: 'Failed to delete user from Jellyfin' },
            { status: 400 }
          );
        }
      } else if (source === 'plex') {
        let removed = false;

        // Try removing via friends API (for accepted friends)
        try {
          const friendsRes = await fetch('https://plex.tv/api/v2/friends', {
            headers: {
              'X-Plex-Token': server.token!,
              'Accept': 'application/json',
              'X-Plex-Client-Identifier': 'portalrr',
            },
          });

          if (friendsRes.ok) {
            const friendList = await friendsRes.json();
            let friend = (friendList as Array<{ id?: string | number; username?: string; title?: string }>)
              .find((f) => String(f.id) === remoteTargetId);

            if (!friend && localTargetId) {
              const localUser = await prisma.user.findUnique({ where: { id: localTargetId }, select: { username: true } });
              if (localUser) {
                friend = (friendList as Array<{ id?: string | number; username?: string; title?: string }>)
                  .find((f) => (f.title || f.username || '').toLowerCase() === localUser.username.toLowerCase());
              }
            }

            if (friend) {
              const delRes = await fetch(`https://plex.tv/api/v2/friends/${friend.id}`, {
                method: 'DELETE',
                headers: {
                  'X-Plex-Token': server.token!,
                  'X-Plex-Client-Identifier': 'portalrr',
                },
              });
              removed = delRes.ok;
            }
          }
        } catch (err) {
          console.error('Failed to remove Plex friend:', err);
        }

        // If not found as friend, try removing via shared_servers (for pending invites)
        if (!removed) {
          try {
            const identityRes = await fetch(`${server.url}/identity`, {
              headers: { 'X-Plex-Token': server.token!, 'Accept': 'application/json' },
            });
            if (identityRes.ok) {
              const identity = await identityRes.json();
              const machineId = identity?.MediaContainer?.machineIdentifier;
              if (machineId) {
                const sharedRes = await fetch(`https://plex.tv/api/v2/shared_servers/${machineId}`, {
                  headers: {
                    'X-Plex-Token': server.token!,
                    'Accept': 'application/json',
                    'X-Plex-Client-Identifier': 'portalrr',
                  },
                });
                if (sharedRes.ok) {
                  const sharedServers = await sharedRes.json();
                  const sharedList = Array.isArray(sharedServers) ? sharedServers : [];

                  // Match by invited email or username
                  const localUser = localTargetId
                    ? await prisma.user.findUnique({ where: { id: localTargetId }, select: { username: true, email: true } })
                    : null;

                  const match = sharedList.find((s: { invited?: { email?: string; username?: string; title?: string }; userID?: string | number }) => {
                    if (remoteTargetId && String(s.userID) === remoteTargetId) return true;
                    if (localUser?.email && s.invited?.email === localUser.email) return true;
                    if (localUser?.username && (s.invited?.username || s.invited?.title || '').toLowerCase() === localUser.username.toLowerCase()) return true;
                    return false;
                  });

                  if (match?.id) {
                    await fetch(`https://plex.tv/api/v2/shared_servers/${match.id}`, {
                      method: 'DELETE',
                      headers: {
                        'X-Plex-Token': server.token!,
                        'X-Plex-Client-Identifier': 'portalrr',
                      },
                    });
                  }
                }
              }
            }
          } catch (err) {
            console.error('Failed to remove Plex shared server:', err);
          }
        }
      }

      if (localTargetId) {
        await prisma.user.deleteMany({
          where: { id: localTargetId },
        });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { message: 'Invalid source' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { message: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
