import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { recreateUserSchema, validateBody } from '@/lib/validation';
import { decryptServerSecrets } from '@/lib/crypto';
import { auditLog } from '@/lib/audit';
import { sendTemplatedEmail } from '@/lib/notifications/email-templates';
import { randomBytes } from 'crypto';

/**
 * POST — Recreate a ghost user's account on a media server.
 * Creates the account with a temp password, creates a UserServer row,
 * and triggers a password reset email so the user can set their own password.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const parsed = validateBody(recreateUserSchema, body);
    if (!parsed.success) return parsed.response;

    const { userId, serverId } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const server = await prisma.server.findUnique({ where: { id: serverId } })
      .then(s => s ? decryptServerSecrets(s) : null);

    if (!server) {
      return NextResponse.json({ message: 'Server not found' }, { status: 404 });
    }

    // Check if UserServer already exists
    const existing = await prisma.userServer.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (existing) {
      return NextResponse.json({ message: 'User already has access to this server' }, { status: 409 });
    }

    let remoteUserId: string | null = null;

    if (server.type === 'jellyfin' && server.apiKey) {
      // Check if username already exists on Jellyfin (maybe they re-created manually)
      const existingRes = await fetch(`${server.url}/Users`, {
        headers: { 'X-MediaBrowser-Token': server.apiKey },
      });
      if (existingRes.ok) {
        const existingUsers = await existingRes.json();
        const match = existingUsers.find(
          (u: { Name: string; Id: string }) => u.Name.toLowerCase() === user.username.toLowerCase()
        );
        if (match) {
          // User already exists on server — just link them
          remoteUserId = match.Id;

          await prisma.userServer.create({
            data: { userId, serverId, remoteUserId, libraries: user.libraries || '[]' },
          });

          auditLog('user.recreated', {
            admin: auth.admin.username,
            targetUser: user.username,
            server: server.name,
            method: 'linked_existing',
          });

          return NextResponse.json({
            success: true,
            message: `${user.username} already exists on ${server.name} — linked to their account.`,
            linked: true,
          });
        }
      }

      // Create new Jellyfin account with temp password
      const tempPassword = randomBytes(16).toString('hex');

      const createRes = await fetch(`${server.url}/Users/New`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MediaBrowser-Token': server.apiKey,
        },
        body: JSON.stringify({ Name: user.username, Password: tempPassword }),
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

      // Apply library access from the user's existing config
      const libraries: string[] = JSON.parse(user.libraries || '[]');
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
          { message: 'Plex requires an email address. This user has no email on file.' },
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

      const libraries: string[] = JSON.parse(user.libraries || '[]');
      const sectionIds = libraries
        .map((id: string) => id.startsWith('plex-lib-') ? Number(id.replace('plex-lib-', '')) : Number(id))
        .filter(Boolean);

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
          { message: `Failed to invite to Plex: ${inviteRes.status} ${errText}` },
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
        libraries: user.libraries || '[]',
      },
    });

    // Update primary server if not set
    if (!user.serverId) {
      await prisma.user.update({
        where: { id: userId },
        data: { serverId },
      });
    }

    // Send password reset email so user can set their own password
    if (user.email && server.type === 'jellyfin') {
      const token = randomBytes(32).toString('hex');
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days for recreated accounts
        },
      });

      const baseUrl = (process.env.APP_URL || '').replace(/\/$/, '');
      if (user.email) sendTemplatedEmail(user.email, 'password_reset', {
        username: user.username,
        resetLink: `${baseUrl}/forgot-password?token=${token}`,
      }).catch((err) => {
        console.error('Failed to send reset email for recreated user:', err);
      });
    }

    auditLog('user.recreated', {
      admin: auth.admin.username,
      targetUser: user.username,
      server: server.name,
    });

    return NextResponse.json({
      success: true,
      message: `Account recreated on ${server.name}. ${user.email ? 'A password reset email has been sent.' : 'User will need to reset their password.'}`,
    });
  } catch (error) {
    console.error('Error recreating user:', error);
    return NextResponse.json({ message: 'Failed to recreate user' }, { status: 500 });
  }
}
