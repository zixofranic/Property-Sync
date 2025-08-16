-- AlterTable
ALTER TABLE "public"."profiles" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "notifications" JSONB,
ADD COLUMN     "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "specialties" TEXT[],
ADD COLUMN     "timezone" TEXT,
ADD COLUMN     "yearsExperience" INTEGER;
