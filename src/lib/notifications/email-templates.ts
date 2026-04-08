import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/notifications/email';

// Default templates — used when no custom template exists in DB
const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string }> = {
  welcome: {
    subject: 'Welcome to {{appName}}!',
    body: `Hi {{username}},

Your account has been created successfully. You now have access to {{serverName}}.

{{#if accessUntil}}Your access is valid until {{accessUntil}}.{{/if}}

Enjoy!`,
  },
  password_reset: {
    subject: '{{appName}} - Password Reset',
    body: `Hi {{username}},

A password reset was requested for your account. Use the link below to set a new password:

{{resetLink}}

This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.`,
  },
  invite_expiry: {
    subject: '{{appName}} - Invite Expired',
    body: `The invite code {{code}} for server {{serverName}} has expired.

- Uses: {{uses}}/{{maxUses}}
- Created by: {{createdBy}}`,
  },
  account_expiry: {
    subject: '{{appName}} - Your Access is Expiring Soon',
    body: `Hi {{username}},

Your access to {{serverName}} will expire on {{expiresAt}}.

Contact your server admin if you'd like to renew your access.`,
  },
  account_disabled: {
    subject: '{{appName}} - Account Disabled',
    body: `Hi {{username}},

Your account has been disabled.

{{#if reason}}Reason: {{reason}}{{/if}}

Contact your server admin for more information.`,
  },
  announcement: {
    subject: '{{appName}} - {{title}}',
    body: `{{body}}`,
  },
  server_access: {
    subject: '{{appName}} - You\'ve been added to {{addedServerName}}',
    body: `Hi {{username}},

You've been granted access to {{addedServerName}} ({{serverType}}).

{{#if isJellyfin}}Log in with your existing username and password.{{/if}}
{{#if isPlex}}Check your email for a Plex sharing invite, or look for the server in your Plex app.{{/if}}

Enjoy!`,
  },
};

/**
 * Render a template string by replacing {{variable}} placeholders.
 * Supports simple conditionals: {{#if var}}...{{/if}}
 */
export function renderTemplate(template: string, vars: Record<string, unknown>): string {
  // Handle {{#if var}}...{{/if}} blocks
  let result = template.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, varName: string, content: string) => {
      return vars[varName] ? content : '';
    }
  );

  // Handle {{variable}} replacements
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : '';
  });

  return result;
}

/**
 * Get a template (custom from DB or default fallback).
 */
async function getTemplate(eventType: string): Promise<{ subject: string; body: string; enabled: boolean } | null> {
  const custom = await prisma.emailTemplate.findUnique({
    where: { eventType },
  });

  if (custom) {
    return { subject: custom.subject, body: custom.body, enabled: custom.enabled };
  }

  const def = DEFAULT_TEMPLATES[eventType];
  if (def) {
    return { ...def, enabled: true };
  }

  return null;
}

/**
 * Send a templated email. Returns true if sent.
 */
export async function sendTemplatedEmail(
  to: string,
  eventType: string,
  vars: Record<string, unknown>
): Promise<boolean> {
  const settings = await prisma.settings.findFirst({
    select: { appName: true, serverName: true },
  });

  const allVars = {
    appName: settings?.appName || 'Portalrr',
    serverName: settings?.serverName || 'Media Server',
    ...vars,
  };

  const template = await getTemplate(eventType);
  if (!template || !template.enabled) return false;

  const subject = renderTemplate(template.subject, allVars);
  const body = renderTemplate(template.body, allVars);

  return sendEmail(to, subject, body);
}

/**
 * Get all template types with their current content (custom or default).
 */
export async function getAllTemplates() {
  const customTemplates = await prisma.emailTemplate.findMany();
  const customMap = new Map(customTemplates.map(t => [t.eventType, t]));

  return Object.entries(DEFAULT_TEMPLATES).map(([eventType, defaults]) => {
    const custom = customMap.get(eventType);
    return {
      eventType,
      subject: custom?.subject || defaults.subject,
      body: custom?.body || defaults.body,
      enabled: custom?.enabled ?? true,
      isCustom: Boolean(custom),
      id: custom?.id || null,
    };
  });
}

/**
 * Get available template variables for each event type.
 */
export function getTemplateVariables(): Record<string, string[]> {
  return {
    welcome: ['appName', 'serverName', 'username', 'email', 'accessUntil'],
    password_reset: ['appName', 'serverName', 'username', 'resetLink'],
    invite_expiry: ['appName', 'serverName', 'code', 'uses', 'maxUses', 'createdBy'],
    account_expiry: ['appName', 'serverName', 'username', 'expiresAt'],
    account_disabled: ['appName', 'serverName', 'username', 'reason'],
    announcement: ['appName', 'serverName', 'title', 'body'],
    server_access: ['appName', 'serverName', 'username', 'addedServerName', 'serverType', 'isJellyfin', 'isPlex'],
  };
}
