import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const now = new Date();

    const [total, used, expired] = await Promise.all([
      prisma.invite.count(),
      prisma.invite.count({
        where: {
          uses: { gte: 1 },
        },
      }),
      prisma.invite.count({
        where: {
          OR: [
            { status: 'expired' },
            { expiresAt: { lt: now } },
          ],
        },
      }),
    ]);

    // Active = status is active AND (not expired) AND (unlimited or uses < maxUses)
    // Prisma can't do cross-column comparison, so use raw query
    // SQLite stores dates as millisecond integers, so compare against ms timestamp
    const nowMs = now.getTime();
    const activeResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM Invite
      WHERE status = 'active'
        AND (expiresAt IS NULL OR expiresAt > ${nowMs})
        AND (maxUses = 0 OR uses < maxUses)
    `;
    const active = Number(activeResult[0]?.count ?? 0);

    return NextResponse.json({
      total,
      active: active || 0,
      used,
      expired: expired || 0,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { message: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
