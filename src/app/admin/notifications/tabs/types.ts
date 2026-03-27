// ─── Shared Types ───────────────────────────────────────────────────

export interface Webhook {
  id: string;
  name: string;
  url: string;
  type: 'discord' | 'generic';
  events: string[];
  enabled: boolean;
  hasSecret: boolean;
  template: string | null;
  createdAt: string;
}

export interface EmailTemplate {
  eventType: string;
  subject: string;
  body: string;
  enabled: boolean;
  isDefault: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  sentBy: string;
  sentTo: string;
  sentVia: string;
  sentCount: number;
  createdAt: string;
}

export type Tab = 'webhooks' | 'email-templates' | 'announcements';

// ─── Shared Form Types ─────────────────────────────────────────────

export interface WebhookForm {
  name: string;
  url: string;
  type: 'discord' | 'generic';
  events: string[];
  enabled: boolean;
  secret: string;
  template: string;
}

export interface TemplateForm {
  subject: string;
  body: string;
  enabled: boolean;
}

export interface AnnouncementForm {
  title: string;
  body: string;
  sentTo: string;
  sendVia: string[];
}

// ─── Styles Prop ────────────────────────────────────────────────────

export type Styles = Record<string, string>;

// ─── Constants ──────────────────────────────────────────────────────

export const WEBHOOK_EVENTS = [
  'user.registered',
  'user.disabled',
  'user.enabled',
  'user.deleted',
  'user.expired',
  'invite.created',
  'invite.used',
  'invite.expired',
  'invite_request.created',
  'invite_request.approved',
  'invite_request.denied',
  'announcement.sent',
  'admin.login',
  'password.reset',
];

export const TEMPLATE_TYPES: Record<string, { label: string; description: string }> = {
  welcome: { label: 'Welcome', description: 'Sent when a user registers' },
  password_reset: { label: 'Password Reset', description: 'Sent when a password reset is requested' },
  invite_expiry: { label: 'Invite Expiry', description: 'Sent when an invite is about to expire' },
  account_expiry: { label: 'Account Expiry', description: 'Sent when a user account is about to expire' },
  account_disabled: { label: 'Account Disabled', description: 'Sent when a user account is disabled' },
  server_access: { label: 'Server Access', description: 'Sent when a user is added to a server' },
  announcement: { label: 'Announcement', description: 'Template for announcement emails' },
};

// ─── Helpers ────────────────────────────────────────────────────────

export function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname;
    const masked = path.length > 12 ? path.slice(0, 8) + '...' + path.slice(-4) : path;
    return u.origin + masked;
  } catch {
    return url.slice(0, 20) + '...';
  }
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
