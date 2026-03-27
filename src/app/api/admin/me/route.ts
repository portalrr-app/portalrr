import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { auditLog } from '@/lib/audit';
import bcrypt from 'bcryptjs';

/**
 * GET — Return current admin's profile info
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const admin = await prisma.admin.findUnique({
      where: { id: auth.admin.id },
      select: {
        id: true,
        username: true,
        source: true,
        serverId: true,
        totpEnabled: true,
        createdAt: true,
      },
    });

    if (!admin) {
      return NextResponse.json({ message: 'Admin not found' }, { status: 404 });
    }

    return NextResponse.json(admin);
  } catch (error) {
    console.error('Error fetching admin profile:', error);
    return NextResponse.json({ message: 'Internal error' }, { status: 500 });
  }
}

/**
 * PATCH — Update current admin's password
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ message: 'Current password and new password are required' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ message: 'New password must be at least 8 characters' }, { status: 400 });
    }

    const admin = await prisma.admin.findUnique({ where: { id: auth.admin.id } });
    if (!admin) {
      return NextResponse.json({ message: 'Admin not found' }, { status: 404 });
    }

    const validPassword = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!validPassword) {
      return NextResponse.json({ message: 'Current password is incorrect' }, { status: 403 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.admin.update({
      where: { id: auth.admin.id },
      data: { passwordHash },
    });

    auditLog('admin.password_changed', {
      admin: auth.admin.username,
    });

    return NextResponse.json({ success: true, message: 'Password updated' });
  } catch (error) {
    console.error('Error updating password:', error);
    return NextResponse.json({ message: 'Internal error' }, { status: 500 });
  }
}
