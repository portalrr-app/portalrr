import { prisma } from '@/lib/prisma';

/**
 * Structured audit logger. Persists to DB and logs to stdout.
 */
export function auditLog(
  event: string,
  details: Record<string, unknown> = {},
  options?: { actor?: string; target?: string; ip?: string }
) {
  const entry = {
    timestamp: new Date().toISOString(),
    audit: true,
    event,
    ...details,
  };
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);

  // Fire-and-forget DB persist
  prisma.auditLog.create({
    data: {
      event,
      actor: options?.actor || (details.admin ? `admin:${details.admin}` : details.username ? `user:${details.username}` : null),
      target: options?.target || (details.targetUser as string) || null,
      details: JSON.stringify(details),
      ip: options?.ip || (details.ip as string) || null,
    },
  }).catch((err) => {
    console.error('Failed to persist audit log:', err);
  });
}
