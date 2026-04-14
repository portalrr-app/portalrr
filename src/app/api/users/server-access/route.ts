import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { grantServerAccessSchema, revokeServerAccessSchema, validateBody } from '@/lib/validation';
import { decryptServerSecrets } from '@/lib/crypto';
import { auditLog } from '@/lib/audit';
import { sendTemplatedEmail } from '@/lib/notifications/email-templates';
import { logOnError } from '@/lib/logger';

/**
 * POST — Grant a local user access to a media server (create account on Jellyfin/Plex)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const parsed = validateBody(grantServerAccessSchema, body);
    if (!parsed.success) return parsed.response;

    const { userId, serverId, libraries } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const server = await prisma.server.findUnique({ where: { id: serverId } })
      .then(s => s ? decryptServerSecrets(s) : null);

    if (!server) {
      return NextResponse.json({ message: 'Server not found' }, { status: 404 });
    }

    // Check if user already has a UserServer record for this server
    const existingMembership = await prisma.userServer.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (existingMembership) {
      return NextResponse.json({ message: 'User already has access to this server' }, { status: 409 });
    }

    let remoteUserId: string | null = null;

    if (server.type === 'jellyfin' && server.apiKey) {
      // Check if user already exists on Jellyfin
      const existingRes = await fetch(`${server.url}/Users`, {
        headers: { 'X-MediaBrowser-Token': server.apiKey },
      });
      if (existingRes.ok) {
        const existingUsers = await existingRes.json();
        const exists = existingUsers.find(
          (u: { Name: string }) => u.Name.toLowerCase() === user.username.toLowerCase()
        );
        if (exists) {
          return NextResponse.json({ message: 'User already exists on this Jellyfin server' }, { status: 409 });
        }
      }

      // Create user on Jellyfin
      const createRes = await fetch(`${server.url}/Users/New`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MediaBrowser-Token': server.apiKey,
        },
        body: JSON.stringify({ Name: user.username }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text().catch(() => '');
        return NextResponse.json(
          { message: `Failed to create Jellyfin user: ${createRes.status} ${errText}` },
          { status: 502 }
        );
      }

      const newUser = await createRes.json();
      remoteUserId = newUser.Id || null;

      // Set library access if specified
      if (remoteUserId && libraries.length > 0) {
        await fetch(`${server.url}/Users/${remoteUserId}/Policy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-MediaBrowser-Token': server.apiKey,
          },
          body: JSON.stringify({
            EnableAllFolders: false,
            EnabledFolders: libraries,
          }),
        });
      }
    } else if (server.type === 'plex' && server.token) {
      if (!user.email) {
        return NextResponse.json(
          { message: 'Plex requires an email address. Please add an email to this user first.' },
          { status: 400 }
        );
      }

      // Get machine identifier
      const identityRes = await fetch(`${server.url}/identity`, {
        headers: { 'X-Plex-Token': server.token, 'Accept': 'application/json' },
      });

      if (!identityRes.ok) {
        return NextResponse.json({ message: 'Failed to connect to Plex server' }, { status: 502 });
      }

      const identity = await identityRes.json();
      const machineId = identity?.MediaContainer?.machineIdentifier;
      if (!machineId) {
        return NextResponse.json({ message: 'Could not determine Plex server identifier' }, { status: 502 });
      }

      // Check if user is already shared with
      const friendsRes = await fetch('https://plex.tv/api/users', {
        headers: { 'X-Plex-Token': server.token, 'Accept': 'application/json' },
      });
      if (friendsRes.ok) {
        const friendsData = await friendsRes.json();
        const friends = friendsData?.MediaContainer?.User || [];
        const friendList = Array.isArray(friends) ? friends : [friends];
        const exists = friendList.find(
          (f: { title?: string; username?: string }) =>
            (f.title || f.username || '').toLowerCase() === user.username.toLowerCase()
        );
        if (exists) {
          return NextResponse.json({ message: 'User already has access to this Plex server' }, { status: 409 });
        }
      }

      // Strip plex-lib- prefix from library IDs
      const sectionIds = libraries
        .map((id: string) => id.startsWith('plex-lib-') ? Number(id.replace('plex-lib-', '')) : Number(id))
        .filter(Boolean);

      // Invite user by email via plex.tv shared_servers API
      const inviteRes = await fetch('https://plex.tv/api/v2/shared_servers', {
        method: 'POST',
        headers: {
          'X-Plex-Token': server.token,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Plex-Client-Identifier': 'portalrr',
        },
        body: JSON.stringify({
          machineIdentifier: machineId,
          invitedEmail: user.email,
          librarySectionIds: sectionIds,
          settings: {},
        }),
      });

      if (!inviteRes.ok) {
        const errText = await inviteRes.text().catch(() => '');
        return NextResponse.json(
          { message: `Failed to invite user to Plex: ${inviteRes.status} ${errText}` },
          { status: 502 }
        );
      }
    } else {
      return NextResponse.json({ message: 'Server type not supported or missing credentials' }, { status: 400 });
    }

    // Create UserServer membership
    await prisma.userServer.create({
      data: {
        userId,
        serverId,
        remoteUserId,
        libraries: JSON.stringify(libraries),
      },
    });

    // Set as primary server if user doesn't have one
    if (!user.serverId) {
      await prisma.user.update({
        where: { id: userId },
        data: { serverId },
      });
    }

    auditLog('user.server_access_granted', {
      admin: auth.admin.username,
      targetUser: user.username,
      server: server.name,
    });

    // Notify user via email (fire-and-forget)
    if (user.email) {
      sendTemplatedEmail(user.email, 'server_access', {
        username: user.username,
        addedServerName: server.name,
        serverType: server.type === 'jellyfin' ? 'Jellyfin' : 'Plex',
        isJellyfin: server.type === 'jellyfin',
        isPlex: server.type === 'plex',
      }).catch(logOnError('server-access:email'));
    }

    return NextResponse.json({ success: true, message: `User added to ${server.name}` });
  } catch (error) {
    console.error('Error granting server access:', error);
    return NextResponse.json({ message: 'Failed to grant server access' }, { status: 500 });
  }
}

/**
 * DELETE — Revoke a user's access from a media server (remove from Jellyfin/Plex but keep local user)
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const parsed = validateBody(revokeServerAccessSchema, body);
    if (!parsed.success) return parsed.response;

    const { userId, serverId, action } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const server = await prisma.server.findUnique({ where: { id: serverId } })
      .then(s => s ? decryptServerSecrets(s) : null);

    if (!server) {
      return NextResponse.json({ message: 'Server not found' }, { status: 404 });
    }

    if (server.type === 'jellyfin' && server.apiKey) {
      // Find the Jellyfin user by username
      const usersRes = await fetch(`${server.url}/Users`, {
        headers: { 'X-MediaBrowser-Token': server.apiKey },
      });

      if (usersRes.ok) {
        const jellyfinUsers = await usersRes.json();
        const match = jellyfinUsers.find(
          (u: { Name: string }) => u.Name.toLowerCase() === user.username.toLowerCase()
        );

        if (match) {
          if (action === 'disable') {
            // Fetch current user to get full policy, then merge IsDisabled
            const userRes = await fetch(`${server.url}/Users/${match.Id}`, {
              headers: { 'X-MediaBrowser-Token': server.apiKey },
            });
            const currentPolicy = userRes.ok ? (await userRes.json()).Policy || {} : {};

            const policyRes = await fetch(`${server.url}/Users/${match.Id}/Policy`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-MediaBrowser-Token': server.apiKey,
              },
              body: JSON.stringify({ ...currentPolicy, IsDisabled: true }),
            });

            if (!policyRes.ok) {
              return NextResponse.json({ message: 'Failed to disable user on Jellyfin' }, { status: 502 });
            }
          } else {
            // Delete the account entirely
            const delRes = await fetch(`${server.url}/Users/${match.Id}`, {
              method: 'DELETE',
              headers: { 'X-MediaBrowser-Token': server.apiKey },
            });

            if (!delRes.ok) {
              return NextResponse.json({ message: 'Failed to remove user from Jellyfin' }, { status: 502 });
            }
          }
        }
      }
    } else if (server.type === 'plex' && server.token) {
      // Find user in friends list by username
      const friendsRes = await fetch('https://plex.tv/api/users', {
        headers: { 'X-Plex-Token': server.token, 'Accept': 'application/json' },
      });

      if (friendsRes.ok) {
        const friendsData = await friendsRes.json();
        const friends = friendsData?.MediaContainer?.User || [];
        const friendList = Array.isArray(friends) ? friends : [friends];
        const match = friendList.find(
          (f: { title?: string; username?: string; id?: number }) =>
            (f.title || f.username || '').toLowerCase() === user.username.toLowerCase()
        );

        if (match) {
          if (action === 'disable') {
            // Remove all library sharing but keep the friend relationship
            // Get machine identifier
            const identityRes = await fetch(`${server.url}/identity`, {
              headers: { 'X-Plex-Token': server.token, 'Accept': 'application/json' },
            });
            if (identityRes.ok) {
              const identity = await identityRes.json();
              const machineId = identity?.MediaContainer?.machineIdentifier;
              if (machineId) {
                // Find the shared server entry for this friend
                const sharedRes = await fetch(
                  `https://plex.tv/api/v2/shared_servers?machineIdentifier=${machineId}`,
                  { headers: { 'X-Plex-Token': server.token, 'Accept': 'application/json' } }
                );
                if (sharedRes.ok) {
                  const sharedData = await sharedRes.json();
                  const sharedServers = Array.isArray(sharedData) ? sharedData : [];
                  const sharedEntry = sharedServers.find(
                    (ss: { userID?: number; userId?: number }) =>
                      (ss.userID || ss.userId) === match.id
                  );
                  if (sharedEntry?.id) {
                    // Update shared server to have no libraries
                    await fetch(`https://plex.tv/api/v2/shared_servers/${sharedEntry.id}`, {
                      method: 'PUT',
                      headers: {
                        'X-Plex-Token': server.token,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                      },
                      body: JSON.stringify({ librarySectionIds: [] }),
                    });
                  }
                }
              }
            }
          } else {
            // Remove friend entirely
            const delRes = await fetch(`https://plex.tv/api/v2/friends/${match.id}`, {
              method: 'DELETE',
              headers: {
                'X-Plex-Token': server.token,
                'X-Plex-Client-Identifier': 'portalrr',
              },
            });

            if (!delRes.ok) {
              return NextResponse.json({ message: 'Failed to remove user from Plex' }, { status: 502 });
            }
          }
        }
      }
    }

    if (action === 'disable') {
      // Mark as disabled in UserServer but keep the record
      await prisma.userServer.updateMany({
        where: { userId, serverId },
        data: { disabled: true },
      });

      auditLog('user.server_access_disabled', {
        admin: auth.admin.username,
        targetUser: user.username,
        server: server.name,
      });

      return NextResponse.json({ success: true, message: `User disabled on ${server.name}` });
    }

    // Delete: Remove UserServer membership
    await prisma.userServer.deleteMany({
      where: { userId, serverId },
    });

    // If this was the user's primary server, clear it or set to next available
    if (user.serverId === serverId) {
      const nextMembership = await prisma.userServer.findFirst({
        where: { userId },
      });
      await prisma.user.update({
        where: { id: userId },
        data: { serverId: nextMembership?.serverId || null },
      });
    }

    auditLog('user.server_access_revoked', {
      admin: auth.admin.username,
      targetUser: user.username,
      server: server.name,
    });

    return NextResponse.json({ success: true, message: `User removed from ${server.name}` });
  } catch (error) {
    console.error('Error revoking server access:', error);
    return NextResponse.json({ message: 'Failed to revoke server access' }, { status: 500 });
  }
}

/**
 * PATCH — Re-enable a disabled user's access on a media server
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const { userId, serverId } = body;

    if (!userId || !serverId) {
      return NextResponse.json({ message: 'userId and serverId are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const membership = await prisma.userServer.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!membership || !membership.disabled) {
      return NextResponse.json({ message: 'User is not disabled on this server' }, { status: 400 });
    }

    const server = await prisma.server.findUnique({ where: { id: serverId } })
      .then(s => s ? decryptServerSecrets(s) : null);

    if (!server) {
      return NextResponse.json({ message: 'Server not found' }, { status: 404 });
    }

    if (server.type === 'jellyfin' && server.apiKey) {
      const usersRes = await fetch(`${server.url}/Users`, {
        headers: { 'X-MediaBrowser-Token': server.apiKey },
      });

      if (usersRes.ok) {
        const jellyfinUsers = await usersRes.json();
        const match = jellyfinUsers.find(
          (u: { Name: string }) => u.Name.toLowerCase() === user.username.toLowerCase()
        );

        if (match) {
          // Fetch current policy, then merge IsDisabled: false
          const userRes = await fetch(`${server.url}/Users/${match.Id}`, {
            headers: { 'X-MediaBrowser-Token': server.apiKey },
          });
          const currentPolicy = userRes.ok ? (await userRes.json()).Policy || {} : {};

          const policyRes = await fetch(`${server.url}/Users/${match.Id}/Policy`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-MediaBrowser-Token': server.apiKey,
            },
            body: JSON.stringify({ ...currentPolicy, IsDisabled: false }),
          });

          if (!policyRes.ok) {
            return NextResponse.json({ message: 'Failed to re-enable user on Jellyfin' }, { status: 502 });
          }
        }
      }
    } else if (server.type === 'plex' && server.token) {
      // Re-share libraries — restore from the stored membership libraries
      const identityRes = await fetch(`${server.url}/identity`, {
        headers: { 'X-Plex-Token': server.token, 'Accept': 'application/json' },
      });
      if (identityRes.ok) {
        const identity = await identityRes.json();
        const machineId = identity?.MediaContainer?.machineIdentifier;
        if (machineId) {
          const friendsRes = await fetch('https://plex.tv/api/users', {
            headers: { 'X-Plex-Token': server.token, 'Accept': 'application/json' },
          });
          if (friendsRes.ok) {
            const friendsData = await friendsRes.json();
            const friends = friendsData?.MediaContainer?.User || [];
            const friendList = Array.isArray(friends) ? friends : [friends];
            const match = friendList.find(
              (f: { title?: string; username?: string }) =>
                (f.title || f.username || '').toLowerCase() === user.username.toLowerCase()
            );
            if (match) {
              const libraries = JSON.parse(membership.libraries || '[]');
              const sectionIds = libraries
                .map((id: string) => id.startsWith('plex-lib-') ? Number(id.replace('plex-lib-', '')) : Number(id))
                .filter(Boolean);

              const sharedRes = await fetch(
                `https://plex.tv/api/v2/shared_servers?machineIdentifier=${machineId}`,
                { headers: { 'X-Plex-Token': server.token, 'Accept': 'application/json' } }
              );
              if (sharedRes.ok) {
                const sharedData = await sharedRes.json();
                const sharedServers = Array.isArray(sharedData) ? sharedData : [];
                const sharedEntry = sharedServers.find(
                  (ss: { userID?: number; userId?: number }) =>
                    (ss.userID || ss.userId) === match.id
                );
                if (sharedEntry?.id) {
                  await fetch(`https://plex.tv/api/v2/shared_servers/${sharedEntry.id}`, {
                    method: 'PUT',
                    headers: {
                      'X-Plex-Token': server.token,
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                    },
                    body: JSON.stringify({ librarySectionIds: sectionIds }),
                  });
                }
              }
            }
          }
        }
      }
    }

    await prisma.userServer.update({
      where: { userId_serverId: { userId, serverId } },
      data: { disabled: false },
    });

    auditLog('user.server_access_enabled', {
      admin: auth.admin.username,
      targetUser: user.username,
      server: server.name,
    });

    return NextResponse.json({ success: true, message: `User re-enabled on ${server.name}` });
  } catch (error) {
    console.error('Error enabling server access:', error);
    return NextResponse.json({ message: 'Failed to enable server access' }, { status: 500 });
  }
}
