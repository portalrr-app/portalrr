import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { createAdminSchema, validateBody } from '@/lib/validation';
import { auditLog } from '@/lib/audit';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        source: true,
        totpEnabled: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      admins,
      currentAdminId: auth.admin.id,
      isLocalAdmin: auth.admin.source === 'local',
    });
  } catch (error) {
    console.error('Failed to list admins:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    if (auth.admin.source !== 'local') {
      return NextResponse.json({ message: 'Only the Portalrr admin can create admin accounts' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = validateBody(createAdminSchema, body);
    if (!parsed.success) return parsed.response;

    const { username, password } = parsed.data;

    const existing = await prisma.admin.findFirst({
      where: { username: { equals: username } },
    });
    if (existing) {
      return NextResponse.json({ message: 'Username already taken' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await prisma.admin.create({
      data: { username, passwordHash },
      select: { id: true, username: true, source: true, totpEnabled: true, createdAt: true },
    });

    await auditLog('admin.created', {
      actor: auth.admin.username,
      target: username,
    });

    return NextResponse.json(admin, { status: 201 });
  } catch (error) {
    console.error('Failed to create admin:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
