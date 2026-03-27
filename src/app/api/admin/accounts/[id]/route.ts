import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { updateAdminSchema, validateBody } from '@/lib/validation';
import { auditLog } from '@/lib/audit';
import bcrypt from 'bcryptjs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    if (auth.admin.source !== 'local') {
      return NextResponse.json({ message: 'Only the Portalrr admin can edit admin accounts' }, { status: 403 });
    }

    const existing = await prisma.admin.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Admin not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = validateBody(updateAdminSchema, body);
    if (!parsed.success) return parsed.response;

    const data: Record<string, unknown> = {};

    if (parsed.data.username !== undefined) {
      const taken = await prisma.admin.findFirst({
        where: { username: parsed.data.username, id: { not: id } },
      });
      if (taken) {
        return NextResponse.json({ message: 'Username already taken' }, { status: 409 });
      }
      data.username = parsed.data.username;
    }

    if (parsed.data.password !== undefined) {
      data.passwordHash = await bcrypt.hash(parsed.data.password, 12);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ message: 'No changes provided' }, { status: 400 });
    }

    const updated = await prisma.admin.update({
      where: { id },
      data,
      select: { id: true, username: true, source: true, totpEnabled: true, createdAt: true },
    });

    await auditLog('admin.updated', {
      actor: auth.admin.username,
      target: updated.username,
      changes: Object.keys(data).filter(k => k !== 'passwordHash').concat(parsed.data.password ? ['password'] : []),
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update admin:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    if (auth.admin.source !== 'local') {
      return NextResponse.json({ message: 'Only the Portalrr admin can delete admin accounts' }, { status: 403 });
    }

    if (auth.admin.id === id) {
      return NextResponse.json({ message: 'Cannot delete your own account' }, { status: 400 });
    }

    const adminCount = await prisma.admin.count();
    if (adminCount <= 1) {
      return NextResponse.json({ message: 'Cannot delete the last admin account' }, { status: 400 });
    }

    const existing = await prisma.admin.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: 'Admin not found' }, { status: 404 });
    }

    // Delete sessions first, then admin
    await prisma.adminSession.deleteMany({ where: { adminId: id } });
    await prisma.admin.delete({ where: { id } });

    await auditLog('admin.deleted', {
      actor: auth.admin.username,
      target: existing.username,
    });

    return NextResponse.json({ message: 'Admin deleted' });
  } catch (error) {
    console.error('Failed to delete admin:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
