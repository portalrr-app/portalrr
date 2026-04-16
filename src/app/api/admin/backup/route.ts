import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAdmin, isAuthError } from '@/lib/auth/admin';
import {
  importAnnouncementRowSchema,
  importBackupSchema,
  importEmailTemplateRowSchema,
  importInviteRowSchema,
  importServerRowSchema,
  importUserRowSchema,
  importWebhookRowSchema,
  validateBody,
} from '@/lib/validation';
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
          const serversData = Array.isArray(backupData.servers) ? backupData.servers : [];
          if (mode === 'replace') {
            // Only delete servers that don't have dependent data outside the backup
            await tx.server.deleteMany();
          }
          for (const raw of serversData) {
            const parsed = importServerRowSchema.safeParse(raw);
            if (!parsed.success) {
              errors.push(`servers: skipped invalid row (${parsed.error.issues[0]?.message || 'schema mismatch'})`);
              continue;
            }
            const safeServer = { ...parsed.data, name: stripHtml(parsed.data.name) };
            if (mode === 'merge') {
              const existing = await tx.server.findUnique({ where: { id: safeServer.id } });
              if (!existing) {
                await tx.server.create({ data: safeServer });
              }
            } else {
              await tx.server.create({ data: safeServer });
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
          const invitesData = Array.isArray(backupData.invites) ? backupData.invites : [];
          if (mode === 'replace') {
            await tx.invite.deleteMany();
          }
          for (const raw of invitesData) {
            const parsed = importInviteRowSchema.safeParse(raw);
            if (!parsed.success) {
              errors.push(`invites: skipped invalid row (${parsed.error.issues[0]?.message || 'schema mismatch'})`);
              continue;
            }
            const safeInvite = {
              ...parsed.data,
              createdBy: stripHtml(parsed.data.createdBy || ''),
              label: parsed.data.label ? stripHtml(parsed.data.label) : parsed.data.label,
              expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : parsed.data.expiresAt,
              accessUntil: parsed.data.accessUntil ? new Date(parsed.data.accessUntil) : parsed.data.accessUntil,
              createdAt: parsed.data.createdAt ? new Date(parsed.data.createdAt) : undefined,
            };
            if (mode === 'merge') {
              const existing = await tx.invite.findUnique({ where: { id: safeInvite.id } });
              if (!existing) {
                await tx.invite.create({ data: safeInvite });
              }
            } else {
              await tx.invite.create({ data: safeInvite });
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
          const usersData = Array.isArray(backupData.users) ? backupData.users : [];
          if (mode === 'replace') {
            await tx.userSession.deleteMany();
            await tx.passwordResetToken.deleteMany();
            await tx.user.deleteMany();
          }
          for (const raw of usersData) {
            const parsed = importUserRowSchema.safeParse(raw);
            if (!parsed.success) {
              errors.push(`users: skipped invalid row (${parsed.error.issues[0]?.message || 'schema mismatch'})`);
              continue;
            }
            const p = parsed.data;
            const safeUser = {
              ...p,
              username: stripHtml(p.username),
              notes: p.notes ? stripHtml(p.notes) : p.notes,
              discordUsername: p.discordUsername ? stripHtml(p.discordUsername) : p.discordUsername,
              telegramUsername: p.telegramUsername ? stripHtml(p.telegramUsername) : p.telegramUsername,
              disabledReason: p.disabledReason ? stripHtml(p.disabledReason) : p.disabledReason,
              accessUntil: p.accessUntil ? new Date(p.accessUntil) : p.accessUntil,
              disabledAt: p.disabledAt ? new Date(p.disabledAt) : p.disabledAt,
              createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
              passwordHash: '',
            };
            if (mode === 'merge') {
              const existingById = await tx.user.findUnique({ where: { id: safeUser.id } });
              if (!existingById) {
                // Also check for unique constraint conflicts
                const existingByEmail = safeUser.email
                  ? await tx.user.findUnique({ where: { email: safeUser.email } })
                  : null;
                const existingByUsername = await tx.user.findUnique({ where: { username: safeUser.username } });
                if (!existingByEmail && !existingByUsername) {
                  await tx.user.create({ data: safeUser });
                }
              }
            } else {
              await tx.user.create({ data: safeUser });
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
          const webhooksData = Array.isArray(backupData.webhooks) ? backupData.webhooks : [];
          if (mode === 'replace') {
            await tx.webhook.deleteMany();
          }
          for (const raw of webhooksData) {
            const parsed = importWebhookRowSchema.safeParse(raw);
            if (!parsed.success) {
              errors.push(`webhooks: skipped invalid row (${parsed.error.issues[0]?.message || 'schema mismatch'})`);
              continue;
            }
            const p = parsed.data;
            if (!isPublicUrl(p.url)) {
              errors.push(`webhook: blocked private URL ${p.name || p.url}`);
              continue;
            }
            const safeWebhook = {
              ...p,
              name: stripHtml(p.name),
              template: p.template ? stripHtml(p.template) : p.template,
              createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
            };
            if (mode === 'merge') {
              const existing = await tx.webhook.findUnique({ where: { id: safeWebhook.id } });
              if (!existing) {
                await tx.webhook.create({ data: safeWebhook });
              }
            } else {
              await tx.webhook.create({ data: safeWebhook });
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
          const templatesData = Array.isArray(backupData.emailTemplates) ? backupData.emailTemplates : [];
          if (mode === 'replace') {
            await tx.emailTemplate.deleteMany();
          }
          for (const raw of templatesData) {
            const parsed = importEmailTemplateRowSchema.safeParse(raw);
            if (!parsed.success) {
              errors.push(`emailTemplates: skipped invalid row (${parsed.error.issues[0]?.message || 'schema mismatch'})`);
              continue;
            }
            const p = parsed.data;
            const safeTemplate = {
              ...p,
              subject: stripHtml(p.subject),
              createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
              updatedAt: p.updatedAt ? new Date(p.updatedAt) : undefined,
            };
            if (mode === 'merge') {
              const existing = await tx.emailTemplate.findUnique({ where: { id: safeTemplate.id } });
              if (!existing) {
                await tx.emailTemplate.create({ data: safeTemplate });
              }
            } else {
              await tx.emailTemplate.create({ data: safeTemplate });
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
          const announcementsData = Array.isArray(backupData.announcements) ? backupData.announcements : [];
          if (mode === 'replace') {
            await tx.announcement.deleteMany();
          }
          for (const raw of announcementsData) {
            const parsed = importAnnouncementRowSchema.safeParse(raw);
            if (!parsed.success) {
              errors.push(`announcements: skipped invalid row (${parsed.error.issues[0]?.message || 'schema mismatch'})`);
              continue;
            }
            const p = parsed.data;
            const safeAnnouncement = {
              ...p,
              title: stripHtml(p.title),
              sentBy: stripHtml(p.sentBy),
              createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
            };
            if (mode === 'merge') {
              const existing = await tx.announcement.findUnique({ where: { id: safeAnnouncement.id } });
              if (!existing) {
                await tx.announcement.create({ data: safeAnnouncement });
              }
            } else {
              await tx.announcement.create({ data: safeAnnouncement });
            }
          }
          imported.push('announcements');
        } catch (err) {
          errors.push(`announcements: ${err instanceof Error ? err.message : 'unknown error'}`);
        }
      }

      // If any section failed, roll back the entire transaction
      if (errors.length > 0) {
        throw new Error(`Import failed: ${errors.join('; ')}`);
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
