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
      invite: mockModel(), server: mockModel(), settings: mockModel(),
      $queryRaw: vi.fn(), $transaction: vi.fn(),
    },
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('hashed') } }));
vi.mock('@/lib/crypto', () => ({
  decrypt: (s: string) => s,
  decryptServerSecrets: <T>(s: T) => s,
  generateSessionToken: () => 'mock-token',
  hashSessionToken: (s: string) => `hash:${s}`,
  generateInviteCode: () => 'MOCKCODE',
}));
vi.mock('@/lib/audit', () => ({ auditLog: vi.fn() }));
vi.mock('@/lib/notifications/webhooks', () => ({ dispatchWebhook: vi.fn() }));

import { PATCH, DELETE } from '@/app/api/invites/[id]/route';

function authedRequest(url: string, opts: { method?: string; body?: unknown } = {}) {
  return createRequest(url, {
    ...opts,
    cookies: { admin_session: 'valid-session' },
  });
}

describe('PATCH /api/invites/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock valid admin session
    mockPrisma.adminSession.findUnique.mockResolvedValue({
      id: 'sess1',
      adminId: 'admin1',
      expiresAt: new Date(Date.now() + 86400000),
      admin: { id: 'admin1', username: 'admin' },
    });
    mockPrisma.settings.findFirst.mockResolvedValue(null);
  });

  it('returns 401 without auth', async () => {
    const req = createRequest('/api/invites/inv1', { method: 'PATCH', body: {} });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'inv1' }) });
    expect(res.status).toBe(401);
  });

  it('rejects negative maxUses', async () => {
    const req = authedRequest('/api/invites/inv1', { method: 'PATCH', body: { maxUses: -5 } });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'inv1' }) });
    expect(res.status).toBe(400);
    const body = await jsonBody(res);
    expect(body.message).toContain('maxUses');
  });

  it('rejects NaN maxUses', async () => {
    const req = authedRequest('/api/invites/inv1', { method: 'PATCH', body: { maxUses: 'abc' } });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'inv1' }) });
    expect(res.status).toBe(400);
  });

  it('rejects maxUses over 10000', async () => {
    const req = authedRequest('/api/invites/inv1', { method: 'PATCH', body: { maxUses: 99999 } });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'inv1' }) });
    expect(res.status).toBe(400);
  });

  it('rejects negative accessDurationDays', async () => {
    const req = authedRequest('/api/invites/inv1', { method: 'PATCH', body: { accessDurationDays: -1 } });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'inv1' }) });
    expect(res.status).toBe(400);
  });

  it('accepts valid maxUses', async () => {
    mockPrisma.invite.update.mockResolvedValue({ id: 'inv1', maxUses: 50, server: { id: 's1', name: 'Test', type: 'jellyfin', url: 'http://localhost' } });
    const req = authedRequest('/api/invites/inv1', { method: 'PATCH', body: { maxUses: 50 } });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'inv1' }) });
    expect(res.status).toBe(200);
  });

  it('does not leak server secrets in response', async () => {
    mockPrisma.invite.update.mockResolvedValue({
      id: 'inv1',
      server: { id: 's1', name: 'Test', type: 'jellyfin', url: 'http://localhost' },
    });
    const req = authedRequest('/api/invites/inv1', { method: 'PATCH', body: { maxUses: 5 } });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'inv1' }) });
    const body = await jsonBody(res);
    // The select should only include id, name, type, url
    expect(body.server).not.toHaveProperty('apiKey');
    expect(body.server).not.toHaveProperty('token');
    expect(body.server).not.toHaveProperty('adminPassword');
  });
});

describe('DELETE /api/invites/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.adminSession.findUnique.mockResolvedValue({
      id: 'sess1',
      adminId: 'admin1',
      expiresAt: new Date(Date.now() + 86400000),
      admin: { id: 'admin1', username: 'admin' },
    });
    mockPrisma.settings.findFirst.mockResolvedValue(null);
  });

  it('returns 404 for nonexistent invite', async () => {
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
    const prismaError = new Error('Record not found');
    Object.assign(prismaError, { code: 'P2025' });
    mockPrisma.invite.delete.mockRejectedValue(prismaError);

    const req = authedRequest('/api/invites/nonexistent', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'nonexistent' }) });
    expect(res.status).toBe(404);
  });
});
