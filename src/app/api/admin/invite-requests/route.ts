import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const whereClause: Record<string, unknown> = {};
    if (status && ['pending', 'approved', 'denied'].includes(status)) {
      whereClause.status = status;
    }

    const requests = await prisma.inviteRequest.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    const formatted = requests.map((r) => ({
      id: r.id,
      email: r.email,
      username: r.username,
      message: r.message,
      status: r.status,
      reviewedBy: r.reviewedBy,
      reviewedAt: r.reviewedAt?.toISOString() || null,
      reviewNote: r.reviewNote,
      inviteId: r.inviteId,
      createdAt: r.createdAt.toISOString(),
    }));

    return NextResponse.json({ data: formatted });
  } catch (error) {
    console.error('Error fetching invite requests:', error);
    return NextResponse.json(
      { message: 'Failed to fetch invite requests' },
      { status: 500 }
    );
  }
}
