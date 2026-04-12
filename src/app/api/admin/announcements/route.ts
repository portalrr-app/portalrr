import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { createAnnouncementSchema, validateBody } from '@/lib/validation';
import { sendTemplatedEmail } from '@/lib/notifications/email-templates';
import { dispatchWebhook } from '@/lib/notifications/webhooks';
import { auditLog } from '@/lib/audit';
import { dispatchTelegramNotification } from '@/lib/notifications/telegram';
import { dispatchDiscordNotification } from '@/lib/notifications/discord';
import { logOnError } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ announcements });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return NextResponse.json(
      { message: 'Failed to fetch announcements' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const validation = validateBody(createAnnouncementSchema, body);
    if (!validation.success) return validation.response;

    const { title, body: announcementBody, sentTo, sendVia } = validation.data;

    // Resolve target users
    const targetUsers = await resolveTargetUsers(sentTo);

    let sentCount = 0;

    // Send via email
    if (sendVia.includes('email')) {
      const emailPromises = targetUsers
        .filter((u) => u.email)
        .map(async (user) => {
          const sent = await sendTemplatedEmail(user.email!, 'announcement', {
            title,
            body: announcementBody,
          });
          if (sent) sentCount++;
        });

      await Promise.allSettled(emailPromises);
    }

    // Send via webhook
    if (sendVia.includes('webhook')) {
      await dispatchWebhook('announcement.sent', {
        title,
        body: announcementBody,
        sentTo,
        recipientCount: targetUsers.length,
      });
    }

    // Send via Telegram
    if (sendVia.includes('telegram')) {
      dispatchTelegramNotification('announcement.sent', {
        title,
        body: announcementBody,
        recipientCount: targetUsers.length,
      }).catch(logOnError('announcements:telegram'));
    }

    // Send via Discord
    if (sendVia.includes('discord')) {
      dispatchDiscordNotification('announcement.sent', {
        title,
        body: announcementBody,
        recipientCount: targetUsers.length,
      }).catch(logOnError('announcements:discord'));
    }

    // Store the announcement record
    const announcement = await prisma.announcement.create({
      data: {
        title,
        body: announcementBody,
        sentBy: auth.admin.username,
        sentTo,
        sentVia: JSON.stringify(sendVia),
        sentCount,
      },
    });

    auditLog('announcement.sent', {
      admin: auth.admin.username,
      title,
      sentTo,
      sendVia,
      sentCount,
      recipientCount: targetUsers.length,
    });

    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error) {
    console.error('Error creating announcement:', error);
    return NextResponse.json(
      { message: 'Failed to create announcement' },
      { status: 500 }
    );
  }
}

/**
 * Resolve target users based on the sentTo value.
 * - "all" returns all users
 * - Otherwise, treat as a JSON array of user IDs or label names
 */
async function resolveTargetUsers(
  sentTo: string
): Promise<Array<{ id: string; email: string | null; username: string; labels: string }>> {
  if (sentTo === 'all') {
    return prisma.user.findMany({
      select: { id: true, email: true, username: true, labels: true },
    });
  }

  // Parse as JSON array of user IDs or label names
  let targets: string[];
  try {
    targets = JSON.parse(sentTo);
  } catch {
    return [];
  }

  if (!Array.isArray(targets) || targets.length === 0) return [];

  // First, try matching by user IDs
  const byId = await prisma.user.findMany({
    where: { id: { in: targets } },
    select: { id: true, email: true, username: true, labels: true },
  });

  // For any targets not matched by ID, treat them as label names
  const matchedIds = new Set(byId.map((u) => u.id));
  const unmatchedTargets = targets.filter((t) => !matchedIds.has(t));

  if (unmatchedTargets.length === 0) return byId;

  // Find users whose labels JSON array contains any of the unmatched targets
  const allUsers = await prisma.user.findMany({
    select: { id: true, email: true, username: true, labels: true },
  });

  const byLabel = allUsers.filter((user) => {
    if (matchedIds.has(user.id)) return false;
    try {
      const userLabels: string[] = JSON.parse(user.labels || '[]');
      return userLabels.some((label) => unmatchedTargets.includes(label));
    } catch {
      return false;
    }
  });

  return [...byId, ...byLabel];
}
