// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockDispatchWebhook } = vi.hoisted(() => {
  const mockModel = () => ({
    findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(),
    create: vi.fn(), update: vi.fn(), updateMany: vi.fn(),
    delete: vi.fn(), deleteMany: vi.fn(), count: vi.fn(),
  });
  return {
    mockPrisma: {
      settings: mockModel(),
      user: mockModel(),
      invite: mockModel(),
    },
    mockDispatchWebhook: vi.fn(),
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/notifications/email-templates', () => ({ sendTemplatedEmail: vi.fn() }));
vi.mock('@/lib/crypto', () => ({ decryptServerSecrets: <T>(s: T) => s }));
vi.mock('@/lib/notifications/webhooks', () => ({ dispatchWebhook: mockDispatchWebhook }));

import { runAutoRemoveIfDue } from '../auto-remove';

describe('auto-remove', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the lastRun throttle by advancing time
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2 * 60 * 60 * 1000);
    mockPrisma.invite.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);
  });

  it('disables users when policy is "disable"', async () => {
    const expiredDate = new Date(Date.now() - 86400000);
    mockPrisma.settings.findFirst.mockResolvedValue({
      expiryPolicy: 'disable',
      expiryDeleteAfterDays: 7,
      notifyBeforeExpiryDays: undefined,
      notifyOnExpiry: false,
    });
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'user1', username: 'testuser', autoRemove: true,
        disabled: false, accessUntil: expiredDate, invite: null, server: null,
      },
    ]);
    mockPrisma.user.update.mockResolvedValue({});

    await runAutoRemoveIfDue();

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user1' },
      data: { disabled: true },
    });
    expect(mockDispatchWebhook).toHaveBeenCalledWith('user.disabled', { username: 'testuser' });
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });

  it('does not re-disable already disabled users', async () => {
    const expiredDate = new Date(Date.now() - 86400000);
    mockPrisma.settings.findFirst.mockResolvedValue({
      expiryPolicy: 'disable',
      expiryDeleteAfterDays: 7,
      notifyBeforeExpiryDays: undefined,
      notifyOnExpiry: false,
    });
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'user1', username: 'testuser', autoRemove: true,
        disabled: true, accessUntil: expiredDate, invite: null, server: null,
      },
    ]);

    await runAutoRemoveIfDue();

    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });

  it('deletes users when policy is "delete"', async () => {
    const expiredDate = new Date(Date.now() - 86400000);
    mockPrisma.settings.findFirst.mockResolvedValue({
      expiryPolicy: 'delete',
      expiryDeleteAfterDays: 7,
      notifyBeforeExpiryDays: undefined,
      notifyOnExpiry: false,
    });
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'user1', username: 'testuser', autoRemove: true,
        disabled: false, accessUntil: expiredDate, invite: null, server: null,
      },
    ]);

    await runAutoRemoveIfDue();

    expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user1' } });
    expect(mockDispatchWebhook).toHaveBeenCalledWith('user.expired', { username: 'testuser' });
  });

  it('disables during grace period for "disable_then_delete"', async () => {
    const expiredDate = new Date(Date.now() - 86400000); // 1 day ago
    mockPrisma.settings.findFirst.mockResolvedValue({
      expiryPolicy: 'disable_then_delete',
      expiryDeleteAfterDays: 7, // grace period > 1 day
      notifyBeforeExpiryDays: undefined,
      notifyOnExpiry: false,
    });
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'user1', username: 'testuser', autoRemove: true,
        disabled: false, accessUntil: expiredDate, invite: null, server: null,
      },
    ]);
    mockPrisma.user.update.mockResolvedValue({});

    await runAutoRemoveIfDue();

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user1' },
      data: { disabled: true },
    });
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });
});
