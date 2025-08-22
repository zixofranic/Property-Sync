-- AlterTable
ALTER TABLE "public"."profiles" ADD COLUMN     "notificationDesktop" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notificationEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notificationFeedback" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notificationNewProperties" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "preferredEmailTemplate" TEXT DEFAULT 'modern',
ADD COLUMN     "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'dark';

-- AlterTable
ALTER TABLE "public"."properties" ADD COLUMN     "addressNormalized" TEXT,
ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "imageCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "importStatus" TEXT NOT NULL DEFAULT 'completed',
ADD COLUMN     "mlsSource" TEXT,
ADD COLUMN     "originalMlsUrl" TEXT,
ADD COLUMN     "parseErrors" TEXT[],
ADD COLUMN     "parseTimestamp" TIMESTAMP(3),
ADD COLUMN     "parsedData" JSONB,
ADD COLUMN     "priceRange" TEXT;

-- CreateTable
CREATE TABLE "public"."property_batches" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalProperties" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."batch_properties" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "mlsUrl" TEXT NOT NULL,
    "parseStatus" TEXT NOT NULL DEFAULT 'pending',
    "parsedData" JSONB,
    "parseError" TEXT,
    "propertyId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_properties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "property_batches_agentId_status_idx" ON "public"."property_batches"("agentId", "status");

-- CreateIndex
CREATE INDEX "property_batches_timelineId_idx" ON "public"."property_batches"("timelineId");

-- CreateIndex
CREATE UNIQUE INDEX "batch_properties_propertyId_key" ON "public"."batch_properties"("propertyId");

-- CreateIndex
CREATE INDEX "batch_properties_batchId_position_idx" ON "public"."batch_properties"("batchId", "position");

-- AddForeignKey
ALTER TABLE "public"."property_batches" ADD CONSTRAINT "property_batches_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_batches" ADD CONSTRAINT "property_batches_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_batches" ADD CONSTRAINT "property_batches_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "public"."timelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."batch_properties" ADD CONSTRAINT "batch_properties_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."property_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."batch_properties" ADD CONSTRAINT "batch_properties_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
