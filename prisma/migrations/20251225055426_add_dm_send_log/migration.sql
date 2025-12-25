-- CreateTable
CREATE TABLE "DmSendLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "discordUserId" TEXT NOT NULL,
    "sendType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    CONSTRAINT "DmSendLog_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "User" ("discordUserId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DmSendLog_discordUserId_idx" ON "DmSendLog"("discordUserId");

-- CreateIndex
CREATE INDEX "DmSendLog_status_idx" ON "DmSendLog"("status");
