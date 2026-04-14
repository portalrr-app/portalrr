import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { updateServerSchema, validateBody } from '@/lib/validation';
import { encrypt } from '@/lib/crypto';
import { auditLog } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const server = await prisma.server.findUnique({
      where: { id },
      include: { _count: { select: { invites: true } } },
    });

    if (!server) {
      return NextResponse.json(
        { message: 'Server not found' },
        { status: 404 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { token, apiKey, adminUsername, adminPassword, ...publicServer } = server;
    return NextResponse.json({ ...publicServer, _count: server._count });
  } catch (error) {
    console.error('Error fetching server:', error);
    return NextResponse.json(
      { message: 'Failed to fetch server' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const { id } = await params;
    const body = await request.json();
    const parsed = validateBody(updateServerSchema, body);
    if (!parsed.success) return parsed.response;

    const { name, type, url, token, apiKey, isActive, adminUsername, adminPassword } = parsed.data;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (url !== undefined) updateData.url = url;
    if (isActive !== undefined) updateData.isActive = isActive;
    // Look up existing server type if not provided in the update
    const existingServer = await prisma.server.findUnique({ where: { id }, select: { type: true } });
    const effectiveType = type || existingServer?.type;

    if (effectiveType === 'plex' && token !== undefined) updateData.token = token ? encrypt(token) : null;
    if (effectiveType === 'jellyfin' && apiKey !== undefined) updateData.apiKey = apiKey ? encrypt(apiKey) : null;
    if (effectiveType === 'jellyfin' && adminUsername !== undefined) updateData.adminUsername = adminUsername;
    if (effectiveType === 'jellyfin' && adminPassword !== undefined) updateData.adminPassword = adminPassword ? encrypt(adminPassword) : null;

    // Clear stale credentials from the old server type
    if (type && existingServer && type !== existingServer.type) {
      if (type === 'plex') {
        updateData.apiKey = null;
        updateData.adminUsername = null;
        updateData.adminPassword = null;
      } else if (type === 'jellyfin') {
        updateData.token = null;
      }
    }

    const server = await prisma.server.update({
      where: { id },
      data: updateData,
    });

    auditLog('server.updated', { admin: auth.admin.username, serverId: id });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { token: _t, apiKey: _a, adminUsername: _u, adminPassword: _p, ...publicServer } = server;
    return NextResponse.json(publicServer);
  } catch (error) {
    console.error('Error updating server:', error);
    return NextResponse.json(
      { message: 'Failed to update server' },
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

    const inviteCount = await prisma.invite.count({
      where: { serverId: id },
    });

    if (inviteCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete server with existing invites. Delete or reassign invites first.' },
        { status: 400 }
      );
    }

    await prisma.server.delete({
      where: { id },
    });

    auditLog('server.deleted', { admin: auth.admin.username, serverId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting server:', error);
    return NextResponse.json(
      { message: 'Failed to delete server' },
      { status: 500 }
    );
  }
}