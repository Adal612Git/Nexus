/*
  Warnings:

  - You are about to drop the column `endsAt` on the `CalendarEvent` table. All the data in the column will be lost.
  - You are about to drop the column `startsAt` on the `CalendarEvent` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `CalendarEvent` table. All the data in the column will be lost.
  - Added the required column `endUtc` to the `CalendarEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startUtc` to the `CalendarEvent` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CalendarEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "provider" TEXT,
    "externalId" TEXT,
    "startUtc" DATETIME NOT NULL,
    "endUtc" DATETIME NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'Synced',
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CalendarEvent_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CalendarEvent" ("cardId", "createdAt", "id", "provider", "updatedAt") SELECT "cardId", "createdAt", "id", "provider", "updatedAt" FROM "CalendarEvent";
DROP TABLE "CalendarEvent";
ALTER TABLE "new_CalendarEvent" RENAME TO "CalendarEvent";
CREATE UNIQUE INDEX "CalendarEvent_cardId_key" ON "CalendarEvent"("cardId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
