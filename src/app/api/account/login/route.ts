import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { userLoginSchema, validateBody } from '@/lib/validation';
import { checkRateLimit, RATE_LIMITS, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { logOnError } from '@/lib/logger';
import { decryptServerSecrets, generateSessionToken } from '@/lib/crypto';

// Pre-hash for constant-time comparison when user not found (timing attack mitigation)
const DUMMY_HASH = '$2a$12$x'.padEnd(60, '0');

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`user-login:${ip}`, RATE_LIMITS.login);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    const body = await request.json();
    const parsed = validateBody(userLoginSchema, body);
    if (!parsed.success) return parsed.response;

    const { username, password } = parsed.data;

    // Try local user first
    let user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });
    const settings = await prisma.settings.findFirst({
      select: { expiryPolicy: true },
    });

    if (user?.disabled) {
      return NextResponse.json(
        { message: 'This account has been disabled' },
        { status: 403 }
      );
    }

    if (
      user &&
      user.accessUntil &&
      user.accessUntil < new Date() &&
      settings &&
      ['disable', 'disable_then_delete'].includes(settings.expiryPolicy)
    ) {
      return NextResponse.json(
        { message: 'This account has expired' },
        { status: 403 }
      );
    }

    if (user) {
      if (await bcrypt.compare(password, user.passwordHash)) {
        return createSession(user, request);
      }
    } else {
      // Constant-time: always run bcrypt even if user not found (prevents timing-based enumeration)
      await bcrypt.compare(password, DUMMY_HASH);
    }

    // Fallback: try authenticating against Jellyfin/Plex servers
    const servers = (await prisma.server.findMany({ where: { isActive: true } })).map(decryptServerSecrets);

    for (const server of servers) {
      if (server.type === 'jellyfin' && server.apiKey) {
        const jellyfinUser = await tryJellyfinLogin(server.url, username, password);
        if (jellyfinUser) {
          const existingLocal = await prisma.user.findUnique({
            where: { username: jellyfinUser.username.toLowerCase() },
          });
          if (
            existingLocal?.accessUntil &&
            existingLocal.accessUntil < new Date() &&
            settings &&
            ['disable', 'disable_then_delete'].includes(settings.expiryPolicy)
          ) {
            return NextResponse.json(
              { message: 'This account has expired' },
              { status: 403 }
            );
          }
          // Find or create local user linked to this server
          user = await findOrCreateLocalUser(
            jellyfinUser.username,
            jellyfinUser.email,
            password,
            server.id
          );
          return createSession(user, request);
        }
      }

      if (server.type === 'plex' && server.token) {
        const plexUser = await tryPlexLogin(username, password);
        if (plexUser) {
          // Verify the authenticated Plex user is shared with (or owns) this server
          const isAuthorized = await isPlexUserAuthorizedForServer(
            plexUser.username,
            plexUser.email,
            server.token
          );
          if (!isAuthorized) continue; // Not shared with this server, try next

          const existingLocal = await prisma.user.findUnique({
            where: { username: plexUser.username.toLowerCase() },
          });
          if (
            existingLocal?.accessUntil &&
            existingLocal.accessUntil < new Date() &&
            settings &&
            ['disable', 'disable_then_delete'].includes(settings.expiryPolicy)
          ) {
            return NextResponse.json(
              { message: 'This account has expired' },
              { status: 403 }
            );
          }
          user = await findOrCreateLocalUser(
            plexUser.username,
            plexUser.email,
            password,
            server.id
          );
          return createSession(user, request);
        }
      }
    }

    return NextResponse.json(
      { message: 'Invalid username or password' },
      { status: 401 }
    );
  } catch (error) {
    console.error('User login error:', error);
    return NextResponse.json(
      { message: 'Login failed' },
      { status: 500 }
    );
  }
}

async function createSession(user: { id: string; username: string; email: string; [key: string]: unknown }, request?: NextRequest) {
  // Clean up expired sessions
  await prisma.userSession.deleteMany({
    where: { userId: user.id, expiresAt: { lt: new Date() } },
  }).catch(logOnError('account/login:session-cleanup'));

  const session = await prisma.userSession.create({
    data: {
      id: generateSessionToken(),
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: request ? getClientIp(request) : null,
      userAgent: request?.headers.get('user-agent')?.substring(0, 500) || null,
    },
  });

  const response = NextResponse.json({
    success: true,
    user: { id: user.id, username: user.username, email: user.email },
  });

  response.cookies.set('user_session', session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.INSECURE_COOKIES !== 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });

  return response;
}

async function tryJellyfinLogin(
  serverUrl: string,
  username: string,
  password: string
): Promise<{ username: string; email: string; jellyfinId: string } | null> {
  try {
    const res = await fetch(`${serverUrl}/Users/AuthenticateByName`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Authorization': 'MediaBrowser Client="Portalrr", Device="Server", DeviceId="portalrr-login", Version="1.0.0"',
      },
      body: JSON.stringify({ Username: username, Pw: password }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return {
      username: data.User?.Name || username,
      email: data.User?.Policy?.Email || '',
      jellyfinId: data.User?.Id || '',
    };
  } catch {
    return null;
  }
}

async function tryPlexLogin(
  username: string,
  password: string
): Promise<{ username: string; email: string } | null> {
  try {
    const res = await fetch('https://plex.tv/api/v2/users/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Plex-Client-Identifier': 'portalrr-login',
        'X-Plex-Product': 'Portalrr',
      },
      body: JSON.stringify({ login: username, password, rememberMe: false }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return {
      username: data.username || data.title || username,
      email: data.email || '',
    };
  } catch {
    return null;
  }
}

/**
 * Check if a Plex user is authorized for a server — either as the server owner
 * or as a friend/shared user. Uses the plex.tv/api/users endpoint (same as
 * server-access route) to fetch the friends list.
 */
async function isPlexUserAuthorizedForServer(
  username: string,
  email: string,
  serverToken: string
): Promise<boolean> {
  try {
    // First check if the user IS the server owner by fetching the owner's account
    const ownerRes = await fetch('https://plex.tv/api/v2/user', {
      headers: {
        'X-Plex-Token': serverToken,
        'Accept': 'application/json',
      },
    });
    if (ownerRes.ok) {
      const owner = await ownerRes.json();
      if (
        (owner.username && owner.username.toLowerCase() === username.toLowerCase()) ||
        (owner.email && email && owner.email.toLowerCase() === email.toLowerCase())
      ) {
        return true;
      }
    }

    // Check if the user is in the server's friends/shared users list
    const friendsRes = await fetch('https://plex.tv/api/users', {
      headers: { 'X-Plex-Token': serverToken, 'Accept': 'application/json' },
    });
    if (!friendsRes.ok) return false;

    const friendsData = await friendsRes.json();
    const friends = friendsData?.MediaContainer?.User || [];
    const friendList = Array.isArray(friends) ? friends : [friends];

    return friendList.some(
      (f: { title?: string; username?: string; email?: string }) => {
        const friendName = (f.title || f.username || '').toLowerCase();
        const friendEmail = (f.email || '').toLowerCase();
        return (
          friendName === username.toLowerCase() ||
          (email && friendEmail && friendEmail === email.toLowerCase())
        );
      }
    );
  } catch {
    return false;
  }
}

async function findOrCreateLocalUser(
  username: string,
  email: string,
  password: string,
  serverId: string
) {
  // Check if a local user already exists with this username
  const existing = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
  });

  if (existing) {
    // Only update serverId if not already linked — don't overwrite password on every login
    if (!existing.serverId) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { serverId },
      });
    }
    return existing;
  }

  // Check by email too (only if a real email is provided)
  if (email && !email.includes('@server.local')) {
    const existingByEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingByEmail) {
      if (!existingByEmail.serverId) {
        await prisma.user.update({
          where: { id: existingByEmail.id },
          data: { serverId },
        });
      }
      return existingByEmail;
    }
  }

  // Create a new local user linked to the server
  // Use a unique placeholder email if none provided — include serverId + username to avoid collisions
  const passwordHash = await bcrypt.hash(password, 12);
  const effectiveEmail = email || `${username.toLowerCase()}.${serverId}@mediaserver.local`;

  const user = await prisma.user.create({
    data: {
      username: username.toLowerCase(),
      email: effectiveEmail,
      passwordHash,
      serverId,
    },
  });

  return user;
}
