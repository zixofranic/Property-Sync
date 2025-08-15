/*
  Warnings:

  - The values [LOVE_IT,LIKE_IT,DISLIKE_IT] on the enum `FeedbackType` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[propertyId,clientId]` on the table `feedback` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `clientId` to the `feedback` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."FeedbackType_new" AS ENUM ('love', 'like', 'dislike');
ALTER TABLE "public"."feedback" ALTER COLUMN "type" TYPE "public"."FeedbackType_new" USING ("type"::text::"public"."FeedbackType_new");
ALTER TYPE "public"."FeedbackType" RENAME TO "FeedbackType_old";
ALTER TYPE "public"."FeedbackType_new" RENAME TO "FeedbackType";
DROP TYPE "public"."FeedbackType_old";
COMMIT;

-- AlterTable
ALTER TABLE "public"."clients" ADD COLUMN     "spouseEmail" TEXT;

-- AlterTable
ALTER TABLE "public"."feedback" ADD COLUMN     "clientId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "public"."track_events" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "track_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "track_events_clientId_eventType_idx" ON "public"."track_events"("clientId", "eventType");

-- CreateIndex
CREATE INDEX "track_events_timestamp_idx" ON "public"."track_events"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_propertyId_clientId_key" ON "public"."feedback"("propertyId", "clientId");

-- AddForeignKey
ALTER TABLE "public"."feedback" ADD CONSTRAINT "feedback_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
