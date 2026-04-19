import { z } from 'zod';
import { NextResponse } from 'next/server';
import { isAllowedServerUrl, isPublicUrl } from '@/lib/sanitize';

const safeUrl = z.string().max(500).refine(
  (val) => !val || val.startsWith('/') || val.startsWith('https://') || val.startsWith('http://'),
  'URL must start with /, http://, or https://'
);

const externalUrl = z.string().max(500).refine(
  (val) => !val || val.startsWith('https://') || val.startsWith('http://'),
  'URL must start with http:// or https://'
);

const publicExternalUrl = z.string().max(500).refine(
  (val) => !val || (val.startsWith('https://') || val.startsWith('http://')) && isPublicUrl(val),
  'URL must be a public http:// or https:// address (private/internal IPs are not allowed)'
);

// --- Schemas ---

export const loginSchema = z.object({
  username: z.string().min(1).max(50).trim(),
  password: z.string().min(1).max(128),
  totpCode: z.string().min(6).max(6).optional(),
});

export const setupSchema = z.object({
  username: z.string().min(3).max(50).trim(),
  password: z
    .string()
    .min(12, 'Bootstrap admin password must be at least 12 characters')
    .max(128)
    .refine((p) => /[A-Za-z]/.test(p), 'Password must contain a letter')
    .refine((p) => /\d/.test(p), 'Password must contain a number'),
});

export const registerSchema = z.object({
  code: z.string().min(1).max(20).trim(),
  email: z.string().email().max(255).trim(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, dashes, and underscores'),
  password: z.string().min(1).max(128),
  passphrase: z.string().max(128).optional(),
  captchaAnswer: z.string().max(20).optional(),
});

export const createInviteSchema = z.object({
  serverId: z.string().min(1),
  createdBy: z.string().max(100).optional(),
  maxUses: z.number().int().min(0).max(10000).default(1),
  expiresInDays: z.number().int().min(0).max(365).default(7),
  accessDurationDays: z.number().int().min(0).max(36500).default(0),
  autoRemove: z.boolean().default(false),
  libraries: z.array(z.string().max(100)).max(100).default([]),
  // Code type: random (default), pin (numeric), or custom (user-specified)
  codeType: z.enum(['random', 'pin', 'custom']).optional().default('random'),
  pinLength: z.number().int().min(4).max(8).optional().default(6),
  customCode: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_-]+$/, 'Code can only contain letters, numbers, dashes, and underscores').optional(),
  label: z.string().max(100).optional(),
  passphrase: z.string().max(128).optional(),
  notifyOnUse: z.boolean().default(false),
  notifyOnExpiry: z.boolean().default(false),
});

const mediaServerUrl = z
  .string()
  .url()
  .max(500)
  .refine((u) => /^https?:\/\//i.test(u), { message: 'URL must use http or https' })
  .refine(isAllowedServerUrl, {
    message:
      'URL points to a blocked address (cloud metadata / 169.254.x.x / 0.0.0.0 / link-local IPv6 are not allowed)',
  });

export const createServerSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  type: z.enum(['plex', 'jellyfin']),
  url: mediaServerUrl,
  token: z.string().max(500).optional(),
  apiKey: z.string().max(500).optional(),
  adminUsername: z.string().max(100).optional(),
  adminPassword: z.string().max(500).optional(),
});

export const updateServerSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  type: z.enum(['plex', 'jellyfin']).optional(),
  url: mediaServerUrl.optional(),
  token: z.string().max(500).optional(),
  apiKey: z.string().max(500).optional(),
  adminUsername: z.string().max(100).optional(),
  adminPassword: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const updateSettingsSchema = z.object({
  serverName: z.string().max(100).optional(),
  inviteExpiryDays: z.number().int().min(1).optional(),
  maxInvites: z.number().int().min(1).optional(),
  inviteProfiles: z.string().max(50000).optional(),
  preRegisterTitle: z.string().max(200).optional(),
  preRegisterSubtitle: z.string().max(500).optional(),
  preRegisterChecklist: z.string().max(10000).optional(),
  requireInviteAcceptance: z.boolean().optional(),
  captchaEnabled: z.boolean().optional(),
  customCss: z.string().max(10000).optional().nullable(),
  emailEnabled: z.boolean().optional(),
  smtpHost: z.string().max(500).optional().nullable(),
  smtpPort: z.number().int().min(1).max(65535).optional().nullable(),
  smtpUser: z.string().max(500).optional().nullable(),
  smtpPass: z.string().max(500).optional().nullable(),
  smtpFrom: z.string().max(500).optional().nullable(),
  notifyBeforeExpiryDays: z.number().int().min(0).max(365).optional(),
  notifyOnExpiry: z.boolean().optional(),
  expiryPolicy: z.enum(['delete', 'disable', 'disable_then_delete']).optional(),
  expiryDeleteAfterDays: z.number().int().min(0).max(365).optional(),
  referralInvitesEnabled: z.boolean().optional(),
  referralMaxUses: z.number().int().min(1).max(100).optional(),
  referralExpiresInDays: z.number().int().min(0).max(365).optional(),
  referralAccessDurationDays: z.number().int().min(0).max(36500).optional(),
  referralAutoRemove: z.boolean().optional(),
  accentColor: z.string().max(20).regex(/^#[0-9a-fA-F]{3,8}$/, 'Invalid hex color').optional(),
  appName: z.string().min(1).max(100).optional(),
  logoUrl: safeUrl.optional().nullable(),
  logoMode: z.enum(['icon', 'image', 'none']).optional(),
  subtitleText: z.string().max(500).optional(),
  backgroundStyle: z.enum(['gradient', 'solid', 'image']).optional(),
  backgroundImageUrl: safeUrl.optional().nullable(),
  backgroundOverlay: z.number().min(0).max(1).optional(),
  cardStyle: z.enum(['bordered', 'elevated', 'glass', 'flat']).optional(),
  borderRadius: z.enum(['none', 'small', 'medium', 'large']).optional(),
  cardWidth: z.enum(['compact', 'default', 'wide']).optional(),
  fontFamily: z.string().max(50).optional(),
  fontDisplay: z.string().max(50).optional(),
  buttonStyle: z.enum(['rounded', 'pill', 'square']).optional(),
  inputStyle: z.enum(['outlined', 'filled', 'underline']).optional(),
  enableAnimations: z.boolean().optional(),
  enableNoise: z.boolean().optional(),
  gradientDirection: z.enum(['top', 'center', 'bottom-right', 'radial']).optional(),
  welcomeTitle: z.string().max(200).optional(),
  registerTitle: z.string().max(200).optional(),
  footerText: z.string().max(500).optional().nullable(),
  hideAdminLink: z.boolean().optional(),
  buttonText: z.string().max(100).optional(),
  registerButtonText: z.string().max(100).optional(),
  onboardingTitle: z.string().max(200).optional(),
  onboardingSubtitle: z.string().max(500).optional(),
  onboardingButtonText: z.string().max(100).optional(),
  onboardingButtonUrl: safeUrl.optional(),
  // Onboarding visuals
  onboardingParticleStyle: z.enum(['none', 'constellation', 'starfield', 'orbs', 'portals', 'grid']).optional(),
  onboardingParticleIntensity: z.number().min(0.2).max(1.8).optional(),
  onboardingParticleCursor: z.boolean().optional(),
  onboardingLayout: z.enum(['centered', 'split', 'immersive']).optional(),
  onboardingTransition: z.enum(['glide', 'fade', 'warp']).optional(),
  onboardingGlass: z.boolean().optional(),
  jellyseerrUrl: externalUrl.optional().nullable(),
  jellyseerrApiKey: z.string().max(500).optional().nullable(),
  mediaServerAuth: z.boolean().optional(),
  // Password validation rules
  passwordMinLength: z.number().int().min(4).max(128).optional(),
  passwordRequireUppercase: z.boolean().optional(),
  passwordRequireNumber: z.boolean().optional(),
  passwordRequireSpecial: z.boolean().optional(),
  // Welcome email
  welcomeEmailEnabled: z.boolean().optional(),
  // Invite requests
  inviteRequestsEnabled: z.boolean().optional(),
  inviteRequestMessage: z.string().max(500).optional(),
  inviteRequestServerId: z.string().optional().nullable(),
  // Discord bot
  discordBotToken: z.string().max(200).optional(),
  discordGuildId: z.string().max(30).optional(),
  discordNotifyChannelId: z.string().max(30).optional(),
  discordRoleId: z.string().max(30).optional(),
  discordBotEnabled: z.boolean().optional(),
  // Telegram bot
  telegramBotToken: z.string().max(200).optional(),
  telegramChatId: z.string().max(30).optional(),
  telegramBotEnabled: z.boolean().optional(),
});

export const updateUserSchema = z.object({
  userId: z.string().min(1),
  localId: z.string().optional(),
  remoteUserId: z.string().optional(),
  accessUntil: z.string().optional().nullable(),
  autoRemove: z.boolean().optional(),
  enableLiveTv: z.boolean().optional(),
  allLibraries: z.boolean().optional(),
  libraries: z.array(z.string().max(100)).max(100).optional(),
  source: z.string().optional(),
  serverId: z.string().optional(),
  email: z.string().email().max(200).optional().nullable(),
  // New fields
  disabled: z.boolean().optional(),
  disabledReason: z.string().max(500).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  labels: z.array(z.string().max(50)).max(20).optional(),
  discordUsername: z.string().max(100).optional().nullable(),
  telegramUsername: z.string().max(100).optional().nullable(),
  matrixId: z.string().max(200).optional().nullable(),
  // Extend expiry
  extendDays: z.number().int().min(1).max(36500).optional(),
});

export const deleteUserSchema = z.object({
  userId: z.string().min(1),
  localId: z.string().optional(),
  remoteUserId: z.string().optional(),
  source: z.string().min(1),
  serverId: z.string().optional(),
});

export const testServerSchema = z.object({
  serverId: z.string().min(1),
});

export const userLoginSchema = z.object({
  username: z.string().min(1).max(50).trim(),
  password: z.string().min(1).max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

export const adminResetPasswordSchema = z.object({
  userId: z.string().min(1),
  localId: z.string().optional(),
  remoteUserId: z.string().optional(),
  newPassword: z.string().min(8).max(128),
  source: z.string().min(1),
  serverId: z.string().optional(),
});

// Webhook CRUD
export const createWebhookSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  url: publicExternalUrl,
  type: z.enum(['discord', 'generic']).default('generic'),
  events: z.array(z.enum(['user.registered', 'user.disabled', 'user.enabled', 'user.deleted', 'user.expired',
    'invite.created', 'invite.used', 'invite.expired', 'invite_request.created', 'invite_request.approved',
    'invite_request.denied', 'announcement.sent', 'admin.login', 'password.reset', '*'])).max(50).default([]),
  enabled: z.boolean().default(true),
  secret: z.string().max(500).optional(),
  template: z.string().max(10000).optional(),
});

export const updateWebhookSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  url: publicExternalUrl.optional(),
  type: z.enum(['discord', 'generic']).optional(),
  events: z.array(z.enum(['user.registered', 'user.disabled', 'user.enabled', 'user.deleted', 'user.expired',
    'invite.created', 'invite.used', 'invite.expired', 'invite_request.created', 'invite_request.approved',
    'invite_request.denied', 'announcement.sent', 'admin.login', 'password.reset', '*'])).max(50).optional(),
  enabled: z.boolean().optional(),
  secret: z.string().max(500).optional().nullable(),
  template: z.string().max(10000).optional().nullable(),
});

// Email templates
export const updateEmailTemplateSchema = z.object({
  eventType: z.string().min(1).max(50),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(10000),
  enabled: z.boolean().optional(),
});

// Invite requests
export const createInviteRequestSchema = z.object({
  email: z.string().email().max(255).trim(),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_-]+$/),
  message: z.string().max(1000).optional(),
});

export const reviewInviteRequestSchema = z.object({
  action: z.enum(['approve', 'deny']),
  reviewNote: z.string().max(500).optional(),
  // Override defaults when approving
  maxUses: z.number().int().min(1).max(10).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
  accessDurationDays: z.number().int().min(0).max(36500).optional(),
});

// Announcements
export const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  body: z.string().min(1).max(10000),
  sentTo: z.string().max(5000).default('all'), // "all" or JSON array of user IDs or labels
  sendVia: z.array(z.enum(['email', 'webhook', 'telegram', 'discord'])).min(1),
});

// Password reset request (self-service)
export const requestPasswordResetSchema = z.object({
  email: z.string().email().max(255).trim(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(200),
  newPassword: z.string().min(1).max(128),
});

// Import users
export const importUsersSchema = z.object({
  serverId: z.string().min(1),
  userIds: z.array(z.string().min(1)).min(1).max(500),
});

export const onboardingContentSchema = z.object({
  content: z.array(z.object({
    type: z.enum(['text', 'features', 'cta', 'image', 'divider', 'apps', 'links']),
    title: z.string().max(200).optional(),
    body: z.string().max(2000).optional(),
    content: z.string().max(2000).optional(),
    items: z.array(z.string().max(200)).optional(),
    buttonText: z.string().max(100).optional(),
    buttonUrl: safeUrl.optional(),
    imageUrl: z.string().max(500).optional(),
    imageCaption: z.string().max(200).optional(),
    caption: z.string().max(200).optional(),
    apps: z.array(z.object({
      name: z.string().max(100),
      description: z.string().max(200).optional(),
      icon: z.string().max(500).optional(),
      url: safeUrl.optional(),
    })).max(20).optional(),
    links: z.array(z.object({
      label: z.string().max(100),
      url: safeUrl,
      description: z.string().max(200).optional(),
    })).max(20).optional(),
  })).max(50),
});

// Server access management
export const grantServerAccessSchema = z.object({
  userId: z.string().min(1),
  serverId: z.string().min(1),
  libraries: z.array(z.string().max(100)).max(100).default([]),
});

export const revokeServerAccessSchema = z.object({
  userId: z.string().min(1),
  serverId: z.string().min(1),
  action: z.enum(['disable', 'delete']).default('delete'),
});

export const recreateUserSchema = z.object({
  userId: z.string().min(1),
  serverId: z.string().min(1),
});

// Admin accounts
export const createAdminSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric or underscore'),
  password: z.string().min(8).max(128),
});

export const updateAdminSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric or underscore').optional(),
  password: z.string().min(8).max(128).optional(),
});

// Backup import
export const importBackupSchema = z.object({
  mode: z.enum(['merge', 'replace']),
  sections: z.array(z.enum(['settings', 'invites', 'users', 'webhooks', 'emailTemplates', 'announcements'])).min(1),
  data: z.record(z.string(), z.unknown()),
});

// ---- Per-row import schemas ---------------------------------------------
// Each of these validates one row coming in from an attacker-supplied backup
// JSON file. Fields are whitelisted so unknown properties are dropped before
// they reach Prisma. Text fields that end up rendered in HTML/Discord/Telegram
// are length-capped; HTML/script sanitisation is applied in the route handler
// via stripHtml on specific fields.
const isoDateString = z
  .string()
  .max(40)
  .refine((v) => !Number.isNaN(Date.parse(v)), 'must be a valid ISO date');

export const importInviteRowSchema = z.object({
  id: z.string().max(50),
  code: z.string().min(1).max(64),
  serverId: z.string().max(50),
  libraries: z.string().max(10000).default('[]'),
  expiresAt: isoDateString.nullable().optional(),
  accessUntil: isoDateString.nullable().optional(),
  accessDurationDays: z.number().int().min(0).max(36500).default(0),
  autoRemove: z.boolean().default(false),
  maxUses: z.number().int().min(0).max(10000).default(1),
  uses: z.number().int().min(0).default(0),
  status: z.string().max(30).default('active'),
  createdAt: isoDateString.optional(),
  createdBy: z.string().max(100).default(''),
  label: z.string().max(100).nullable().optional(),
  passphrase: z.string().max(300).nullable().optional(),
  notifyOnUse: z.boolean().default(false),
  notifyOnExpiry: z.boolean().default(false),
});

export const importUserRowSchema = z.object({
  id: z.string().max(50),
  email: z.string().email().max(255).nullable().optional(),
  username: z.string().min(1).max(50),
  inviteId: z.string().max(50).nullable().optional(),
  serverId: z.string().max(50).nullable().optional(),
  accessUntil: isoDateString.nullable().optional(),
  autoRemove: z.boolean().default(false),
  enableLiveTv: z.boolean().default(true),
  allLibraries: z.boolean().default(true),
  libraries: z.string().max(10000).default('[]'),
  notificationState: z.string().max(10000).default('{}'),
  createdAt: isoDateString.optional(),
  disabled: z.boolean().default(false),
  disabledAt: isoDateString.nullable().optional(),
  disabledReason: z.string().max(500).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  labels: z.string().max(5000).default('[]'),
  discordUsername: z.string().max(100).nullable().optional(),
  discordId: z.string().max(50).nullable().optional(),
  telegramUsername: z.string().max(100).nullable().optional(),
  telegramId: z.string().max(50).nullable().optional(),
  matrixId: z.string().max(200).nullable().optional(),
});

export const importWebhookRowSchema = z.object({
  id: z.string().max(50),
  name: z.string().min(1).max(100),
  url: z.string().url().max(500),
  type: z.string().max(30).default('generic'),
  events: z.string().max(2000).default('[]'),
  enabled: z.boolean().default(true),
  template: z.string().max(10000).nullable().optional(),
  createdAt: isoDateString.optional(),
});

export const importEmailTemplateRowSchema = z.object({
  id: z.string().max(50),
  eventType: z.string().min(1).max(50),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(10000),
  enabled: z.boolean().default(true),
  createdAt: isoDateString.optional(),
  updatedAt: isoDateString.optional(),
});

export const importAnnouncementRowSchema = z.object({
  id: z.string().max(50),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  sentBy: z.string().max(100),
  sentTo: z.string().max(5000).default('all'),
  sentVia: z.string().max(200).default('[]'),
  sentCount: z.number().int().min(0).default(0),
  createdAt: isoDateString.optional(),
});

export const importServerRowSchema = z.object({
  id: z.string().max(50),
  name: z.string().min(1).max(100),
  type: z.enum(['plex', 'jellyfin']),
  url: mediaServerUrl,
  adminUsername: z.string().max(100).nullable().optional(),
  isActive: z.boolean().default(true),
  createdAt: isoDateString.optional(),
});

export const captchaVerifySchema = z.object({
  answer: z.string().min(1).max(20),
});

export const requestActionSchema = z.object({
  requestId: z.number().int().positive(),
  action: z.enum(['approve', 'decline']),
});

export const bulkUsersSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(100),
  localIds: z.array(z.string()).optional(),
  remoteUserIds: z.array(z.string()).optional(),
  serverId: z.string().optional(),
  action: z.enum(['delete', 'apply_profile', 'disable', 'enable']),
  profile: z.object({
    libraries: z.array(z.string().max(100)).max(100).optional(),
    accessDurationDays: z.number().int().min(0).max(36500).optional(),
    autoRemove: z.boolean().optional(),
    enableLiveTv: z.boolean().optional(),
    allLibraries: z.boolean().optional(),
  }).optional(),
});

// --- Validation Helper ---

/**
 * Enforce the configurable password policy stored in Settings.
 * Returns an error message if the policy fails, or null on success.
 * If no settings row exists (e.g. pre-setup), falls back to a hard baseline
 * of 8 chars.
 */
export interface PasswordPolicy {
  passwordMinLength: number | null;
  passwordRequireUppercase: boolean | null;
  passwordRequireNumber: boolean | null;
  passwordRequireSpecial: boolean | null;
}

export function checkPasswordPolicy(
  password: string,
  policy: PasswordPolicy | null | undefined
): string | null {
  const minLen = policy?.passwordMinLength ?? 8;
  if (password.length < minLen) {
    return `Password must be at least ${minLen} characters`;
  }
  if (policy?.passwordRequireUppercase && !/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (policy?.passwordRequireNumber && !/\d/.test(password)) {
    return 'Password must contain at least one number';
  }
  if (policy?.passwordRequireSpecial && !/[^a-zA-Z0-9]/.test(password)) {
    return 'Password must contain at least one special character';
  }
  return null;
}

export function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    response: NextResponse.json(
      {
        message: 'Validation failed',
        errors: result.error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
      { status: 400 }
    ),
  };
}
