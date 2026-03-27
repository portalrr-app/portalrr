import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';

export async function GET(request: NextRequest) {
  const auth = await authenticateAdmin(request);
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
  const event = searchParams.get('event') || undefined;
  const actor = searchParams.get('actor') || undefined;
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;

  const where: Record<string, unknown> = {};

  if (event) {
    where.event = event;
  }

  if (actor) {
    where.actor = { contains: actor };
  }

  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) createdAt.gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) createdAt.lte = toDate;
    }
    if (Object.keys(createdAt).length > 0) {
      where.createdAt = createdAt;
    }
  }

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    entries,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateAdmin(request);
  if (isAuthError(auth)) return auth;

  if (auth.admin.source !== 'local') {
    return NextResponse.json({ message: 'Only the Portalrr admin can delete audit logs' }, { status: 403 });
  }

  let body: { olderThanDays?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const { olderThanDays } = body;

  if (typeof olderThanDays !== 'number' || !Number.isFinite(olderThanDays) || olderThanDays < 30) {
    return NextResponse.json(
      { message: 'olderThanDays must be a number >= 30' },
      { status: 400 }
    );
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const result = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return NextResponse.json({ deleted: result.count });
}
