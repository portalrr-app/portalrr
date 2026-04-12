-- AlterTable: Add Discord/Telegram IDs to User
ALTER TABLE "User" ADD COLUMN "discordId" TEXT;
ALTER TABLE "User" ADD COLUMN "telegramId" TEXT;

-- AlterTable: Add Discord bot settings
ALTER TABLE "Settings" ADD COLUMN "discordBotToken" TEXT;
ALTER TABLE "Settings" ADD COLUMN "discordGuildId" TEXT;
ALTER TABLE "Settings" ADD COLUMN "discordNotifyChannelId" TEXT;
ALTER TABLE "Settings" ADD COLUMN "discordRoleId" TEXT;
ALTER TABLE "Settings" ADD COLUMN "discordBotEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add Telegram bot settings
ALTER TABLE "Settings" ADD COLUMN "telegramBotToken" TEXT;
ALTER TABLE "Settings" ADD COLUMN "telegramChatId" TEXT;
ALTER TABLE "Settings" ADD COLUMN "telegramBotEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "UserServer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "remoteUserId" TEXT,
    "libraries" TEXT NOT NULL DEFAULT '[]',
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserServer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserServer_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserServer_userId_serverId_key" ON "UserServer"("userId", "serverId");
CREATE INDEX "UserServer_userId_idx" ON "UserServer"("userId");
CREATE INDEX "UserServer_serverId_idx" ON "UserServer"("serverId");
