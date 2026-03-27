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

import { GET } from '@/app/api/invites/verify/[code]/route';

function callGET(code: string) {
  const req = createRequest(`/api/invites/verify/${code}`);
  return GET(req, { params: Promise.resolve({ code }) });
}

describe('GET /api/invites/verify/[code]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns valid invite details', async () => {
    mockPrisma.invite.findUnique.mockResolvedValue({
      id: 'inv-1',
      code: 'ABC123',
      status: 'active',
      expiresAt: new Date(Date.now() + 86400000),
      maxUses: 10,
      uses: 3,
      serverId: 'srv-1',
      libraries: '["lib1","lib2"]',
      accessUntil: null,
      accessDurationDays: 30,
      passphrase: null,
      server: { type: 'jellyfin', name: 'My Jellyfin' },
    });
    mockPrisma.settings.findFirst.mockResolvedValue({
      preRegisterTitle: 'Welcome',
      preRegisterSubtitle: '',
      preRegisterChecklist: '[]',
      requireInviteAcceptance: false,
      captchaEnabled: false,
    });

    const res = await callGET('ABC123');
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.serverType).toBe('jellyfin');
    expect(body.serverName).toBe('My Jellyfin');
    expect(body.libraries).toEqual(['lib1', 'lib2']);
    expect(body.accessDurationDays).toBe(30);
    expect(body.passphraseRequired).toBe(false);
  });

  it('returns 404 for nonexistent invite code', async () => {
    mockPrisma.invite.findUnique.mockResolvedValue(null);

    const res = await callGET('NOTREAL');
    const body = await jsonBody(res);

    expect(res.status).toBe(404);
    expect(body.valid).toBe(false);
    expect(body.message).toContain('Invalid');
  });

  it('returns 400 for inactive invite', async () => {
    mockPrisma.invite.findUnique.mockResolvedValue({
      id: 'inv-1',
      code: 'USED01',
      status: 'used',
      server: { type: 'jellyfin', name: 'Test' },
    });

    const res = await callGET('USED01');
    const body = await jsonBody(res);

    expect(res.status).toBe(400);
    expect(body.valid).toBe(false);
  });

  it('returns 400 and marks expired invite', async () => {
    mockPrisma.invite.findUnique.mockResolvedValue({
      id: 'inv-1',
      code: 'EXPRD1',
      status: 'active',
      expiresAt: new Date(Date.now() - 86400000),
      maxUses: 10,
      uses: 0,
      server: { type: 'plex', name: 'Plex' },
    });
    mockPrisma.invite.update.mockResolvedValue({});

    const res = await callGET('EXPRD1');
    const body = await jsonBody(res);

    expect(res.status).toBe(400);
    expect(body.valid).toBe(false);
    expect(body.message).toContain('expired');
    expect(mockPrisma.invite.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { status: 'expired' },
    });
  });

  it('returns 400 when invite has been fully used', async () => {
    mockPrisma.invite.findUnique.mockResolvedValue({
      id: 'inv-1',
      code: 'MAXED1',
      status: 'active',
      expiresAt: null,
      maxUses: 5,
      uses: 5,
      server: { type: 'jellyfin', name: 'JF' },
    });

    const res = await callGET('MAXED1');
    const body = await jsonBody(res);

    expect(res.status).toBe(400);
    expect(body.valid).toBe(false);
    expect(body.message).toContain('used');
  });

  it('case-insensitive code lookup (uppercases input)', async () => {
    mockPrisma.invite.findUnique.mockResolvedValue(null);

    await callGET('abc123');

    expect(mockPrisma.invite.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { code: 'ABC123' },
      })
    );
  });

  it('indicates when passphrase is required', async () => {
    mockPrisma.invite.findUnique.mockResolvedValue({
      id: 'inv-1',
      code: 'SECURE',
      status: 'active',
      expiresAt: null,
      maxUses: 0,
      uses: 0,
      serverId: 'srv-1',
      libraries: '[]',
      accessUntil: null,
      accessDurationDays: 0,
      passphrase: '$2a$12$hashedpassphrase',
      server: { type: 'jellyfin', name: 'JF' },
    });
    mockPrisma.settings.findFirst.mockResolvedValue({
      preRegisterTitle: null,
      preRegisterSubtitle: null,
      preRegisterChecklist: null,
      requireInviteAcceptance: false,
      captchaEnabled: false,
    });

    const res = await callGET('SECURE');
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.passphraseRequired).toBe(true);
  });

  it('allows unlimited uses when maxUses is 0', async () => {
    mockPrisma.invite.findUnique.mockResolvedValue({
      id: 'inv-1',
      code: 'UNLIM1',
      status: 'active',
      expiresAt: null,
      maxUses: 0,
      uses: 999,
      serverId: 'srv-1',
      libraries: '[]',
      accessUntil: null,
      accessDurationDays: 0,
      passphrase: null,
      server: { type: 'plex', name: 'Plex' },
    });
    mockPrisma.settings.findFirst.mockResolvedValue({
      preRegisterTitle: null,
      preRegisterSubtitle: null,
      preRegisterChecklist: null,
      requireInviteAcceptance: false,
      captchaEnabled: false,
    });

    const res = await callGET('UNLIM1');
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.valid).toBe(true);
  });
});
