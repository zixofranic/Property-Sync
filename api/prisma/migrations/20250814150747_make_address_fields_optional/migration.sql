/*
  Warnings:

  - You are about to drop the column `type` on the `feedback` table. All the data in the column will be lost.
  - Added the required column `feedback` to the `feedback` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."feedback" DROP COLUMN "type",
ADD COLUMN     "feedback" "public"."FeedbackType" NOT NULL;

-- AlterTable
ALTER TABLE "public"."properties" ALTER COLUMN "city" DROP NOT NULL,
ALTER COLUMN "state" DROP NOT NULL,
ALTER COLUMN "zipCode" DROP NOT NULL;
