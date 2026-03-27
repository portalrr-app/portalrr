export interface Server {
  id: string;
  name: string;
  type: 'plex' | 'jellyfin';
  url: string;
  isActive: boolean;
  createdAt: string;
  _count?: { invites: number };
  hasApiKey?: boolean;
  hasToken?: boolean;
  hasAdminCredentials?: boolean;
  apiKeyRedacted?: string;
  tokenRedacted?: string;
  adminUsernameRedacted?: string;
  adminPasswordRedacted?: string;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
}

export interface Settings {
  serverName: string;
  accentColor: string;
  inviteExpiryDays: number;
  maxInvites: number;
  inviteProfiles: string;
  preRegisterTitle: string;
  preRegisterSubtitle: string;
  preRegisterChecklist: string;
  requireInviteAcceptance: boolean;
  captchaEnabled: boolean;
  customCss: string;
  emailEnabled: boolean;
  smtpHost: string;
  smtpPort: number | null;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  hasSmtpPass?: boolean;
  notifyBeforeExpiryDays: number;
  notifyOnExpiry: boolean;
  expiryPolicy: 'delete' | 'disable' | 'disable_then_delete';
  expiryDeleteAfterDays: number;
  referralInvitesEnabled: boolean;
  referralMaxUses: number;
  referralExpiresInDays: number;
  referralAccessDurationDays: number;
  referralAutoRemove: boolean;
  jellyseerrUrl: string;
  jellyseerrApiKey: string;
  hasJellyseerrApiKey?: boolean;
  mediaServerAuth: boolean;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecial: boolean;
  welcomeEmailEnabled: boolean;
  inviteRequestsEnabled: boolean;
  inviteRequestMessage: string;
  inviteRequestServerId: string;
  // Discord bot
  discordBotEnabled: boolean;
  discordBotToken: string;
  discordGuildId: string;
  discordNotifyChannelId: string;
  discordRoleId: string;
  hasDiscordBotToken?: boolean;
  // Telegram bot
  telegramBotEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  hasTelegramBotToken?: boolean;
}

export interface SectionProps {
  settings: Settings;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  styles: Record<string, string>;
}
