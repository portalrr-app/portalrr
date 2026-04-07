import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decryptServerSecrets } from '@/lib/crypto';

export async function GET() {
  const health: {
    status: 'ok' | 'degraded' | 'error';
    timestamp: string;
    database: 'ok' | 'error';
    serverCount: number;
    serversHealthy: number;
  } = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'ok',
    serverCount: 0,
    serversHealthy: 0,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    health.status = 'error';
    health.database = 'error';
  }

  try {
    const servers = (await prisma.server.findMany({
      where: { isActive: true },
      select: { id: true, name: true, type: true, url: true, apiKey: true, token: true },
    })).map(decryptServerSecrets);

    health.serverCount = servers.length;

    const serverHealthPromises = servers.map(async (server) => {
      try {
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        let endpoint: string;

        if (server.type === 'jellyfin' && server.apiKey) {
          headers['X-MediaBrowser-Token'] = server.apiKey;
          endpoint = `${server.url}/System/Info`;
        } else if (server.type === 'plex' && server.token) {
          headers['X-Plex-Token'] = server.token;
          endpoint = `${server.url}/identity`;
        } else {
          return { id: server.id, name: server.name, type: server.type, healthy: false };
        }

        const timeout = new AbortController();
        const timeoutId = setTimeout(() => timeout.abort(), 5000);

        try {
          const res = await fetch(endpoint, {
            headers,
            signal: timeout.signal,
          });

          clearTimeout(timeoutId);

          return { id: server.id, name: server.name, type: server.type, healthy: res.ok };
        } catch {
          return { id: server.id, name: server.name, type: server.type, healthy: false };
        }
      } catch {
        return { id: server.id, name: server.name, type: server.type, healthy: false };
      }
    });

    const serverResults = await Promise.all(serverHealthPromises);
    health.serversHealthy = serverResults.filter(s => s.healthy).length;

    const hasServerIssues = health.serversHealthy < health.serverCount;
    if (health.status !== 'error' && hasServerIssues) {
      health.status = 'degraded';
    }
  } catch (error) {
    console.error('Error checking server health:', error);
  }

  const statusCode = health.status === 'error' ? 503 : 200;
  return NextResponse.json(health, { status: statusCode });
}
