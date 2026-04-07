// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequest, jsonBody } from './helpers';

const { mockPrisma, mockBcrypt } = vi.hoisted(() => {
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
    mockBcrypt: {
      compare: vi.fn(),
      hash: vi.fn().mockResolvedValue('hashed'),
    },
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('bcryptjs', () => ({ default: mockBcrypt }));
vi.mock('@/lib/crypto', () => ({
  decrypt: (s: string) => s,
  decryptServerSecrets: <T>(s: T) => s,
  generateSessionToken: () => 'mock-session-token',
}));
vi.mock('@/lib/audit', () => ({ auditLog: vi.fn() }));
vi.mock('@/lib/notifications/webhooks', () => ({ dispatchWebhook: vi.fn() }));
vi.mock('@/lib/servers/jellyfin', () => ({ authenticateJellyfinAdmin: vi.fn() }));
vi.mock('@/lib/servers/plex', () => ({ authenticatePlexAdmin: vi.fn() }));
vi.mock('otplib', () => ({ verify: vi.fn() }));

import { POST } from '@/app/api/admin/login/route';

// Enable x-forwarded-for trust for tests
process.env.TRUSTED_PROXY_COUNT = '1';

// Each test gets a unique IP to avoid rate limit collisions
let ipCounter = 0;
function loginRequest(body: Record<string, unknown>) {
  return createRequest('/api/admin/login', {
    method: 'POST',
    body,
    headers: { 'x-forwarded-for': `10.0.${Math.floor(++ipCounter / 256)}.${ipCounter % 256}` },
  });
}

describe('POST /api/admin/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 setupRequired when no admins exist', async () => {
    mockPrisma.admin.count.mockResolvedValue(0);

    const req = loginRequest({ username: 'admin', password: 'password123' });

    const res = await POST(req);
    const body = await jsonBody(res);

    expect(res.status).toBe(403);
    expect(body.setupRequired).toBe(true);
  });

  it('returns 401 for invalid credentials', async () => {
    mockPrisma.admin.count.mockResolvedValue(1);
    mockPrisma.admin.findUnique.mockResolvedValue({
      id: 'admin-1',
      username: 'admin',
      passwordHash: 'hashed-password',
      failedLoginAttempts: 0,
      lockedUntil: null,
      totpEnabled: false,
      totpSecret: null,
    });
    mockBcrypt.compare.mockResolvedValue(false);
    mockPrisma.settings.findFirst.mockResolvedValue(null);
    mockPrisma.server.findMany.mockResolvedValue([]);
    mockPrisma.admin.update.mockResolvedValue({});

    const req = loginRequest({ username: 'admin', password: 'wrong-password' });

    const res = await POST(req);
    const body = await jsonBody(res);

    expect(res.status).toBe(401);
    expect(body.message).toContain('Invalid');
  });

  it('returns session cookie on valid login', async () => {
    mockPrisma.admin.count.mockResolvedValue(1);
    mockPrisma.admin.findUnique.mockResolvedValue({
      id: 'admin-1',
      username: 'admin',
      passwordHash: 'hashed-password',
      failedLoginAttempts: 0,
      lockedUntil: null,
      totpEnabled: false,
      totpSecret: null,
    });
    mockBcrypt.compare.mockResolvedValue(true);
    mockPrisma.adminSession.create.mockResolvedValue({ id: 'mock-session-token' });
    mockPrisma.adminSession.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.admin.update.mockResolvedValue({});

    const req = loginRequest({ username: 'admin', password: 'correct-password' });

    const res = await POST(req);
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    const setCookie = res.headers.getSetCookie();
    expect(setCookie.some((c: string) => c.includes('admin_session'))).toBe(true);
  });

  it('returns 401 for nonexistent user', async () => {
    mockPrisma.admin.count.mockResolvedValue(1);
    mockPrisma.admin.findUnique.mockResolvedValue(null);
    mockPrisma.settings.findFirst.mockResolvedValue(null);
    mockPrisma.server.findMany.mockResolvedValue([]);

    const req = loginRequest({ username: 'nobody', password: 'password123' });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 423 for locked account', async () => {
    mockPrisma.admin.count.mockResolvedValue(1);
    mockPrisma.admin.findUnique.mockResolvedValue({
      id: 'admin-1',
      username: 'admin',
      passwordHash: 'hashed-password',
      failedLoginAttempts: 5,
      lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      totpEnabled: false,
      totpSecret: null,
    });

    const req = loginRequest({ username: 'admin', password: 'password123' });

    const res = await POST(req);
    const body = await jsonBody(res);

    expect(res.status).toBe(423);
    expect(body.message).toContain('locked');
    expect(res.headers.get('Retry-After')).toBeDefined();
  });

  it('returns 403 with totpRequired when 2FA is enabled', async () => {
    mockPrisma.admin.count.mockResolvedValue(1);
    mockPrisma.admin.findUnique.mockResolvedValue({
      id: 'admin-1',
      username: 'admin',
      passwordHash: 'hashed-password',
      failedLoginAttempts: 0,
      lockedUntil: null,
      totpEnabled: true,
      totpSecret: 'encrypted-secret',
    });
    mockBcrypt.compare.mockResolvedValue(true);
    mockPrisma.admin.update.mockResolvedValue({});

    const req = loginRequest({ username: 'admin', password: 'correct-password' });

    const res = await POST(req);
    const body = await jsonBody(res);

    expect(res.status).toBe(403);
    expect(body.totpRequired).toBe(true);
  });

  it('returns 400 on missing username', async () => {
    const req = loginRequest({ password: 'password123' });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('increments failed attempts on wrong password', async () => {
    mockPrisma.admin.count.mockResolvedValue(1);
    mockPrisma.admin.findUnique.mockResolvedValue({
      id: 'admin-1',
      username: 'admin',
      passwordHash: 'hashed-password',
      failedLoginAttempts: 3,
      lockedUntil: null,
      totpEnabled: false,
      totpSecret: null,
    });
    mockBcrypt.compare.mockResolvedValue(false);
    mockPrisma.settings.findFirst.mockResolvedValue(null);
    mockPrisma.server.findMany.mockResolvedValue([]);
    mockPrisma.admin.update.mockResolvedValue({});

    const req = loginRequest({ username: 'admin', password: 'wrong' });

    await POST(req);

    expect(mockPrisma.admin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'admin-1' },
        data: expect.objectContaining({ failedLoginAttempts: 4 }),
      })
    );
  });

  it('locks account after 5 failed attempts', async () => {
    mockPrisma.admin.count.mockResolvedValue(1);
    mockPrisma.admin.findUnique.mockResolvedValue({
      id: 'admin-1',
      username: 'admin',
      passwordHash: 'hashed-password',
      failedLoginAttempts: 4,
      lockedUntil: null,
      totpEnabled: false,
      totpSecret: null,
    });
    mockBcrypt.compare.mockResolvedValue(false);
    mockPrisma.settings.findFirst.mockResolvedValue(null);
    mockPrisma.server.findMany.mockResolvedValue([]);
    mockPrisma.admin.update.mockResolvedValue({});

    const req = loginRequest({ username: 'admin', password: 'wrong' });

    await POST(req);

    expect(mockPrisma.admin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failedLoginAttempts: 5,
          lockedUntil: expect.any(Date),
        }),
      })
    );
  });

  it('resets failed attempts on successful login', async () => {
    mockPrisma.admin.count.mockResolvedValue(1);
    mockPrisma.admin.findUnique.mockResolvedValue({
      id: 'admin-1',
      username: 'admin',
      passwordHash: 'hashed-password',
      failedLoginAttempts: 3,
      lockedUntil: null,
      totpEnabled: false,
      totpSecret: null,
    });
    mockBcrypt.compare.mockResolvedValue(true);
    mockPrisma.adminSession.create.mockResolvedValue({ id: 'mock-session-token' });
    mockPrisma.adminSession.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.admin.update.mockResolvedValue({});

    const req = loginRequest({ username: 'admin', password: 'correct' });

    await POST(req);

    expect(mockPrisma.admin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failedLoginAttempts: 0,
          lockedUntil: null,
        }),
      })
    );
  });
});
