import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { importUsersSchema, validateBody } from '@/lib/validation';
import { decryptServerSecrets } from '@/lib/crypto';
import { auditLog } from '@/lib/audit';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const validation = validateBody(importUsersSchema, body);
    if (!validation.success) return validation.response;

    const { serverId, userIds } = validation.data;

    // Fetch and decrypt the server record
    const rawServer = await prisma.server.findUnique({ where: { id: serverId } });
    if (!rawServer) {
      return NextResponse.json(
        { message: 'Server not found' },
        { status: 404 }
      );
    }

    const server = decryptServerSecrets(rawServer);

    let imported = 0;
    let skipped = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    for (const userId of userIds) {
      try {
        // Fetch user details from the media server
        const userDetails = await fetchServerUser(server, userId);
        if (!userDetails) {
          errors.push({ userId, error: 'User not found on server' });
          skipped++;
          continue;
        }

        // Check if username already exists locally
        const existing = await prisma.user.findUnique({
          where: { username: userDetails.username },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Also check email uniqueness if email is available
        const email = userDetails.email || null;
        if (email) {
          const existingEmail = await prisma.user.findUnique({
            where: { email },
          });

          if (existingEmail) {
            skipped++;
            continue;
          }
        }

        // Generate a random password hash (users will authenticate via media server)
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const passwordHash = await bcrypt.hash(randomPassword, 12);

        await prisma.user.create({
          data: {
            email,
            username: userDetails.username,
            passwordHash,
            serverId: server.id,
          },
        });

        imported++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ userId, error: message });
        skipped++;
      }
    }

    auditLog('users.imported', {
      admin: auth.admin.username,
      serverId,
      serverName: server.name,
      imported,
      skipped,
      total: userIds.length,
    });

    return NextResponse.json({ imported, skipped, total: userIds.length, errors });
  } catch (error) {
    console.error('Error importing users:', error);
    return NextResponse.json(
      { message: 'Failed to import users' },
      { status: 500 }
    );
  }
}

/**
 * Fetch user details from the media server.
 */
async function fetchServerUser(
  server: { type: string; url: string; token?: string | null; apiKey?: string | null },
  userId: string
): Promise<{ username: string; email?: string } | null> {
  if (server.type === 'jellyfin') {
    return fetchJellyfinUser(server.url, server.apiKey || server.token || '', userId);
  }

  if (server.type === 'plex') {
    return fetchPlexFriend(server.url, server.token || '', userId);
  }

  return null;
}

/**
 * Jellyfin: GET /Users/{id}
 */
async function fetchJellyfinUser(
  serverUrl: string,
  apiKey: string,
  userId: string
): Promise<{ username: string; email?: string } | null> {
  const res = await fetch(`${serverUrl}/Users/${userId}`, {
    headers: { 'X-MediaBrowser-Token': apiKey },
  });

  if (!res.ok) return null;

  const data = await res.json();
  return {
    username: data.Name,
    email: data.Policy?.Email || undefined,
  };
}

/**
 * Plex: Fetch from friends list and match by user ID.
 */
async function fetchPlexFriend(
  serverUrl: string,
  token: string,
  userId: string
): Promise<{ username: string; email?: string } | null> {
  // Plex friends are fetched from plex.tv
  const res = await fetch('https://plex.tv/api/v2/friends', {
    headers: {
      'X-Plex-Token': token,
      'X-Plex-Client-Identifier': 'portalrr',
      Accept: 'application/json',
    },
  });

  if (!res.ok) return null;

  const friends = await res.json();
  const friend = friends.find(
    (f: { id: number; username: string; email: string }) =>
      String(f.id) === userId
  );

  if (!friend) return null;

  return {
    username: friend.username || friend.title,
    email: friend.email || undefined,
  };
}
