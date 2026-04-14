import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { createServerSchema, validateBody } from '@/lib/validation';
import { encrypt, decrypt } from '@/lib/crypto';
import { auditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const servers = await prisma.server.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        url: true,
        isActive: true,
        createdAt: true,
        apiKey: true,
        token: true,
        adminUsername: true,
        adminPassword: true,
      },
    });

    // Return redacted values — show last 4 chars of decrypted value for recognition
    const redact = (val: string | null) => {
      if (!val) return '';
      const plain = decrypt(val);
      return plain ? '••••••••' + plain.slice(-4) : '';
    };
    const publicServers = servers.map(({ apiKey, token, adminUsername, adminPassword, ...rest }) => ({
      ...rest,
      hasApiKey: !!apiKey,
      hasToken: !!token,
      hasAdminCredentials: !!adminUsername && !!adminPassword,
      apiKeyRedacted: redact(apiKey),
      tokenRedacted: redact(token),
      adminUsernameRedacted: adminUsername || '',
      adminPasswordRedacted: redact(adminPassword),
    }));

    return NextResponse.json(publicServers);
  } catch (error) {
    console.error('Error fetching servers:', error);
    return NextResponse.json(
      { message: 'Failed to fetch servers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const body = await request.json();
    const parsed = validateBody(createServerSchema, body);
    if (!parsed.success) return parsed.response;

    const { name, type, url, token, apiKey, adminUsername, adminPassword } = parsed.data;

    const server = await prisma.server.create({
      data: {
        name,
        type,
        url,
        token: type === 'plex' && token ? encrypt(token) : null,
        apiKey: type === 'jellyfin' && apiKey ? encrypt(apiKey) : null,
        adminUsername: type === 'jellyfin' ? (adminUsername || null) : null,
        adminPassword: type === 'jellyfin' && adminPassword ? encrypt(adminPassword) : null,
        isActive: true,
      },
    });

    auditLog('server.created', { admin: auth.admin.username, serverName: name, serverType: type });

    // Never return secrets in the response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { token: _t, apiKey: _a, adminUsername: _u, adminPassword: _p, ...publicServer } = server;
    return NextResponse.json(publicServer);
  } catch (error) {
    console.error('Error creating server:', error);
    return NextResponse.json(
      { message: 'Failed to create server' },
      { status: 500 }
    );
  }
}
