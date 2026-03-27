import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { reviewInviteRequestSchema, validateBody } from '@/lib/validation';
import { generateInviteCode } from '@/lib/crypto';
import { dispatchWebhook } from '@/lib/notifications/webhooks';
import { sendEmail } from '@/lib/notifications/email';
import { auditLog } from '@/lib/audit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const { id } = await params;

    const body = await request.json();
    const parsed = validateBody(reviewInviteRequestSchema, body);
    if (!parsed.success) return parsed.response;

    const { action, reviewNote, maxUses, expiresInDays, accessDurationDays } = parsed.data;

    // Find the invite request
    const inviteRequest = await prisma.inviteRequest.findUnique({
      where: { id },
    });

    if (!inviteRequest) {
      return NextResponse.json(
        { message: 'Invite request not found' },
        { status: 404 }
      );
    }

    if (inviteRequest.status !== 'pending') {
      return NextResponse.json(
        { message: 'This request has already been reviewed' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      // Get the configured server for invite requests
      const settings = await prisma.settings.findFirst({
        select: { inviteRequestServerId: true, appName: true },
      });

      if (!settings?.inviteRequestServerId) {
        return NextResponse.json(
          { message: 'No server configured for invite requests. Set inviteRequestServerId in settings.' },
          { status: 400 }
        );
      }

      const server = await prisma.server.findUnique({
        where: { id: settings.inviteRequestServerId },
      });

      if (!server) {
        return NextResponse.json(
          { message: 'Configured invite request server not found' },
          { status: 400 }
        );
      }

      // Generate invite
      const code = generateInviteCode();
      let expiresAt = null;
      const days = expiresInDays ?? 7;
      if (days > 0) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
      }

      const invite = await prisma.invite.create({
        data: {
          code,
          serverId: server.id,
          maxUses: maxUses ?? 1,
          expiresAt,
          accessDurationDays: accessDurationDays ?? 0,
          autoRemove: false,
          libraries: '[]',
          status: 'active',
          createdBy: 'invite-request',
        },
      });

      // Update the request
      await prisma.inviteRequest.update({
        where: { id },
        data: {
          status: 'approved',
          reviewedBy: auth.admin.username,
          reviewedAt: new Date(),
          reviewNote: reviewNote || null,
          inviteId: invite.id,
        },
      });

      // Send invite code to user via email
      const appName = settings.appName || 'Portalrr';
      await sendEmail(
        inviteRequest.email,
        `Your access request has been approved - ${appName}`,
        `Hi ${inviteRequest.username},\n\nYour request to access ${appName} has been approved!\n\nYour invite code is: ${code}\n\nPlease use this code to complete your registration.\n\nThis code ${days > 0 ? `expires in ${days} days` : 'does not expire'}.\n\nThank you!`
      );

      auditLog('invite_request.approved', {
        requestId: id,
        email: inviteRequest.email,
        username: inviteRequest.username,
        inviteCode: code,
        admin: auth.admin.username,
      });

      dispatchWebhook('invite_request.approved', {
        id: inviteRequest.id,
        email: inviteRequest.email,
        username: inviteRequest.username,
        inviteCode: code,
      });

      return NextResponse.json({
        message: 'Request approved and invite sent',
        inviteCode: code,
        inviteId: invite.id,
      });
    } else {
      // Deny
      await prisma.inviteRequest.update({
        where: { id },
        data: {
          status: 'denied',
          reviewedBy: auth.admin.username,
          reviewedAt: new Date(),
          reviewNote: reviewNote || null,
        },
      });

      auditLog('invite_request.denied', {
        requestId: id,
        email: inviteRequest.email,
        username: inviteRequest.username,
        admin: auth.admin.username,
        reviewNote,
      });

      dispatchWebhook('invite_request.denied', {
        id: inviteRequest.id,
        email: inviteRequest.email,
        username: inviteRequest.username,
        reviewNote,
      });

      return NextResponse.json({ message: 'Request denied' });
    }
  } catch (error) {
    console.error('Error reviewing invite request:', error);
    return NextResponse.json(
      { message: 'Failed to review invite request' },
      { status: 500 }
    );
  }
}
