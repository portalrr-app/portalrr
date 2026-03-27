import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import bcrypt from 'bcryptjs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const body = await request.json();

    const data: Record<string, unknown> = {};

    if (body.maxUses !== undefined) data.maxUses = Number(body.maxUses);
    if (body.accessDurationDays !== undefined) data.accessDurationDays = Number(body.accessDurationDays);
    if (body.autoRemove !== undefined) data.autoRemove = Boolean(body.autoRemove);
    if (body.notifyOnUse !== undefined) data.notifyOnUse = Boolean(body.notifyOnUse);
    if (body.notifyOnExpiry !== undefined) data.notifyOnExpiry = Boolean(body.notifyOnExpiry);
    if (body.label !== undefined) data.label = body.label || null;
    if (body.libraries !== undefined) data.libraries = JSON.stringify(body.libraries);

    if (body.expiresInDays !== undefined) {
      const days = Number(body.expiresInDays);
      data.expiresAt = days > 0 ? new Date(Date.now() + days * 86400000) : null;
    }

    if (body.passphrase !== undefined) {
      data.passphrase = body.passphrase
        ? await bcrypt.hash(body.passphrase, 10)
        : null;
    }

    if (body.status !== undefined) {
      if (['active', 'cancelled'].includes(body.status)) {
        data.status = body.status;
      }
    }

    const invite = await prisma.invite.update({
      where: { id },
      data,
      include: { server: true },
    });

    return NextResponse.json(invite);
  } catch (error) {
    console.error('Error updating invite:', error);
    return NextResponse.json(
      { message: 'Failed to update invite' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const { id } = await params;

    // Unlink any users that redeemed this invite before deleting
    await prisma.user.updateMany({
      where: { inviteId: id },
      data: { inviteId: null },
    });

    await prisma.invite.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting invite:', error);
    return NextResponse.json(
      { message: 'Failed to delete invite' },
      { status: 500 }
    );
  }
}
