import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    const take = Math.min(parseInt(searchParams.get('take') || '50'), 100);
    const skip = parseInt(searchParams.get('skip') || '0');

    const whereClause: Record<string, unknown> = {};

    if (filter === 'active') {
      whereClause.status = 'active';
    } else if (filter === 'used') {
      whereClause.uses = { gte: 1 };
    } else if (filter === 'expired') {
      whereClause.OR = [
        { status: 'expired' },
        { expiresAt: { lt: new Date() } },
      ];
    }

    const [invites, total] = await Promise.all([
      prisma.invite.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          server: {
            select: {
              id: true,
              name: true,
              type: true,
              url: true,
              isActive: true,
            },
          },
          redeemedBy: {
            select: { email: true },
          },
        },
      }),
      prisma.invite.count({ where: whereClause }),
    ]);

    const formattedInvites = invites.map((invite) => {
      let libraries: string[] = [];
      try {
        libraries = JSON.parse(invite.libraries || '[]');
      } catch {
        libraries = [];
      }
      
      return {
        id: invite.id,
        code: invite.code,
        serverId: invite.serverId,
        server: invite.server ? {
          id: invite.server.id,
          name: invite.server.name,
          type: invite.server.type,
          url: invite.server.url,
          isActive: invite.server.isActive,
        } : null,
        libraries,
        expiresAt: invite.expiresAt?.toISOString() || null,
        accessUntil: invite.accessUntil?.toISOString() || null,
        accessDurationDays: invite.accessDurationDays,
        autoRemove: invite.autoRemove,
        maxUses: invite.maxUses,
        uses: invite.uses,
        status: invite.status,
        createdAt: invite.createdAt.toISOString(),
        label: invite.label,
        passphraseProtected: Boolean(invite.passphrase),
        notifyOnUse: invite.notifyOnUse,
        notifyOnExpiry: invite.notifyOnExpiry,
        createdBy: invite.createdBy,
      };
    });

    return NextResponse.json({
      data: formattedInvites,
      total,
      take,
      skip,
    });
  } catch (error) {
    console.error('Error fetching invites:', error);
    return NextResponse.json(
      { message: 'Failed to fetch invites' },
      { status: 500 }
    );
  }
}
