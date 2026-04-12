-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
    "serverName" TEXT NOT NULL DEFAULT 'Media Server',
    "accentColor" TEXT NOT NULL DEFAULT '#A78BFA',
    "themeVersion" INTEGER NOT NULL DEFAULT 1,
    "onboardingContent" TEXT NOT NULL DEFAULT '[]',
    "inviteProfiles" TEXT NOT NULL DEFAULT '[]',
    "preRegisterTitle" TEXT NOT NULL DEFAULT 'Before You Start',
    "preRegisterSubtitle" TEXT NOT NULL DEFAULT 'Review the server rules and expectations before creating your account.',
    "preRegisterChecklist" TEXT NOT NULL DEFAULT '[]',
    "requireInviteAcceptance" BOOLEAN NOT NULL DEFAULT false,
    "captchaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "customCss" TEXT,
    "inviteExpiryDays" INTEGER NOT NULL DEFAULT 7,
    "maxInvites" INTEGER NOT NULL DEFAULT 100,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "smtpFrom" TEXT,
    "notifyBeforeExpiryDays" INTEGER NOT NULL DEFAULT 3,
    "notifyOnExpiry" BOOLEAN NOT NULL DEFAULT false,
    "expiryPolicy" TEXT NOT NULL DEFAULT 'delete',
    "expiryDeleteAfterDays" INTEGER NOT NULL DEFAULT 7,
    "referralInvitesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "referralMaxUses" INTEGER NOT NULL DEFAULT 1,
    "referralExpiresInDays" INTEGER NOT NULL DEFAULT 7,
    "referralAccessDurationDays" INTEGER NOT NULL DEFAULT 0,
    "referralAutoRemove" BOOLEAN NOT NULL DEFAULT false,
    "appName" TEXT NOT NULL DEFAULT 'Portalrr',
    "logoUrl" TEXT,
    "logoMode" TEXT NOT NULL DEFAULT 'icon',
    "subtitleText" TEXT NOT NULL DEFAULT 'Enter your invite code to join the server',
    "backgroundStyle" TEXT NOT NULL DEFAULT 'gradient',
    "backgroundImageUrl" TEXT,
    "backgroundOverlay" REAL NOT NULL DEFAULT 0.7,
    "cardStyle" TEXT NOT NULL DEFAULT 'bordered',
    "borderRadius" TEXT NOT NULL DEFAULT 'large',
    "cardWidth" TEXT NOT NULL DEFAULT 'default',
    "fontFamily" TEXT NOT NULL DEFAULT 'dm-sans',
    "fontDisplay" TEXT NOT NULL DEFAULT 'same',
    "buttonStyle" TEXT NOT NULL DEFAULT 'rounded',
    "inputStyle" TEXT NOT NULL DEFAULT 'outlined',
    "enableAnimations" BOOLEAN NOT NULL DEFAULT true,
    "enableNoise" BOOLEAN NOT NULL DEFAULT true,
    "gradientDirection" TEXT NOT NULL DEFAULT 'top',
    "welcomeTitle" TEXT NOT NULL DEFAULT 'Welcome',
    "registerTitle" TEXT NOT NULL DEFAULT 'Create Your Account',
    "footerText" TEXT,
    "hideAdminLink" BOOLEAN NOT NULL DEFAULT false,
    "buttonText" TEXT NOT NULL DEFAULT 'Continue',
    "registerButtonText" TEXT NOT NULL DEFAULT 'Create Account',
    "mediaServerAuth" BOOLEAN NOT NULL DEFAULT false,
    "jellyseerrUrl" TEXT,
    "jellyseerrApiKey" TEXT,
    "onboardingTitle" TEXT NOT NULL DEFAULT 'Welcome Aboard',
    "onboardingSubtitle" TEXT NOT NULL DEFAULT 'Your account has been created. Here''s everything you need to know to get started.',
    "onboardingButtonText" TEXT NOT NULL DEFAULT 'Start Watching',
    "onboardingButtonUrl" TEXT NOT NULL DEFAULT '/',
    "passwordMinLength" INTEGER NOT NULL DEFAULT 8,
    "passwordRequireUppercase" BOOLEAN NOT NULL DEFAULT false,
    "passwordRequireNumber" BOOLEAN NOT NULL DEFAULT false,
    "passwordRequireSpecial" BOOLEAN NOT NULL DEFAULT false,
    "welcomeEmailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "inviteRequestsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "inviteRequestMessage" TEXT NOT NULL DEFAULT 'Request access to join our media server',
    "inviteRequestServerId" TEXT,
    "discordBotToken" TEXT,
    "discordGuildId" TEXT,
    "discordNotifyChannelId" TEXT,
    "discordRoleId" TEXT,
    "discordBotEnabled" BOOLEAN NOT NULL DEFAULT false,
    "telegramBotToken" TEXT,
    "telegramChatId" TEXT,
    "telegramBotEnabled" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Settings" ("accentColor", "appName", "backgroundImageUrl", "backgroundOverlay", "backgroundStyle", "borderRadius", "buttonStyle", "buttonText", "captchaEnabled", "cardStyle", "cardWidth", "customCss", "discordBotEnabled", "discordBotToken", "discordGuildId", "discordNotifyChannelId", "discordRoleId", "emailEnabled", "enableAnimations", "enableNoise", "expiryDeleteAfterDays", "expiryPolicy", "fontDisplay", "fontFamily", "footerText", "gradientDirection", "hideAdminLink", "id", "inputStyle", "inviteExpiryDays", "inviteProfiles", "inviteRequestMessage", "inviteRequestServerId", "inviteRequestsEnabled", "jellyseerrApiKey", "jellyseerrUrl", "logoMode", "logoUrl", "maxInvites", "mediaServerAuth", "notifyBeforeExpiryDays", "notifyOnExpiry", "onboardingButtonText", "onboardingButtonUrl", "onboardingContent", "onboardingSubtitle", "onboardingTitle", "passwordMinLength", "passwordRequireNumber", "passwordRequireSpecial", "passwordRequireUppercase", "preRegisterChecklist", "preRegisterSubtitle", "preRegisterTitle", "referralAccessDurationDays", "referralAutoRemove", "referralExpiresInDays", "referralInvitesEnabled", "referralMaxUses", "registerButtonText", "registerTitle", "requireInviteAcceptance", "serverName", "smtpFrom", "smtpHost", "smtpPass", "smtpPort", "smtpUser", "subtitleText", "telegramBotEnabled", "telegramBotToken", "telegramChatId", "themeVersion", "welcomeEmailEnabled", "welcomeTitle") SELECT "accentColor", "appName", "backgroundImageUrl", "backgroundOverlay", "backgroundStyle", "borderRadius", "buttonStyle", "buttonText", "captchaEnabled", "cardStyle", "cardWidth", "customCss", "discordBotEnabled", "discordBotToken", "discordGuildId", "discordNotifyChannelId", "discordRoleId", "emailEnabled", "enableAnimations", "enableNoise", "expiryDeleteAfterDays", "expiryPolicy", "fontDisplay", "fontFamily", "footerText", "gradientDirection", "hideAdminLink", "id", "inputStyle", "inviteExpiryDays", "inviteProfiles", "inviteRequestMessage", "inviteRequestServerId", "inviteRequestsEnabled", "jellyseerrApiKey", "jellyseerrUrl", "logoMode", "logoUrl", "maxInvites", "mediaServerAuth", "notifyBeforeExpiryDays", "notifyOnExpiry", "onboardingButtonText", "onboardingButtonUrl", "onboardingContent", "onboardingSubtitle", "onboardingTitle", "passwordMinLength", "passwordRequireNumber", "passwordRequireSpecial", "passwordRequireUppercase", "preRegisterChecklist", "preRegisterSubtitle", "preRegisterTitle", "referralAccessDurationDays", "referralAutoRemove", "referralExpiresInDays", "referralInvitesEnabled", "referralMaxUses", "registerButtonText", "registerTitle", "requireInviteAcceptance", "serverName", "smtpFrom", "smtpHost", "smtpPass", "smtpPort", "smtpUser", "subtitleText", "telegramBotEnabled", "telegramBotToken", "telegramChatId", "themeVersion", "welcomeEmailEnabled", "welcomeTitle" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "inviteId" TEXT,
    "serverId" TEXT,
    "accessUntil" DATETIME,
    "autoRemove" BOOLEAN NOT NULL DEFAULT false,
    "enableLiveTv" BOOLEAN NOT NULL DEFAULT true,
    "allLibraries" BOOLEAN NOT NULL DEFAULT true,
    "libraries" TEXT NOT NULL DEFAULT '[]',
    "notificationState" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "disabledAt" DATETIME,
    "disabledReason" TEXT,
    "notes" TEXT,
    "labels" TEXT NOT NULL DEFAULT '[]',
    "discordUsername" TEXT,
    "discordId" TEXT,
    "telegramUsername" TEXT,
    "telegramId" TEXT,
    "matrixId" TEXT,
    CONSTRAINT "User_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "Invite" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("accessUntil", "allLibraries", "autoRemove", "createdAt", "disabled", "disabledAt", "disabledReason", "discordId", "discordUsername", "email", "enableLiveTv", "id", "inviteId", "labels", "libraries", "matrixId", "notes", "notificationState", "passwordHash", "serverId", "telegramId", "telegramUsername", "username") SELECT "accessUntil", "allLibraries", "autoRemove", "createdAt", "disabled", "disabledAt", "disabledReason", "discordId", "discordUsername", "email", "enableLiveTv", "id", "inviteId", "labels", "libraries", "matrixId", "notes", "notificationState", "passwordHash", "serverId", "telegramId", "telegramUsername", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_serverId_idx" ON "User"("serverId");
CREATE INDEX "User_inviteId_idx" ON "User"("inviteId");
CREATE INDEX "User_accessUntil_idx" ON "User"("accessUntil");
CREATE INDEX "User_disabled_idx" ON "User"("disabled");
-- Clean up placeholder emails so users are prompted to set a real one
UPDATE "User" SET "email" = NULL WHERE "email" LIKE '%@mediaserver.local' OR "email" LIKE '%@imported.local';
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
