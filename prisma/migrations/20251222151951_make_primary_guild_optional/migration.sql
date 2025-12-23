-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AttendanceLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "discordUserId" TEXT NOT NULL,
    "primaryGuildId" TEXT,
    "attribute" TEXT NOT NULL,
    "checkInDate" TEXT NOT NULL,
    "checkInTimestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceLog_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "User" ("discordUserId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttendanceLog_primaryGuildId_fkey" FOREIGN KEY ("primaryGuildId") REFERENCES "Guild" ("guildId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AttendanceLog" ("attribute", "checkInDate", "checkInTimestamp", "discordUserId", "id", "primaryGuildId") SELECT "attribute", "checkInDate", "checkInTimestamp", "discordUserId", "id", "primaryGuildId" FROM "AttendanceLog";
DROP TABLE "AttendanceLog";
ALTER TABLE "new_AttendanceLog" RENAME TO "AttendanceLog";
CREATE UNIQUE INDEX "AttendanceLog_discordUserId_checkInDate_key" ON "AttendanceLog"("discordUserId", "checkInDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
