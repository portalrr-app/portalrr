// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequest, jsonBody } from './helpers';

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
  generateSessionToken: () => 'mock-session-token-abc123',
  hashSessionToken: (s: string) => `hash:${s}`,
}));
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed-password') },
}));

import { GET, POST } from '@/app/api/admin/setup/route';

describe('GET /api/admin/setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns setupRequired: true when no admins exist', async () => {
    mockPrisma.admin.count.mockResolvedValue(0);

    const res = await GET();
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.setupRequired).toBe(true);
  });

  it('returns setupRequired: false when admins exist', async () => {
    mockPrisma.admin.count.mockResolvedValue(1);

    const res = await GET();
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.setupRequired).toBe(false);
  });

  it('returns 500 on database error', async () => {
    mockPrisma.admin.count.mockRejectedValue(new Error('DB error'));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe('POST /api/admin/setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates admin and returns session cookie when no admins exist', async () => {
    mockPrisma.admin.count.mockResolvedValue(0);
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        admin: {
          create: vi.fn().mockResolvedValue({ id: 'admin-1', username: 'admin' }),
          count: vi.fn().mockResolvedValue(1),
        },
      };
      return fn(tx);
    });
    mockPrisma.adminSession.create.mockResolvedValue({
      id: 'mock-session-token-abc123',
    });

    const req = createRequest('/api/admin/setup', {
      method: 'POST',
      body: { username: 'admin', password: 'SecurePass123!' },
    });

    const res = await POST(req);
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    const setCookie = res.headers.getSetCookie();
    expect(setCookie.some((c: string) => c.includes('admin_session'))).toBe(true);
  });

  it('returns 403 when admins already exist', async () => {
    mockPrisma.admin.count.mockResolvedValue(1);

    const req = createRequest('/api/admin/setup', {
      method: 'POST',
      body: { username: 'admin', password: 'SecurePass123!' },
    });

    const res = await POST(req);
    const body = await jsonBody(res);

    expect(res.status).toBe(403);
    expect(body.message).toContain('already');
  });

  it('returns 400 on invalid body (missing password)', async () => {
    mockPrisma.admin.count.mockResolvedValue(0);

    const req = createRequest('/api/admin/setup', {
      method: 'POST',
      body: { username: 'admin' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 on empty username', async () => {
    mockPrisma.admin.count.mockResolvedValue(0);

    const req = createRequest('/api/admin/setup', {
      method: 'POST',
      body: { username: '', password: 'SecurePass123!' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('handles race condition where two setups happen simultaneously', async () => {
    mockPrisma.admin.count.mockResolvedValue(0);
    mockPrisma.$transaction.mockRejectedValue(new Error('SETUP_RACE_CONDITION'));

    const req = createRequest('/api/admin/setup', {
      method: 'POST',
      body: { username: 'admin', password: 'SecurePass123!' },
    });

    const res = await POST(req);
    const body = await jsonBody(res);

    expect(res.status).toBe(403);
    expect(body.message).toContain('already');
  });
});
