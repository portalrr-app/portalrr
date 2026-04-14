import { prisma } from '@/lib/prisma';
import { sendTemplatedEmail } from '@/lib/notifications/email-templates';
import { decryptServerSecrets } from '@/lib/crypto';
import { dispatchWebhook } from '@/lib/notifications/webhooks';

let lastRun = 0;
const RUN_INTERVAL = 60 * 60 * 1000; // Run at most once per hour

/**
 * Check for expired users with autoRemove enabled and delete them
 * from the local DB and their media server.
 * Call this from any frequently-hit route — it self-throttles.
 */
export async function runAutoRemoveIfDue() {
  const now = Date.now();
  if (now - lastRun < RUN_INTERVAL) return;
  lastRun = now;

  try {
    const settings = await prisma.settings.findFirst();
    await sendExpiryNotifications(settings);
    await processExpiredInvites();

    // Clean up expired/used password reset tokens
    await prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { usedAt: { not: null } },
        ],
      },
    }).catch(() => {});

    const expiredUsers = await prisma.user.findMany({
      where: {
        autoRemove: true,
        accessUntil: { not: null, lt: new Date() },
      },
      include: {
        invite: { include: { server: true } },
        server: true,
      },
    });

    for (const user of expiredUsers) {
      const expiredAt = user.accessUntil!;
      const deleteAfter = new Date(expiredAt);
      deleteAfter.setDate(deleteAfter.getDate() + (settings?.expiryDeleteAfterDays ?? 7));
      const policy = settings?.expiryPolicy || 'delete';

      if (policy === 'disable') {
        // Disable the user but don't delete them
        if (!user.disabled) {
          await prisma.user.update({
            where: { id: user.id },
            data: { disabled: true },
          });
          dispatchWebhook('user.disabled', { username: user.username });
          console.log(`Auto-remove: disabled expired user ${user.username}`);
        }
        continue;
      }

      if (policy === 'disable_then_delete' && new Date() < deleteAfter) {
        // Disable during grace period, delete after
        if (!user.disabled) {
          await prisma.user.update({
            where: { id: user.id },
            data: { disabled: true },
          });
          dispatchWebhook('user.disabled', { username: user.username });
          console.log(`Auto-remove: disabled expired user ${user.username} (grace period until ${deleteAfter.toISOString()})`);
        }
        continue;
      }

      const rawServer = user.server || user.invite?.server;
      const server = rawServer ? decryptServerSecrets(rawServer) : null;

      // Try to remove from media server first
      if (server) {
        try {
          await removeFromServer(user.username, server);
        } catch (err) {
          console.error(`Auto-remove: failed to remove ${user.username} from ${server.name}:`, err);
          // Skip local deletion — keep user in DB so we can retry next time
          continue;
        }
      }

      // Dispatch webhook before deletion
      dispatchWebhook('user.expired', { username: user.username });

      // Delete local user (cascades to sessions)
      await prisma.user.delete({ where: { id: user.id } });
      console.log(`Auto-remove: deleted expired user ${user.username}`);
    }
  } catch (err) {
    console.error('Auto-remove: error during cleanup', err);
  }
}

async function sendExpiryNotifications(
  settings: {
    notifyBeforeExpiryDays: number;
    notifyOnExpiry: boolean;
  } | null
) {
  const windowDays = settings?.notifyBeforeExpiryDays ?? 3;
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + windowDays + 1);

  const users = await prisma.user.findMany({
    where: {
      accessUntil: { not: null, lt: windowEnd },
      email: { not: null },
    },
  });

  const now = new Date();

  for (const user of users) {
    if (!user.accessUntil || !user.email) continue;

    let state: { reminderSent?: boolean; expiredSent?: boolean } = {};
    try {
      state = user.notificationState ? JSON.parse(user.notificationState) : {};
    } catch {
      state = {};
    }

    const diffMs = user.accessUntil.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    let stateChanged = false;

    if (
      settings?.notifyBeforeExpiryDays !== undefined &&
      daysRemaining >= 0 &&
      daysRemaining <= settings.notifyBeforeExpiryDays &&
      !state.reminderSent
    ) {
      const sent = user.email ? await sendTemplatedEmail(user.email, 'account_expiry', {
        username: user.username,
        expiresAt: user.accessUntil.toISOString().split('T')[0],
        expiring: true,
      }).catch(() => false) : false;

      if (sent) {
        state.reminderSent = true;
        stateChanged = true;
      }
    }

    if (
      settings?.notifyOnExpiry &&
      daysRemaining < 0 &&
      !state.expiredSent
    ) {
      const sent = user.email ? await sendTemplatedEmail(user.email, 'account_expiry', {
        username: user.username,
        expiresAt: user.accessUntil.toISOString().split('T')[0],
        expired: true,
      }).catch(() => false) : false;

      if (sent) {
        state.expiredSent = true;
        stateChanged = true;
      }
    }

    if (stateChanged) {
      await prisma.user.update({
        where: { id: user.id },
        data: { notificationState: JSON.stringify(state) },
      });
    }
  }
}

async function processExpiredInvites() {
  const expiredInvites = await prisma.invite.findMany({
    where: {
      status: 'active',
      expiresAt: { not: null, lt: new Date() },
    },
  });

  for (const invite of expiredInvites) {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { status: 'expired' },
    });

    dispatchWebhook('invite.expired', { code: invite.code });
    console.log(`Auto-remove: expired invite ${invite.code}`);
  }
}

async function removeFromServer(
  username: string,
  server: { type: string; url: string; apiKey: string | null; token: string | null }
) {
  if (server.type === 'jellyfin' && server.apiKey) {
    // Find user ID by username
    const res = await fetch(`${server.url}/Users`, {
      headers: { 'X-MediaBrowser-Token': server.apiKey },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return;

    const users = await res.json();
    const match = users.find(
      (u: { Name: string }) => u.Name.toLowerCase() === username.toLowerCase()
    );
    if (!match) return;

    const delRes = await fetch(`${server.url}/Users/${match.Id}`, {
      method: 'DELETE',
      headers: { 'X-MediaBrowser-Token': server.apiKey },
      signal: AbortSignal.timeout(15000),
    });
    if (!delRes.ok) {
      throw new Error(`Jellyfin delete failed: ${delRes.status}`);
    }
  } else if (server.type === 'plex' && server.token) {
    // For Plex, we remove the friend/shared user via v2 API
    const friendsRes = await fetch('https://plex.tv/api/v2/friends', {
      headers: {
        'X-Plex-Token': server.token,
        'Accept': 'application/json',
        'X-Plex-Client-Identifier': 'portalrr',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!friendsRes.ok) return;

    const friends = await friendsRes.json();
    const match = (friends as Array<{ id?: string | number; title?: string; username?: string }>).find(
      (u) => (u.title || u.username || '').toLowerCase() === username.toLowerCase()
    );
    if (!match) return;

    const delRes = await fetch(`https://plex.tv/api/v2/friends/${match.id}`, {
      method: 'DELETE',
      headers: {
        'X-Plex-Token': server.token,
        'X-Plex-Client-Identifier': 'portalrr',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!delRes.ok) {
      throw new Error(`Plex friend remove failed: ${delRes.status}`);
    }
  }
}
