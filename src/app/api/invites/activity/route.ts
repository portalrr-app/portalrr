import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const invites = await prisma.invite.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        redeemedBy: {
          select: { email: true },
        },
      },
    });

    const activity = invites.map((invite) => {
      let type: 'created' | 'used' | 'expired' = 'created';
      
      if (invite.uses > 0) {
        type = 'used';
      } else if (invite.status === 'expired' || (invite.expiresAt && invite.expiresAt < new Date())) {
        type = 'expired';
      }

      return {
        id: invite.id,
        type,
        code: invite.code,
        email: invite.redeemedBy[0]?.email || null,
        createdAt: invite.createdAt.toISOString(),
      };
    });

    return NextResponse.json(activity);
  } catch (error) {
    console.error('Error fetching activity:', error);
    return NextResponse.json(
      { message: 'Failed to fetch activity' },
      { status: 500 }
    );
  }
}
