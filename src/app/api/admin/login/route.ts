import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { verify } from 'otplib';
import { loginSchema, validateBody } from '@/lib/validation';
import { checkRateLimit, RATE_LIMITS, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { authenticateJellyfinAdmin } from '@/lib/servers/jellyfin';
import { authenticatePlexAdmin } from '@/lib/servers/plex';
import { decrypt, decryptServerSecrets, generateSessionToken } from '@/lib/crypto';
import { randomUUID } from 'crypto';
import { auditLog } from '@/lib/audit';
import { dispatchWebhook } from '@/lib/notifications/webhooks';

async function createSession(adminId: string, request?: NextRequest) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await prisma.adminSession.create({
    data: {
      id: generateSessionToken(),
      adminId,
      expiresAt,
      ipAddress: request ? getClientIp(request) : null,
      userAgent: request?.headers.get('user-agent')?.substring(0, 500) || null,
    },
  });

  await prisma.adminSession.deleteMany({
    where: { adminId, expiresAt: { lt: new Date() } },
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set('admin_session', session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.INSECURE_COOKIES !== 'true',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  return response;
}

async function tryMediaServerAuth(username: string, password: string): Promise<string | null> {
  const settings = await prisma.settings.findFirst();
  if (!settings?.mediaServerAuth) return null;

  const servers = (await prisma.server.findMany({ where: { isActive: true } })).map(decryptServerSecrets);

  for (const server of servers) {
    if (server.type === 'jellyfin' && server.apiKey) {
      const result = await authenticateJellyfinAdmin(server.url, username, password);
      if (result?.isAdmin) {
        // Return existing admin without updating passwordHash
        const existing = await prisma.admin.findUnique({ where: { username } });
        if (existing) return existing.id;

        const admin = await prisma.admin.create({
          data: {
            username,
            passwordHash: await bcrypt.hash(randomUUID(), 12),
            source: 'jellyfin',
            serverId: server.id,
          },
        });
        return admin.id;
      }
    }

    if (server.type === 'plex' && server.token) {
      const isOwner = await authenticatePlexAdmin(server.url, server.token, username, password);
      if (isOwner) {
        // Return existing admin without updating passwordHash
        const existing = await prisma.admin.findUnique({ where: { username } });
        if (existing) return existing.id;

        const admin = await prisma.admin.create({
          data: {
            username,
            passwordHash: await bcrypt.hash(randomUUID(), 12),
            source: 'plex',
            serverId: server.id,
          },
        });
        return admin.id;
      }
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`admin-login:${ip}`, RATE_LIMITS.adminLogin);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    const body = await request.json();
    const parsed = validateBody(loginSchema, body);
    if (!parsed.success) return parsed.response;

    const { username, password, totpCode } = parsed.data;

    const adminCount = await prisma.admin.count();
    if (adminCount === 0) {
      return NextResponse.json(
        { message: 'Setup required', setupRequired: true },
        { status: 403 }
      );
    }

    const admin = await prisma.admin.findUnique({
      where: { username },
    });

    if (admin) {
      // Check account lockout
      if (admin.lockedUntil && admin.lockedUntil > new Date()) {
        const retryAfterMs = admin.lockedUntil.getTime() - Date.now();
        auditLog('admin.login.locked', { username, ip });
        return Response.json(
          { message: 'Account temporarily locked due to too many failed attempts. Try again later.' },
          { status: 423, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
        );
      }

      // Check local password first
      const isLocalValid = await bcrypt.compare(password, admin.passwordHash);

      // If local password fails, try media server auth for this existing admin
      const isMediaValid = !isLocalValid
        ? await tryMediaServerAuth(username, password) !== null
        : false;

      if (isLocalValid || isMediaValid) {
        // Reset failed attempts on success
        if (admin.failedLoginAttempts > 0) {
          await prisma.admin.update({
            where: { id: admin.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }

        // Enforce 2FA regardless of auth method
        if (admin.totpEnabled && admin.totpSecret) {
          if (!totpCode) {
            return NextResponse.json({ message: '2FA verification required', totpRequired: true }, { status: 403 });
          }
          const isTotpValid = verify({ token: totpCode, secret: decrypt(admin.totpSecret) });
          if (!isTotpValid) {
            return NextResponse.json({ message: 'Invalid 2FA code' }, { status: 401 });
          }
        }
        auditLog('admin.login.success', { username, ip, method: isLocalValid ? 'local' : 'media_server' });
        dispatchWebhook('admin.login', { username: admin.username });
        return createSession(admin.id, request);
      }

      // Increment failed attempts and lock after 5 failures
      const attempts = admin.failedLoginAttempts + 1;
      const lockout = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await prisma.admin.update({
        where: { id: admin.id },
        data: { failedLoginAttempts: attempts, lockedUntil: lockout },
      });
    } else {
      // No existing admin — try media server auth to create one
      const mediaAdminId = await tryMediaServerAuth(username, password);
      if (mediaAdminId) {
        auditLog('admin.login.success', { username, ip, method: 'media_server_new' });
        dispatchWebhook('admin.login', { username });
        return createSession(mediaAdminId, request);
      }
    }

    auditLog('admin.login.failed', { username, ip });
    return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  } catch (error) {
    console.error('Error during admin login:', error);
    return NextResponse.json({ message: 'Login failed' }, { status: 500 });
  }
}
