import { prisma } from '@/lib/prisma';
import { createHmac } from 'crypto';

// All webhook event types
export const WEBHOOK_EVENTS = [
  'user.registered',
  'user.disabled',
  'user.enabled',
  'user.deleted',
  'user.expired',
  'invite.created',
  'invite.used',
  'invite.expired',
  'invite_request.created',
  'invite_request.approved',
  'invite_request.denied',
  'announcement.sent',
  'admin.login',
  'password.reset',
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path: string) => {
    const parts = path.split('.');
    let value: unknown = data;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return '';
      }
    }
    return String(value ?? '');
  });
}

function buildDiscordEmbed(event: WebhookEvent, data: Record<string, unknown>, appName: string) {
  const colorMap: Record<string, number> = {
    'user.registered': 0x2ecc71,   // green
    'user.disabled': 0xe74c3c,     // red
    'user.enabled': 0x2ecc71,      // green
    'user.deleted': 0xe74c3c,      // red
    'user.expired': 0xf39c12,      // orange
    'invite.created': 0x3498db,    // blue
    'invite.used': 0x2ecc71,       // green
    'invite.expired': 0xf39c12,    // orange
    'invite_request.created': 0x9b59b6, // purple
    'invite_request.approved': 0x2ecc71,
    'invite_request.denied': 0xe74c3c,
    'announcement.sent': 0x3498db,
    'admin.login': 0x95a5a6,       // gray
    'password.reset': 0xf39c12,
  };

  const titleMap: Record<string, string> = {
    'user.registered': 'New User Registered',
    'user.disabled': 'User Disabled',
    'user.enabled': 'User Enabled',
    'user.deleted': 'User Deleted',
    'user.expired': 'User Access Expired',
    'invite.created': 'Invite Created',
    'invite.used': 'Invite Redeemed',
    'invite.expired': 'Invite Expired',
    'invite_request.created': 'New Access Request',
    'invite_request.approved': 'Access Request Approved',
    'invite_request.denied': 'Access Request Denied',
    'announcement.sent': 'Announcement Sent',
    'admin.login': 'Admin Login',
    'password.reset': 'Password Reset',
  };

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
  if (data.username) fields.push({ name: 'Username', value: String(data.username), inline: true });
  if (data.email) fields.push({ name: 'Email', value: String(data.email), inline: true });
  if (data.code) fields.push({ name: 'Code', value: String(data.code), inline: true });
  if (data.server) fields.push({ name: 'Server', value: String(data.server), inline: true });
  if (data.reason) fields.push({ name: 'Reason', value: String(data.reason), inline: false });
  if (data.message) fields.push({ name: 'Message', value: String(data.message), inline: false });

  return {
    embeds: [{
      title: titleMap[event] || event,
      color: colorMap[event] || 0x95a5a6,
      fields,
      footer: { text: appName },
      timestamp: new Date().toISOString(),
    }],
  };
}

export async function dispatchWebhook(event: WebhookEvent, data: Record<string, unknown>) {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: { enabled: true },
    });

    const settings = await prisma.settings.findFirst({ select: { appName: true } });
    const appName = settings?.appName || 'Portalrr';

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    const promises = webhooks
      .filter((wh) => {
        const events: string[] = JSON.parse(wh.events || '[]');
        return events.includes(event) || events.includes('*');
      })
      .map(async (wh) => {
        try {
          let body: string;
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };

          if (wh.type === 'discord') {
            body = JSON.stringify(buildDiscordEmbed(event, data, appName));
          } else if (wh.template) {
            body = renderTemplate(wh.template, { ...data, event, timestamp: payload.timestamp });
          } else {
            body = JSON.stringify(payload);
          }

          if (wh.secret && wh.type === 'generic') {
            const signature = createHmac('sha256', wh.secret).update(body).digest('hex');
            headers['X-Webhook-Signature'] = `sha256=${signature}`;
          }

          await fetch(wh.url, {
            method: 'POST',
            headers,
            body,
            signal: AbortSignal.timeout(10000),
          });
        } catch (err) {
          console.error(`Webhook delivery failed for ${wh.name}:`, err);
        }
      });

    await Promise.allSettled(promises);
  } catch (err) {
    console.error('Failed to dispatch webhooks:', err);
  }
}
