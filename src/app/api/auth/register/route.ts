import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { registerSchema, validateBody } from '@/lib/validation';
import { checkRateLimit, RATE_LIMITS, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { decryptServerSecrets } from '@/lib/crypto';
import { verifyCaptchaSignature } from '@/app/api/captcha/route';
import { dispatchWebhook } from '@/lib/notifications/webhooks';
import { sendTemplatedEmail } from '@/lib/notifications/email-templates';
import { auditLog } from '@/lib/audit';
import { dispatchDiscordNotification } from '@/lib/notifications/discord';
import { dispatchTelegramNotification } from '@/lib/notifications/telegram';
import { logOnError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const rl = checkRateLimit(`register:${ip}`, RATE_LIMITS.registration);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    const body = await request.json();
    const parsed = validateBody(registerSchema, body);
    if (!parsed.success) return parsed.response;

    const { code, email, username, password, passphrase } = parsed.data;

    const settings = await prisma.settings.findFirst({
      select: {
        captchaEnabled: true,
        welcomeEmailEnabled: true,
        passwordMinLength: true,
        passwordRequireUppercase: true,
        passwordRequireNumber: true,
        passwordRequireSpecial: true,
      },
    });

    // Validate password against customizable rules
    if (settings) {
      const minLen = settings.passwordMinLength || 8;
      if (password.length < minLen) {
        return NextResponse.json({ message: `Password must be at least ${minLen} characters` }, { status: 400 });
      }
      if (settings.passwordRequireUppercase && !/[A-Z]/.test(password)) {
        return NextResponse.json({ message: 'Password must contain at least one uppercase letter' }, { status: 400 });
      }
      if (settings.passwordRequireNumber && !/\d/.test(password)) {
        return NextResponse.json({ message: 'Password must contain at least one number' }, { status: 400 });
      }
      if (settings.passwordRequireSpecial && !/[^a-zA-Z0-9]/.test(password)) {
        return NextResponse.json({ message: 'Password must contain at least one special character' }, { status: 400 });
      }
    }

    if (settings?.captchaEnabled) {
      const scope = `register-${code.toUpperCase()}`;
      const storedSignature = request.cookies.get(`portalrr_captcha_${scope}`)?.value;
      const userAnswer = String(parsed.data.captchaAnswer ?? '').trim();
      if (!storedSignature || !userAnswer || !verifyCaptchaSignature(userAnswer, scope, storedSignature)) {
        return NextResponse.json(
          { message: 'Captcha verification failed' },
          { status: 400 }
        );
      }
    }

    const invite = await prisma.invite.findUnique({
      where: { code: code.toUpperCase() },
      include: { server: true },
    });

    if (!invite || invite.status !== 'active') {
      return NextResponse.json(
        { message: 'Invalid invite code' },
        { status: 400 }
      );
    }

    if (invite.expiresAt && new Date() > invite.expiresAt) {
      return NextResponse.json(
        { message: 'This invite has expired' },
        { status: 400 }
      );
    }

    if (invite.maxUses > 0 && invite.uses >= invite.maxUses) {
      return NextResponse.json(
        { message: 'This invite has already been used' },
        { status: 400 }
      );
    }

    // Check passphrase if invite is protected
    if (invite.passphrase) {
      if (!passphrase) {
        return NextResponse.json(
          { message: 'This invite requires a passphrase', passphraseRequired: true },
          { status: 403 }
        );
      }
      const passphraseValid = await bcrypt.compare(passphrase, invite.passphrase);
      if (!passphraseValid) {
        return NextResponse.json(
          { message: 'Invalid passphrase' },
          { status: 403 }
        );
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create media server account before the DB transaction — this is an
    // external side-effect that cannot be rolled back by Prisma, so we do it
    // first and only proceed to the atomic DB work if it succeeds.
    const server = invite.server ? decryptServerSecrets(invite.server) : null;
    let remoteUserId: string | null = null;
    if (server) {
      try {
        const libraries: string[] = invite.libraries ? JSON.parse(invite.libraries) : [];
        if (server.type === 'plex' && server.token) {
          await createPlexUser(server.url, server.token, username, email, password, libraries);
        } else if (server.type === 'jellyfin' && server.apiKey) {
          remoteUserId = await createJellyfinUser(server.url, server.apiKey, username, email, password, libraries);
        }
      } catch (error) {
        console.error(`Failed to create ${server.type} user:`, error);
        return NextResponse.json(
          { message: `Failed to create account on ${server.type === 'plex' ? 'Plex' : 'Jellyfin'} server. Please try again or contact the admin.` },
          { status: 502 }
        );
      }
    }

    // Compute accessUntil at redemption time (not invite creation time)
    let accessUntil: Date | undefined = undefined;
    if (invite.accessDurationDays > 0) {
      accessUntil = new Date();
      accessUntil.setDate(accessUntil.getDate() + invite.accessDurationDays);
    } else if (invite.accessUntil) {
      // Backwards compat: use pre-computed accessUntil if accessDurationDays not set
      accessUntil = invite.accessUntil;
    }

    // Use an interactive transaction so the invite claim and user creation are
    // atomic.  If the user.create fails (e.g. unique constraint on
    // email/username from a concurrent request), the invite use-count increment
    // is automatically rolled back.
    let user;
    try {
      user = await prisma.$transaction(async (tx) => {
        // Uniqueness checks inside the transaction to close the race window
        const existingEmail = await tx.user.findUnique({
          where: { email },
        });
        if (existingEmail) {
          throw new Error('__DUPLICATE__');
        }

        const existingUsername = await tx.user.findUnique({
          where: { username: username.toLowerCase() },
        });
        if (existingUsername) {
          throw new Error('__DUPLICATE__');
        }

        // Atomically claim the invite (prevents over-redemption)
        const updated = await tx.invite.updateMany({
          where: {
            id: invite.id,
            status: 'active',
            AND: [
              { OR: [{ maxUses: 0 }, { uses: { lt: invite.maxUses } }] },
              { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
            ],
          },
          data: {
            uses: { increment: 1 },
          },
        });

        if (updated.count === 0) {
          throw new Error('__INVITE_EXHAUSTED__');
        }

        // Mark as 'used' if we've hit max uses — re-read from DB to get the
        // actual post-increment count (the stale `invite.uses` from before the
        // transaction is unreliable under concurrency)
        if (invite.maxUses > 0) {
          const freshInvite = await tx.invite.findUnique({ where: { id: invite.id }, select: { uses: true } });
          if (freshInvite && freshInvite.uses >= invite.maxUses) {
            await tx.invite.update({
              where: { id: invite.id },
              data: { status: 'used' },
            });
          }
        }

        // Create user — if this throws (e.g. unique constraint), the entire
        // transaction (including the invite claim) is rolled back.
        return tx.user.create({
          data: {
            email,
            username: username.toLowerCase(),
            passwordHash,
            inviteId: invite.id,
            serverId: invite.server?.id || undefined,
            accessUntil,
            autoRemove: invite.autoRemove,
            libraries: invite.libraries || '[]',
          },
        });
      });
    } catch (txError: unknown) {
      // Clean up orphaned media server account if the DB transaction failed
      if (server && remoteUserId) {
        try {
          if (server.type === 'jellyfin' && server.apiKey) {
            await fetch(`${server.url}/Users/${remoteUserId}`, {
              method: 'DELETE',
              headers: { 'X-MediaBrowser-Token': server.apiKey },
              signal: AbortSignal.timeout(10000),
            });
            console.log(`Cleaned up orphaned Jellyfin user ${remoteUserId} after transaction failure`);
          }
        } catch (cleanupErr) {
          console.error('Failed to clean up orphaned media server user:', cleanupErr);
        }
      }

      if (txError instanceof Error && txError.message === '__DUPLICATE__') {
        return NextResponse.json(
          { message: 'Registration failed. Please check your details and try again.' },
          { status: 400 }
        );
      }
      if (txError instanceof Error && txError.message === '__INVITE_EXHAUSTED__') {
        return NextResponse.json(
          { message: 'This invite can no longer be used' },
          { status: 400 }
        );
      }
      // Prisma unique constraint violation (race condition fallback)
      if (
        txError instanceof Prisma.PrismaClientKnownRequestError &&
        txError.code === 'P2002'
      ) {
        return NextResponse.json(
          { message: 'Registration failed. Please check your details and try again.' },
          { status: 400 }
        );
      }
      throw txError;
    }

    // Create UserServer membership record
    if (invite.server?.id) {
      await prisma.userServer.create({
        data: {
          userId: user.id,
          serverId: invite.server.id,
          remoteUserId,
          libraries: invite.libraries || '[]',
        },
      }).catch((err) => {
        console.error('Failed to create UserServer record:', err);
      });
    }

    // Fire webhook
    dispatchWebhook('invite.used', { code: invite.code, username: user.username, email: user.email, server: invite.server?.name });
    dispatchWebhook('user.registered', { username: user.username, email: user.email, server: invite.server?.name });
    auditLog('user.registered', { username: user.username, email: user.email, inviteCode: invite.code });

    // Discord bot notification (fire-and-forget)
    dispatchDiscordNotification('user.registered', {
      username: user.username,
      email: user.email,
      server: invite.server?.name,
      discordId: user.discordId,
    }).catch(logOnError('register:discord-notify'));

    // Telegram bot notification (fire-and-forget)
    dispatchTelegramNotification('user.registered', {
      username: user.username,
      email: user.email,
      server: invite.server?.name,
    }).catch(logOnError('register:telegram-notify'));

    // Send welcome email if enabled
    if (settings?.welcomeEmailEnabled) {
      sendTemplatedEmail(user.email, 'welcome', {
        username: user.username,
        accessUntil: user.accessUntil?.toISOString() || null,
      }).catch(logOnError('register:welcome-email'));
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
    });
  } catch (error) {
    console.error('Error registering user:', error);
    return NextResponse.json(
      { message: 'Registration failed' },
      { status: 500 }
    );
  }
}

async function createPlexUser(plexUrl: string, token: string, username: string, email: string, password: string, libraries: string[] = []) {
  // Plex doesn't support creating users directly — invite them via plex.tv
  // First get the server's machine identifier
  const identityRes = await fetch(`${plexUrl}/identity`, {
    headers: { 'X-Plex-Token': token, 'Accept': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });

  if (!identityRes.ok) {
    throw new Error(`Failed to get Plex server identity: ${identityRes.status}`);
  }

  const identity = await identityRes.json();
  const machineId = identity?.MediaContainer?.machineIdentifier;

  if (!machineId) {
    throw new Error('Could not determine Plex server machine identifier');
  }

  // Invite the user by email via plex.tv
  const inviteRes = await fetch(`https://plex.tv/api/v2/shared_servers`, {
    method: 'POST',
    headers: {
      'X-Plex-Token': token,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Plex-Client-Identifier': 'portalrr',
      'X-Plex-Product': 'Portalrr',
    },
    body: JSON.stringify({
      machineIdentifier: machineId,
      invitedEmail: email,
      librarySectionIds: libraries.length > 0 ? libraries.map(Number).filter(Boolean) : [],
      settings: {},
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!inviteRes.ok) {
    const errText = await inviteRes.text().catch(() => '');
    throw new Error(`Plex invite error: ${inviteRes.status} ${errText}`);
  }
}

async function createJellyfinUser(jellyfinUrl: string, apiKey: string, username: string, email: string, password: string, libraries: string[] = []): Promise<string | null> {
  const response = await fetch(`${jellyfinUrl}/Users/New`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-MediaBrowser-Token': apiKey,
    },
    body: JSON.stringify({
      Name: username,
      Password: password,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Jellyfin API error: ${response.status}`);
  }

  const userData = await response.json();
  const userId = userData.Id || null;

  // Apply library restrictions if specified
  if (libraries.length > 0 && userId) {
    const policyRes = await fetch(`${jellyfinUrl}/Users/${userId}/Policy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MediaBrowser-Token': apiKey,
      },
      body: JSON.stringify({
        EnableAllFolders: false,
        EnabledFolders: libraries,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!policyRes.ok) {
      console.error(`Failed to set library policy for new Jellyfin user ${userId}: ${policyRes.status}`);
    }
  }

  return userId;
}
