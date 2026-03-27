-- CreateTable
CREATE TABLE "Server" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "token" TEXT,
    "apiKey" TEXT,
    "adminUsername" TEXT,
    "adminPassword" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "libraries" TEXT NOT NULL DEFAULT '[]',
    "expiresAt" DATETIME,
    "accessUntil" DATETIME,
    "accessDurationDays" INTEGER NOT NULL DEFAULT 0,
    "autoRemove" BOOLEAN NOT NULL DEFAULT false,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "label" TEXT,
    "passphrase" TEXT,
    "notifyOnUse" BOOLEAN NOT NULL DEFAULT false,
    "notifyOnExpiry" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Invite_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
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
    "telegramUsername" TEXT,
    "matrixId" TEXT,
    CONSTRAINT "User_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "Invite" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
    "serverName" TEXT NOT NULL DEFAULT 'Media Server',
    "accentColor" TEXT NOT NULL DEFAULT '#4FC3F7',
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
    "inviteRequestServerId" TEXT
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'local',
    "serverId" TEXT,
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event" TEXT NOT NULL,
    "actor" TEXT,
    "target" TEXT,
    "details" TEXT NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InviteRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "reviewNote" TEXT,
    "inviteId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'generic',
    "events" TEXT NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "secret" TEXT,
    "template" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentBy" TEXT NOT NULL,
    "sentTo" TEXT NOT NULL DEFAULT 'all',
    "sentVia" TEXT NOT NULL DEFAULT '[]',
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Invite_code_key" ON "Invite"("code");
CREATE INDEX "Invite_serverId_idx" ON "Invite"("serverId");
CREATE INDEX "Invite_status_idx" ON "Invite"("status");
CREATE INDEX "Invite_expiresAt_idx" ON "Invite"("expiresAt");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_serverId_idx" ON "User"("serverId");
CREATE INDEX "User_inviteId_idx" ON "User"("inviteId");
CREATE INDEX "User_accessUntil_idx" ON "User"("accessUntil");
CREATE INDEX "User_disabled_idx" ON "User"("disabled");
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");
CREATE INDEX "AdminSession_adminId_idx" ON "AdminSession"("adminId");
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");
CREATE INDEX "AuditLog_event_idx" ON "AuditLog"("event");
CREATE INDEX "AuditLog_actor_idx" ON "AuditLog"("actor");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");
CREATE INDEX "InviteRequest_status_idx" ON "InviteRequest"("status");
CREATE INDEX "InviteRequest_createdAt_idx" ON "InviteRequest"("createdAt");
CREATE UNIQUE INDEX "EmailTemplate_eventType_key" ON "EmailTemplate"("eventType");
