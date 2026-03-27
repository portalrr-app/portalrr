import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { updateWebhookSchema, validateBody } from '@/lib/validation';
import { encrypt, decrypt } from '@/lib/crypto';
// WEBHOOK_EVENTS available from @/lib/notifications/webhooks if needed for validation

// PATCH /api/admin/webhooks/[id] — update a webhook
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const existing = await prisma.webhook.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Webhook not found' }, { status: 404 });
    }

    const body = await request.json();
    const validation = validateBody(updateWebhookSchema, body);
    if (!validation.success) return validation.response;

    const { name, url, type, events, enabled, secret, template } = validation.data;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (url !== undefined) data.url = url;
    if (type !== undefined) data.type = type;
    if (events !== undefined) data.events = JSON.stringify(events);
    if (enabled !== undefined) data.enabled = enabled;
    if (template !== undefined) data.template = template;

    // secret: null clears it, string encrypts it, undefined leaves it unchanged
    if (secret !== undefined) {
      data.secret = secret ? encrypt(secret) : null;
    }

    const webhook = await prisma.webhook.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      type: webhook.type,
      events: JSON.parse(webhook.events || '[]'),
      enabled: webhook.enabled,
      hasSecret: Boolean(webhook.secret),
      template: webhook.template,
      createdAt: webhook.createdAt,
    });
  } catch (error) {
    console.error('Failed to update webhook:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/webhooks/[id] — delete a webhook
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const existing = await prisma.webhook.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Webhook not found' }, { status: 404 });
    }

    await prisma.webhook.delete({ where: { id } });

    return NextResponse.json({ message: 'Webhook deleted' });
  } catch (error) {
    console.error('Failed to delete webhook:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/webhooks/[id] — test a webhook (send test event)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const webhook = await prisma.webhook.findUnique({ where: { id } });
    if (!webhook) {
      return NextResponse.json({ message: 'Webhook not found' }, { status: 404 });
    }

    const settings = await prisma.settings.findFirst({ select: { appName: true } });
    const appName = settings?.appName || 'Portalrr';

    const testPayload = {
      event: 'user.registered' as const,
      timestamp: new Date().toISOString(),
      data: {
        username: 'test_user',
        email: 'test@example.com',
        server: 'Test Server',
      },
    };

    // Build request body based on webhook type
    let body: string;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (webhook.type === 'discord') {
      body = JSON.stringify({
        embeds: [
          {
            title: 'Test Webhook',
            description: `This is a test event from ${appName}.`,
            color: 0x3498db,
            fields: [
              { name: 'Username', value: 'test_user', inline: true },
              { name: 'Email', value: 'test@example.com', inline: true },
              { name: 'Server', value: 'Test Server', inline: true },
            ],
            footer: { text: appName },
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } else if (webhook.template) {
      body = webhook.template
        .replace(/\{\{event\}\}/g, testPayload.event)
        .replace(/\{\{timestamp\}\}/g, testPayload.timestamp)
        .replace(/\{\{username\}\}/g, 'test_user')
        .replace(/\{\{email\}\}/g, 'test@example.com')
        .replace(/\{\{server\}\}/g, 'Test Server');
    } else {
      body = JSON.stringify(testPayload);
    }

    const decryptedSecret = webhook.secret ? decrypt(webhook.secret) : null;
    if (decryptedSecret && webhook.type === 'generic') {
      const { createHmac } = await import('crypto');
      const signature = createHmac('sha256', decryptedSecret).update(body).digest('hex');
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10000),
    });

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
    });
  } catch (error) {
    console.error('Webhook test failed:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to send test webhook';
    return NextResponse.json({ success: false, message }, { status: 502 });
  }
}
