import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import { importBackupSchema, validateBody } from '@/lib/validation';
import { auditLog } from '@/lib/audit';
import { sanitizeBackupSettings, stripHtml, isPublicUrl } from '@/lib/sanitize';

const BACKUP_VERSION = 1;
const APP_VERSION = '1.0.0';

// GET /api/admin/backup — export a full backup as JSON
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    const [settings, invites, users, servers, webhooks, emailTemplates, announcements] =
      await Promise.all([
        prisma.settings.findFirst(),
        prisma.invite.findMany(),
        prisma.user.findMany(),
        prisma.server.findMany(),
        prisma.webhook.findMany(),
        prisma.emailTemplate.findMany(),
        prisma.announcement.findMany(),
      ]);

    // Strip encrypted secrets from settings
    const safeSettings = settings
      ? {
          ...settings,
          smtpPass: undefined,
          jellyseerrApiKey: undefined,
        }
      : null;

    // Strip tokens/passwords from servers
    const safeServers = servers.map((s) => ({
      ...s,
      token: undefined,
      apiKey: undefined,
      adminPassword: undefined,
    }));

    // Strip passwordHash from users
    const safeUsers = users.map((u) => ({
      ...u,
      passwordHash: undefined,
    }));

    // Strip secrets from webhooks
    const safeWebhooks = webhooks.map((wh) => ({
      ...wh,
      secret: undefined,
    }));

    const backup = {
      metadata: {
        exportedAt: new Date().toISOString(),
        version: BACKUP_VERSION,
        appVersion: APP_VERSION,
      },
      settings: safeSettings,
      invites,
      users: safeUsers,
      servers: safeServers,
      webhooks: safeWebhooks,
      emailTemplates,
      announcements,
    };

    await auditLog('backup.exported', { actor: auth.admin.username });

    return NextResponse.json(backup);
  } catch (error) {
    console.error('Failed to export backup:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/backup — import/restore from a JSON backup
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (isAuthError(auth)) return auth;

    if (auth.admin.source !== 'local') {
      return NextResponse.json({ message: 'Only the Portalrr admin can import backups' }, { status: 403 });
    }

    const body = await request.json();
    const validation = validateBody(importBackupSchema, body);
    if (!validation.success) return validation.response;

    const { mode, sections, data } = validation.data;

    // Validate that the backup data has the expected structure
    if (!data || typeof data !== 'object') {
      return NextResponse.json({ message: 'Invalid backup data' }, { status: 400 });
    }

    const backupData = data as Record<string, unknown>;

    // Validate metadata presence
    if (!backupData.metadata || typeof backupData.metadata !== 'object') {
      return NextResponse.json({ message: 'Missing or invalid backup metadata' }, { status: 400 });
    }

    const metadata = backupData.metadata as Record<string, unknown>;
    if (typeof metadata.version !== 'number' || typeof metadata.exportedAt !== 'string') {
      return NextResponse.json({ message: 'Invalid backup metadata format' }, { status: 400 });
    }

    const imported: string[] = [];
    const errors: string[] = [];

    await prisma.$transaction(async (tx) => {
      // Settings
      if (sections.includes('settings') && backupData.settings) {
        try {
          const settingsData = backupData.settings as Record<string, unknown>;
          // Remove id and any encrypted fields that were stripped
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, smtpPass, jellyseerrApiKey, ...rawData } = settingsData;
          // Sanitize text fields and CSS to prevent stored XSS
          const safeData = sanitizeBackupSettings(rawData);
          const existing = await tx.settings.findFirst();
          if (mode === 'replace' && existing) {
            await tx.settings.update({ where: { id: existing.id }, data: safeData });
          } else if (!existing) {
            await tx.settings.create({
              data: {
                serverName: (safeData.serverName as string) || 'Media Server',
                accentColor: (safeData.accentColor as string) || '#A78BFA',
                inviteExpiryDays: (safeData.inviteExpiryDays as number) || 7,
                maxInvites: (safeData.maxInvites as number) || 100,
                onboardingContent: (safeData.onboardingContent as string) || '[]',
                ...safeData,
              },
            });
          }
          imported.push('settings');
        } catch (err) {
          errors.push(`settings: ${err instanceof Error ? err.message : 'unknown error'}`);
        }
      }

      // Servers
      if ((sections.includes('invites') || sections.includes('users')) && backupData.servers) {
        // Servers are a dependency for invites and users, so import them when those sections are selected
        try {
          const serversData = backupData.servers as Array<Record<string, unknown>>;
          if (mode === 'replace') {
            // Only delete servers that don't have dependent data outside the backup
            await tx.server.deleteMany();
          }
          for (const server of serversData) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { token, apiKey, adminPassword, ...safeServer } = server;
            if (mode === 'merge') {
              const existing = await tx.server.findUnique({ where: { id: safeServer.id as string } });
              if (!existing) {
                await tx.server.create({ data: safeServer as Parameters<typeof tx.server.create>[0]['data'] });
              }
            } else {
              await tx.server.create({ data: safeServer as Parameters<typeof tx.server.create>[0]['data'] });
            }
          }
          imported.push('servers');
        } catch (err) {
          errors.push(`servers: ${err instanceof Error ? err.message : 'unknown error'}`);
        }
      }

      // Invites
      if (sections.includes('invites') && backupData.invites) {
        try {
          const invitesData = backupData.invites as Array<Record<string, unknown>>;
          if (mode === 'replace') {
            await tx.invite.deleteMany();
          }
          for (const invite of invitesData) {
            if (mode === 'merge') {
              const existing = await tx.invite.findUnique({ where: { id: invite.id as string } });
              if (!existing) {
                await tx.invite.create({ data: invite as Parameters<typeof tx.invite.create>[0]['data'] });
              }
            } else {
              await tx.invite.create({ data: invite as Parameters<typeof tx.invite.create>[0]['data'] });
            }
          }
          imported.push('invites');
        } catch (err) {
          errors.push(`invites: ${err instanceof Error ? err.message : 'unknown error'}`);
        }
      }

      // Users
      if (sections.includes('users') && backupData.users) {
        try {
          const usersData = backupData.users as Array<Record<string, unknown>>;
          if (mode === 'replace') {
            await tx.userSession.deleteMany();
            await tx.passwordResetToken.deleteMany();
            await tx.user.deleteMany();
          }
          for (const user of usersData) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { passwordHash, sessions, passwordResetTokens, ...rawUser } = user;
            // Sanitize text fields to prevent stored XSS
            const safeUser = { ...rawUser };
            if (typeof safeUser.username === 'string') safeUser.username = stripHtml(safeUser.username);
            if (typeof safeUser.notes === 'string') safeUser.notes = stripHtml(safeUser.notes);
            if (typeof safeUser.discordUsername === 'string') safeUser.discordUsername = stripHtml(safeUser.discordUsername);
            if (typeof safeUser.telegramUsername === 'string') safeUser.telegramUsername = stripHtml(safeUser.telegramUsername);
            if (mode === 'merge') {
              const existingById = await tx.user.findUnique({ where: { id: safeUser.id as string } });
              if (!existingById) {
                // Also check for unique constraint conflicts
                const existingByEmail = await tx.user.findUnique({ where: { email: safeUser.email as string } });
                const existingByUsername = await tx.user.findUnique({ where: { username: safeUser.username as string } });
                if (!existingByEmail && !existingByUsername) {
                  await tx.user.create({ data: { ...safeUser, passwordHash: '' } as Parameters<typeof tx.user.create>[0]['data'] });
                }
              }
            } else {
              await tx.user.create({ data: { ...safeUser, passwordHash: '' } as Parameters<typeof tx.user.create>[0]['data'] });
            }
          }
          imported.push('users');
        } catch (err) {
          errors.push(`users: ${err instanceof Error ? err.message : 'unknown error'}`);
        }
      }

      // Webhooks
      if (sections.includes('webhooks') && backupData.webhooks) {
        try {
          const webhooksData = backupData.webhooks as Array<Record<string, unknown>>;
          if (mode === 'replace') {
            await tx.webhook.deleteMany();
          }
          for (const webhook of webhooksData) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { secret, ...safeWebhook } = webhook;
            // Block webhooks with private/internal URLs (SSRF prevention)
            if (typeof safeWebhook.url === 'string' && !isPublicUrl(safeWebhook.url)) {
              errors.push(`webhook: blocked private URL ${safeWebhook.name || safeWebhook.url}`);
              continue;
            }
            if (typeof safeWebhook.name === 'string') safeWebhook.name = stripHtml(safeWebhook.name);
            if (mode === 'merge') {
              const existing = await tx.webhook.findUnique({ where: { id: safeWebhook.id as string } });
              if (!existing) {
                await tx.webhook.create({ data: safeWebhook as Parameters<typeof tx.webhook.create>[0]['data'] });
              }
            } else {
              await tx.webhook.create({ data: safeWebhook as Parameters<typeof tx.webhook.create>[0]['data'] });
            }
          }
          imported.push('webhooks');
        } catch (err) {
          errors.push(`webhooks: ${err instanceof Error ? err.message : 'unknown error'}`);
        }
      }

      // Email templates
      if (sections.includes('emailTemplates') && backupData.emailTemplates) {
        try {
          const templatesData = backupData.emailTemplates as Array<Record<string, unknown>>;
          if (mode === 'replace') {
            await tx.emailTemplate.deleteMany();
          }
          for (const template of templatesData) {
            if (mode === 'merge') {
              const existing = await tx.emailTemplate.findUnique({ where: { id: template.id as string } });
              if (!existing) {
                await tx.emailTemplate.create({ data: template as Parameters<typeof tx.emailTemplate.create>[0]['data'] });
              }
            } else {
              await tx.emailTemplate.create({ data: template as Parameters<typeof tx.emailTemplate.create>[0]['data'] });
            }
          }
          imported.push('emailTemplates');
        } catch (err) {
          errors.push(`emailTemplates: ${err instanceof Error ? err.message : 'unknown error'}`);
        }
      }

      // Announcements
      if (sections.includes('announcements') && backupData.announcements) {
        try {
          const announcementsData = backupData.announcements as Array<Record<string, unknown>>;
          if (mode === 'replace') {
            await tx.announcement.deleteMany();
          }
          for (const announcement of announcementsData) {
            if (mode === 'merge') {
              const existing = await tx.announcement.findUnique({ where: { id: announcement.id as string } });
              if (!existing) {
                await tx.announcement.create({ data: announcement as Parameters<typeof tx.announcement.create>[0]['data'] });
              }
            } else {
              await tx.announcement.create({ data: announcement as Parameters<typeof tx.announcement.create>[0]['data'] });
            }
          }
          imported.push('announcements');
        } catch (err) {
          errors.push(`announcements: ${err instanceof Error ? err.message : 'unknown error'}`);
        }
      }
    });

    await auditLog('backup.imported', {
      actor: auth.admin.username,
      mode,
      sections,
      imported,
      errors: errors.length > 0 ? errors : undefined,
    });

    return NextResponse.json({
      message: 'Backup imported successfully',
      imported,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Failed to import backup:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
