import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const ip = getClientIp(_request);
    const rl = checkRateLimit(`invite-verify:${ip}`, RATE_LIMITS.inviteVerify);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    const { code } = await params;

    const invite = await prisma.invite.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        server: true,
      },
    });

    if (!invite) {
      return NextResponse.json(
        { valid: false, message: 'Invalid invite code' },
        { status: 404 }
      );
    }

    if (invite.status !== 'active') {
      return NextResponse.json(
        { valid: false, message: 'This invite has expired or been cancelled' },
        { status: 400 }
      );
    }

    if (invite.expiresAt && new Date() > invite.expiresAt) {
      await prisma.invite.update({
        where: { id: invite.id },
        data: { status: 'expired' },
      });
      return NextResponse.json(
        { valid: false, message: 'This invite has expired' },
        { status: 400 }
      );
    }

    if (invite.maxUses > 0 && invite.uses >= invite.maxUses) {
      return NextResponse.json(
        { valid: false, message: 'This invite has already been used' },
        { status: 400 }
      );
    }

    let libraries: string[] = [];
    try {
      libraries = JSON.parse(invite.libraries || '[]');
    } catch {
      libraries = [];
    }

    const settings = await prisma.settings.findFirst({
      select: {
        preRegisterTitle: true,
        preRegisterSubtitle: true,
        preRegisterChecklist: true,
        requireInviteAcceptance: true,
        captchaEnabled: true,
      },
    });

    let preRegisterChecklist: string[] = [];
    try {
      preRegisterChecklist = settings?.preRegisterChecklist
        ? JSON.parse(settings.preRegisterChecklist)
        : [];
    } catch {
      preRegisterChecklist = [];
    }

    return NextResponse.json({
      valid: true,
      serverId: invite.serverId,
      serverType: invite.server?.type || 'plex',
      serverName: invite.server?.name || 'Media Server',
      libraries,
      accessUntil: invite.accessUntil?.toISOString() || null,
      accessDurationDays: invite.accessDurationDays,
      preRegisterTitle: settings?.preRegisterTitle || 'Before You Start',
      preRegisterSubtitle: settings?.preRegisterSubtitle || '',
      preRegisterChecklist,
      requireInviteAcceptance: settings?.requireInviteAcceptance || false,
      captchaEnabled: settings?.captchaEnabled || false,
      passphraseRequired: Boolean(invite.passphrase),
    });
  } catch (error) {
    console.error('Error verifying invite:', error);
    return NextResponse.json(
      { valid: false, message: 'Something went wrong' },
      { status: 500 }
    );
  }
}
