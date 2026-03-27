// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonBody } from './helpers';
import { NextRequest } from 'next/server';

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
vi.mock('@/lib/auto-remove', () => ({
  runAutoRemoveIfDue: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from '@/app/api/settings/public/route';

function callGET() {
  const req = new NextRequest(new URL('http://localhost/api/settings/public'));
  return GET(req);
}

describe('GET /api/settings/public', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns public settings', async () => {
    mockPrisma.settings.findFirst.mockResolvedValue({
      serverName: 'My Server',
      accentColor: '#A78BFA',
      themeVersion: 1,
      customCss: null,
      appName: 'Portalrr',
      logoUrl: null,
      logoMode: 'text',
      subtitleText: 'Welcome',
      backgroundStyle: 'gradient',
      backgroundImageUrl: null,
      backgroundOverlay: true,
      cardStyle: 'glass',
      borderRadius: 'md',
      welcomeTitle: 'Welcome!',
      registerTitle: 'Create Account',
      footerText: null,
      hideAdminLink: false,
      cardWidth: 'md',
      fontFamily: 'inter',
      fontDisplay: 'inter',
      buttonStyle: 'filled',
      inputStyle: 'outlined',
      enableAnimations: true,
      enableNoise: true,
      gradientDirection: '135deg',
      buttonText: null,
      registerButtonText: null,
      inviteRequestsEnabled: false,
      inviteRequestMessage: null,
      passwordMinLength: 8,
      passwordRequireUppercase: false,
      passwordRequireNumber: false,
      passwordRequireSpecial: false,
    });

    const res = await callGET();
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.appName).toBe('Portalrr');
    expect(body.accentColor).toBe('#A78BFA');
    expect(body.enableAnimations).toBe(true);
    expect(body.passwordMinLength).toBe(8);
  });

  it('returns empty object when no settings exist', async () => {
    mockPrisma.settings.findFirst.mockResolvedValue(null);

    const res = await callGET();
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body).toEqual({});
  });

  it('sets Cache-Control: no-cache header', async () => {
    mockPrisma.settings.findFirst.mockResolvedValue({
      serverName: 'Test',
      accentColor: '#FF0000',
      themeVersion: 1,
    });

    const res = await callGET();
    expect(res.headers.get('Cache-Control')).toBe('no-cache');
  });

  it('sets accent_color cookie when accentColor exists', async () => {
    mockPrisma.settings.findFirst.mockResolvedValue({
      accentColor: '#FF5500',
      themeVersion: 3,
    });

    const res = await callGET();
    const setCookie = res.headers.getSetCookie();
    expect(setCookie.some((c: string) => c.includes('accent_color'))).toBe(true);
  });

  it('does not include sensitive fields', async () => {
    mockPrisma.settings.findFirst.mockResolvedValue({
      serverName: 'Test',
      accentColor: '#A78BFA',
      themeVersion: 1,
    });

    const res = await callGET();
    const body = await jsonBody(res);

    expect(body.smtpPass).toBeUndefined();
    expect(body.smtpHost).toBeUndefined();
    expect(body.jellyseerrApiKey).toBeUndefined();
    expect(body.discordBotToken).toBeUndefined();
  });

  it('returns 500 on database error', async () => {
    mockPrisma.settings.findFirst.mockRejectedValue(new Error('DB error'));

    const res = await callGET();
    expect(res.status).toBe(500);
  });
});
