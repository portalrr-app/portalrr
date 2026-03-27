import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateUser, isUserAuthError } from '@/lib/auth/user';
import { validateBody, createInviteSchema } from '@/lib/validation';
import { generateInviteCode } from '@/lib/crypto';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  const auth = await authenticateUser(request);
  if (isUserAuthError(auth)) return auth;

  const invites = await prisma.invite.findMany({
    where: {
      createdBy: `user:${auth.user.id}`,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      server: {
        select: { id: true, name: true, type: true },
      },
    },
  });

  return NextResponse.json(invites.map((invite) => ({
    id: invite.id,
    code: invite.code,
    uses: invite.uses,
    maxUses: invite.maxUses,
    status: invite.status,
    expiresAt: invite.expiresAt?.toISOString() || null,
    createdAt: invite.createdAt.toISOString(),
    server: invite.server,
  })));
}

export async function POST(request: NextRequest) {
  const auth = await authenticateUser(request);
  if (isUserAuthError(auth)) return auth;

  const settings = await prisma.settings.findFirst();
  if (!settings?.referralInvitesEnabled) {
    return NextResponse.json({ message: 'Referral invites are disabled' }, { status: 400 });
  }

  // Enforce a limit on active referral invites per user (hardcoded to 5)
  const MAX_ACTIVE_REFERRAL_INVITES = 5;
  const activeReferralCount = await prisma.invite.count({
    where: {
      createdBy: `user:${auth.user.id}`,
      status: 'active',
    },
  });

  if (activeReferralCount >= MAX_ACTIVE_REFERRAL_INVITES) {
    return NextResponse.json(
      { message: `You can have at most ${MAX_ACTIVE_REFERRAL_INVITES} active referral invites. Please wait for existing invites to expire or be used.` },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    include: {
      invite: { include: { server: true } },
      server: true,
    },
  });

  if (!user) {
    return NextResponse.json({ message: 'User not found' }, { status: 404 });
  }

  const server = user.server || user.invite?.server;
  if (!server) {
    return NextResponse.json({ message: 'No linked server found for this user' }, { status: 400 });
  }

  const parsed = validateBody(createInviteSchema, {
    serverId: server.id,
    createdBy: `user:${user.id}`,
    maxUses: settings.referralMaxUses,
    expiresInDays: settings.referralExpiresInDays,
    accessDurationDays: settings.referralAccessDurationDays,
    autoRemove: settings.referralAutoRemove,
    libraries: user.allLibraries ? [] : JSON.parse(user.libraries || '[]'),
  });
  if (!parsed.success) return parsed.response;

  const {
    maxUses,
    expiresInDays,
    accessDurationDays,
    autoRemove,
    libraries,
  } = parsed.data;

  let expiresAt = null;
  if (expiresInDays > 0) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  }

  const maxRetries = 5;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const code = generateInviteCode();
    try {
      const invite = await prisma.invite.create({
        data: {
          code,
          serverId: server.id,
          maxUses,
          expiresAt,
          accessDurationDays,
          autoRemove,
          libraries: JSON.stringify(libraries),
          status: 'active',
          createdBy: `user:${user.id}`,
        },
      });

      return NextResponse.json({
        id: invite.id,
        code: invite.code,
        expiresAt: invite.expiresAt?.toISOString() || null,
        maxUses: invite.maxUses,
        uses: invite.uses,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        continue;
      }
      throw error;
    }
  }

  return NextResponse.json({ message: 'Failed to create referral invite' }, { status: 500 });
}
