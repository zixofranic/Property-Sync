-- AlterTable
ALTER TABLE "public"."batch_properties" ADD COLUMN     "loadingProgress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quickData" JSONB;

-- AlterTable
ALTER TABLE "public"."properties" ADD COLUMN     "isFullyParsed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isQuickParsed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loadingProgress" INTEGER NOT NULL DEFAULT 100;
