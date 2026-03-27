import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { createWebhookSchema, validateBody } from '@/lib/validation';
import { encrypt } from '@/lib/crypto';


// GET /api/admin/webhooks — list all webhooks
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const webhooks = await prisma.webhook.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      webhooks.map((wh) => ({
        id: wh.id,
        name: wh.name,
        url: wh.url,
        type: wh.type,
        events: JSON.parse(wh.events || '[]'),
        enabled: wh.enabled,
        hasSecret: Boolean(wh.secret),
        template: wh.template,
        createdAt: wh.createdAt,
      }))
    );
  } catch (error) {
    console.error('Failed to list webhooks:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/webhooks — create a webhook
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const validation = validateBody(createWebhookSchema, body);
    if (!validation.success) return validation.response;

    const { name, url, type, events, enabled, secret, template } = validation.data;

    const webhook = await prisma.webhook.create({
      data: {
        name,
        url,
        type,
        events: JSON.stringify(events),
        enabled,
        secret: secret ? encrypt(secret) : null,
        template: template ?? null,
      },
    });

    return NextResponse.json(
      {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        type: webhook.type,
        events: JSON.parse(webhook.events || '[]'),
        enabled: webhook.enabled,
        hasSecret: Boolean(webhook.secret),
        template: webhook.template,
        createdAt: webhook.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create webhook:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
