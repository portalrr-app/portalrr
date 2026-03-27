-- AlterTable
ALTER TABLE "Admin" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Admin" ADD COLUMN "lockedUntil" DATETIME;
