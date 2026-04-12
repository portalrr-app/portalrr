import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authenticateUser, isUserAuthError } from '@/lib/auth/user';
import { validateBody } from '@/lib/validation';

const updateEmailSchema = z.object({
  email: z.string().email().max(200).trim(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateUser(request);
    if (isUserAuthError(auth)) return auth;

    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      include: {
        invite: {
          include: { server: { select: { id: true, name: true, type: true } } },
        },
        server: { select: { id: true, name: true, type: true } },
        userServers: {
          include: { server: { select: { id: true, name: true, type: true } } },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Prefer direct server link, fall back to invite's server
    const server = user.server || user.invite?.server || null;

    // Build servers list from UserServer memberships
    const servers = user.userServers.map((us) => ({
      id: us.server.id,
      name: us.server.name,
      type: us.server.type,
      disabled: us.disabled || false,
      libraries: JSON.parse(us.libraries || '[]'),
    }));

    return NextResponse.json({
      id: user.id,
      username: user.username,
      email: user.email,
      emailRequired: !user.email,
      createdAt: user.createdAt.toISOString(),
      accessUntil: user.accessUntil?.toISOString() || null,
      server: server
        ? { id: server.id, name: server.name, type: server.type }
        : null,
      servers,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { message: 'Failed to fetch account' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateUser(request);
    if (isUserAuthError(auth)) return auth;

    const body = await request.json();
    const parsed = validateBody(updateEmailSchema, body);
    if (!parsed.success) return parsed.response;

    const { email } = parsed.data;

    // Check if email is already taken by another user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== auth.user.id) {
      return NextResponse.json(
        { message: 'Email already in use' },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: auth.user.id },
      data: { email },
    });

    return NextResponse.json({
      success: true,
      email: user.email,
    });
  } catch (error) {
    console.error('Error updating email:', error);
    return NextResponse.json(
      { message: 'Failed to update email' },
      { status: 500 }
    );
  }
}
