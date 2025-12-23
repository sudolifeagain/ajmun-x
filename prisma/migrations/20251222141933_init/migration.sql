-- CreateTable
CREATE TABLE "User" (
    "discordUserId" TEXT NOT NULL PRIMARY KEY,
    "qrToken" TEXT NOT NULL,
    "globalName" TEXT,
    "defaultAvatarUrl" TEXT,
    "primaryAttribute" TEXT NOT NULL DEFAULT 'participant',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Guild" (
    "guildId" TEXT NOT NULL PRIMARY KEY,
    "guildName" TEXT NOT NULL,
    "guildIconUrl" TEXT,
    "defaultColor" TEXT NOT NULL DEFAULT '#3B82F6',
    "isOperationServer" BOOLEAN NOT NULL DEFAULT false,
    "isTargetGuild" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserGuildMembership" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "discordUserId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "nickname" TEXT,
    "avatarUrl" TEXT,
    "roleIds" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserGuildMembership_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "User" ("discordUserId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserGuildMembership_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("guildId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AttendanceLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "discordUserId" TEXT NOT NULL,
    "primaryGuildId" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "checkInDate" TEXT NOT NULL,
    "checkInTimestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceLog_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "User" ("discordUserId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttendanceLog_primaryGuildId_fkey" FOREIGN KEY ("primaryGuildId") REFERENCES "Guild" ("guildId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT ''
);

-- CreateIndex
CREATE UNIQUE INDEX "User_qrToken_key" ON "User"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "UserGuildMembership_discordUserId_guildId_key" ON "UserGuildMembership"("discordUserId", "guildId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceLog_discordUserId_checkInDate_key" ON "AttendanceLog"("discordUserId", "checkInDate");
