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

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};

    if (body.maxUses !== undefined) {
      const n = Number(body.maxUses);
      if (isNaN(n) || n < 0 || n > 10000) return NextResponse.json({ message: 'maxUses must be 0-10000' }, { status: 400 });
      data.maxUses = n;
    }
    if (body.accessDurationDays !== undefined) {
      const n = Number(body.accessDurationDays);
      if (isNaN(n) || n < 0 || n > 36500) return NextResponse.json({ message: 'accessDurationDays must be 0-36500' }, { status: 400 });
      data.accessDurationDays = n;
    }
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
      include: { server: { select: { id: true, name: true, type: true, url: true } } },
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
    if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ message: 'Invite not found' }, { status: 404 });
    }
    console.error('Error deleting invite:', error);
    return NextResponse.json(
      { message: 'Failed to delete invite' },
      { status: 500 }
    );
  }
}
