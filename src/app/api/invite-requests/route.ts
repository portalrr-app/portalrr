import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createInviteRequestSchema, validateBody } from '@/lib/validation';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { dispatchWebhook } from '@/lib/notifications/webhooks';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = validateBody(createInviteRequestSchema, body);
    if (!parsed.success) return parsed.response;

    const { email, username, message } = parsed.data;

    // Check if invite requests are enabled
    const settings = await prisma.settings.findFirst({
      select: { inviteRequestsEnabled: true },
    });

    if (!settings?.inviteRequestsEnabled) {
      return NextResponse.json(
        { message: 'Invite requests are not currently enabled' },
        { status: 403 }
      );
    }

    // Rate limit by IP
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit('invite-request:' + ip, {
      maxAttempts: 3,
      windowMs: 60 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterMs);
    }

    // Check for duplicate pending request with the same email
    const existing = await prisma.inviteRequest.findFirst({
      where: { email, status: 'pending' },
    });

    if (existing) {
      return NextResponse.json(
        { message: 'A pending request with this email already exists' },
        { status: 409 }
      );
    }

    // Create the invite request
    const inviteRequest = await prisma.inviteRequest.create({
      data: {
        email,
        username,
        message: message || null,
        status: 'pending',
      },
    });

    // Dispatch webhook
    dispatchWebhook('invite_request.created', {
      id: inviteRequest.id,
      email: inviteRequest.email,
      username: inviteRequest.username,
      message: inviteRequest.message,
    });

    return NextResponse.json({
      message: 'Your request has been submitted. You will be notified by email when it is reviewed.',
    });
  } catch (error) {
    console.error('Error creating invite request:', error);
    return NextResponse.json(
      { message: 'Failed to submit invite request' },
      { status: 500 }
    );
  }
}
