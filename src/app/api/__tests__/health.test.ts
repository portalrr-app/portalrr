// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonBody } from './helpers';

const { mockPrisma } = vi.hoisted(() => {
  const mockModel = () => ({
    findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(),
    create: vi.fn(), update: vi.fn(), updateMany: vi.fn(),
    delete: vi.fn(), deleteMany: vi.fn(), count: vi.fn(),
  });
  return {
    mockPrisma: {
      admin: mockModel(), adminSession: mockModel(), user: mockModel(),
      userSession: mockModel(), invite: mockModel(), server: mockModel(),
      settings: mockModel(), $queryRaw: vi.fn(), $transaction: vi.fn(),
    },
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/crypto', () => ({
  decryptServerSecrets: <T>(s: T) => s,
}));

import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok when database and no servers', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);
    mockPrisma.server.findMany.mockResolvedValue([]);

    const res = await GET();
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.database).toBe('ok');
    expect(body.serverCount).toBe(0);
    expect(body.servers).toEqual([]);
  });

  it('returns error when database is down', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('DB down'));
    mockPrisma.server.findMany.mockResolvedValue([]);

    const res = await GET();
    const body = await jsonBody(res);

    expect(res.status).toBe(503);
    expect(body.status).toBe('error');
    expect(body.database).toBe('error');
  });

  it('returns degraded when a server is unhealthy', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);
    mockPrisma.server.findMany.mockResolvedValue([
      { id: '1', name: 'Jellyfin', type: 'jellyfin', url: 'http://jf:8096', apiKey: 'key', token: null },
    ]);

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const res = await GET();
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.status).toBe('degraded');
    expect(body.serverCount).toBe(1);
    expect(body.serversHealthy).toBe(0);
    expect(body.servers[0].healthy).toBe(false);

    global.fetch = originalFetch;
  });

  it('returns ok when all servers are healthy', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);
    mockPrisma.server.findMany.mockResolvedValue([
      { id: '1', name: 'Jellyfin', type: 'jellyfin', url: 'http://jf:8096', apiKey: 'key', token: null },
    ]);

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    const res = await GET();
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.serversHealthy).toBe(1);
    expect(body.servers[0].healthy).toBe(true);

    global.fetch = originalFetch;
  });

  it('includes timestamp in response', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);
    mockPrisma.server.findMany.mockResolvedValue([]);

    const res = await GET();
    const body = await jsonBody(res);

    expect(body.timestamp).toBeDefined();
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });
});
