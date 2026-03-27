import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { testServerSchema, validateBody } from '@/lib/validation';
import { decryptServerSecrets } from '@/lib/crypto';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const parsed = validateBody(testServerSchema, body);
    if (!parsed.success) return parsed.response;

    const { serverId } = parsed.data;

    const server = await prisma.server.findUnique({
      where: { id: serverId },
    }).then(s => s ? decryptServerSecrets(s) : null);

    if (!server) {
      return NextResponse.json(
        { message: 'Server not found' },
        { status: 404 }
      );
    }

    if (server.type === 'plex') {
      if (!server.token) {
        return NextResponse.json(
          { message: 'Plex token not configured' },
          { status: 400 }
        );
      }

      const response = await fetch(`${server.url}/identity`, {
        method: 'GET',
        headers: {
          'X-Plex-Token': server.token,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        return NextResponse.json(
          { message: 'Failed to connect to Plex server' },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    }

    if (server.type === 'jellyfin') {
      if (!server.apiKey) {
        return NextResponse.json(
          { message: 'Jellyfin API key not configured' },
          { status: 400 }
        );
      }

      const response = await fetch(`${server.url}/System/Info`, {
        method: 'GET',
        headers: {
          'X-MediaBrowser-Token': server.apiKey,
        },
      });

      if (!response.ok) {
        return NextResponse.json(
          { message: 'Failed to connect to Jellyfin server' },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { message: 'Invalid server type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error testing server connection:', error);
    return NextResponse.json(
      { message: 'Failed to test server connection' },
      { status: 500 }
    );
  }
}
