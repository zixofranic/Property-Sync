-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."Plan" AS ENUM ('FREE', 'TIER_1', 'TIER_2', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "public"."FeedbackType" AS ENUM ('love', 'like', 'dislike');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED', 'PENDING', 'TRIAL');

-- CreateEnum
CREATE TYPE "public"."ConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('NEW_MESSAGE', 'PROPERTY_VIEWED', 'PROPERTY_FEEDBACK', 'TIMELINE_SHARED');

-- CreateEnum
CREATE TYPE "public"."UserType" AS ENUM ('AGENT', 'CLIENT');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT,
    "verificationExpiry" TIMESTAMP(3),
    "resetToken" TEXT,
    "resetExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."profiles" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "licenseNumber" TEXT,
    "avatar" TEXT,
    "bio" TEXT,
    "timezone" TEXT,
    "specialties" TEXT,
    "yearsExperience" INTEGER,
    "notifications" JSONB,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "emailTemplateStyle" TEXT DEFAULT 'modern',
    "notificationEmail" BOOLEAN NOT NULL DEFAULT true,
    "notificationDesktop" BOOLEAN NOT NULL DEFAULT true,
    "notificationFeedback" BOOLEAN NOT NULL DEFAULT true,
    "notificationNewProperties" BOOLEAN NOT NULL DEFAULT true,
    "notificationClientViews" BOOLEAN NOT NULL DEFAULT true,
    "notificationClientLogin" BOOLEAN NOT NULL DEFAULT false,
    "notificationEmailOpens" BOOLEAN NOT NULL DEFAULT true,
    "notificationInactiveClients" BOOLEAN NOT NULL DEFAULT false,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "logo" TEXT,
    "companyLogo" TEXT,
    "brandColor" TEXT DEFAULT '#0ea5e9',
    "preferredEmailTemplate" TEXT DEFAULT 'modern',
    "plan" "public"."Plan" NOT NULL DEFAULT 'FREE',
    "subscriptionStatus" "public"."SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "clientLimit" INTEGER NOT NULL DEFAULT 1,
    "propertyLimit" INTEGER NOT NULL DEFAULT 20,
    "stripeCustomerId" TEXT,
    "subscriptionId" TEXT,
    "subscriptionItemId" TEXT,
    "billingCycleStart" TIMESTAMP(3),
    "billingCycleEnd" TIMESTAMP(3),
    "currentMonthProperties" INTEGER NOT NULL DEFAULT 0,
    "lastUsageReset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."clients" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "spouseEmail" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTime" INTEGER NOT NULL DEFAULT 0,
    "feedbackRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "lastActivity" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "agentId" TEXT NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."timelines" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "shareToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "lastViewed" TIMESTAMP(3),
    "viewHistory" JSONB,
    "initialEmailSent" BOOLEAN NOT NULL DEFAULT false,
    "lastEmailSent" TIMESTAMP(3),
    "lastEmailPropertyCount" INTEGER NOT NULL DEFAULT 0,
    "agentToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "agentId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "timelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."properties" (
    "id" TEXT NOT NULL,
    "mlsId" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "price" INTEGER NOT NULL,
    "bedrooms" INTEGER,
    "bathrooms" DOUBLE PRECISION,
    "squareFootage" INTEGER,
    "propertyType" TEXT,
    "description" TEXT,
    "imageUrls" TEXT NOT NULL DEFAULT '',
    "listingUrl" TEXT,
    "mlsSource" TEXT,
    "originalMlsUrl" TEXT,
    "parsedData" JSONB,
    "parseTimestamp" TIMESTAMP(3),
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "parseErrors" TEXT NOT NULL DEFAULT '',
    "addressNormalized" TEXT,
    "priceRange" TEXT,
    "batchId" TEXT,
    "importStatus" TEXT NOT NULL DEFAULT 'completed',
    "isQuickParsed" BOOLEAN NOT NULL DEFAULT false,
    "isFullyParsed" BOOLEAN NOT NULL DEFAULT true,
    "loadingProgress" INTEGER NOT NULL DEFAULT 100,
    "agentNotes" TEXT,
    "isHighlighted" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isViewed" BOOLEAN NOT NULL DEFAULT false,
    "viewedAt" TIMESTAMP(3),
    "isQueued" BOOLEAN NOT NULL DEFAULT false,
    "queuedForEmail" BOOLEAN NOT NULL DEFAULT false,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "timelineId" TEXT NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."feedback" (
    "id" TEXT NOT NULL,
    "feedback" "public"."FeedbackType" NOT NULL,
    "notes" TEXT,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "responseTime" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "propertyId" TEXT NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."usage_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."track_events" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "track_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "textContent" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "planAccess" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."client_auth" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "phoneLastFour" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "lastAccess" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_auth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."client_analytics" (
    "id" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "propertyId" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_analytics_pkey" PRIMARY KEY ("id")
);

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
    "quickData" JSONB,
    "parseError" TEXT,
    "propertyId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "loadingProgress" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mls_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mlsName" TEXT NOT NULL,
    "mlsRegion" TEXT NOT NULL,
    "sparkUserId" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastSync" TIMESTAMP(3),
    "syncStatus" TEXT NOT NULL DEFAULT 'never',
    "syncError" TEXT,
    "connectionData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mls_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."conversations" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "propertyId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agentUnreadCount" INTEGER NOT NULL DEFAULT 0,
    "clientUnreadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."property_conversations" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "public"."ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "unreadAgentCount" INTEGER NOT NULL DEFAULT 0,
    "unreadClientCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messages_v2" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderType" "public"."UserType" NOT NULL,
    "content" TEXT NOT NULL,
    "type" "public"."MessageType" NOT NULL DEFAULT 'TEXT',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications_v2" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_v2_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_verificationToken_key" ON "public"."users"("verificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "users_resetToken_key" ON "public"."users"("resetToken");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "public"."profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "timelines_shareToken_key" ON "public"."timelines"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "timelines_agentToken_key" ON "public"."timelines"("agentToken");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_propertyId_clientId_key" ON "public"."feedback"("propertyId", "clientId");

-- CreateIndex
CREATE INDEX "track_events_clientId_eventType_idx" ON "public"."track_events"("clientId", "eventType");

-- CreateIndex
CREATE INDEX "track_events_timestamp_idx" ON "public"."track_events"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "client_auth_sessionToken_key" ON "public"."client_auth"("sessionToken");

-- CreateIndex
CREATE INDEX "client_auth_sessionToken_idx" ON "public"."client_auth"("sessionToken");

-- CreateIndex
CREATE INDEX "client_auth_timelineId_idx" ON "public"."client_auth"("timelineId");

-- CreateIndex
CREATE INDEX "client_analytics_timelineId_eventType_idx" ON "public"."client_analytics"("timelineId", "eventType");

-- CreateIndex
CREATE INDEX "client_analytics_timestamp_idx" ON "public"."client_analytics"("timestamp");

-- CreateIndex
CREATE INDEX "property_batches_agentId_status_idx" ON "public"."property_batches"("agentId", "status");

-- CreateIndex
CREATE INDEX "property_batches_timelineId_idx" ON "public"."property_batches"("timelineId");

-- CreateIndex
CREATE UNIQUE INDEX "batch_properties_propertyId_key" ON "public"."batch_properties"("propertyId");

-- CreateIndex
CREATE INDEX "batch_properties_batchId_position_idx" ON "public"."batch_properties"("batchId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "mls_connections_userId_key" ON "public"."mls_connections"("userId");

-- CreateIndex
CREATE INDEX "mls_connections_userId_isActive_idx" ON "public"."mls_connections"("userId", "isActive");

-- CreateIndex
CREATE INDEX "conversations_agentId_idx" ON "public"."conversations"("agentId");

-- CreateIndex
CREATE INDEX "conversations_clientId_idx" ON "public"."conversations"("clientId");

-- CreateIndex
CREATE INDEX "conversations_timelineId_idx" ON "public"."conversations"("timelineId");

-- CreateIndex
CREATE INDEX "conversations_propertyId_idx" ON "public"."conversations"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_agentId_clientId_timelineId_propertyId_key" ON "public"."conversations"("agentId", "clientId", "timelineId", "propertyId");

-- CreateIndex
CREATE INDEX "messages_conversationId_idx" ON "public"."messages"("conversationId");

-- CreateIndex
CREATE INDEX "messages_senderId_idx" ON "public"."messages"("senderId");

-- CreateIndex
CREATE INDEX "messages_createdAt_idx" ON "public"."messages"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "property_conversations_propertyId_key" ON "public"."property_conversations"("propertyId");

-- CreateIndex
CREATE INDEX "property_conversations_agentId_status_idx" ON "public"."property_conversations"("agentId", "status");

-- CreateIndex
CREATE INDEX "property_conversations_clientId_status_idx" ON "public"."property_conversations"("clientId", "status");

-- CreateIndex
CREATE INDEX "property_conversations_timelineId_idx" ON "public"."property_conversations"("timelineId");

-- CreateIndex
CREATE INDEX "messages_v2_conversationId_createdAt_idx" ON "public"."messages_v2"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "messages_v2_senderId_idx" ON "public"."messages_v2"("senderId");

-- CreateIndex
CREATE INDEX "messages_v2_conversationId_senderType_isRead_idx" ON "public"."messages_v2"("conversationId", "senderType", "isRead");

-- CreateIndex
CREATE INDEX "notifications_v2_recipientId_isRead_idx" ON "public"."notifications_v2"("recipientId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_v2_conversationId_idx" ON "public"."notifications_v2"("conversationId");

-- AddForeignKey
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."clients" ADD CONSTRAINT "clients_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."timelines" ADD CONSTRAINT "timelines_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."timelines" ADD CONSTRAINT "timelines_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."properties" ADD CONSTRAINT "properties_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "public"."timelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feedback" ADD CONSTRAINT "feedback_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feedback" ADD CONSTRAINT "feedback_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."client_auth" ADD CONSTRAINT "client_auth_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "public"."timelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."client_analytics" ADD CONSTRAINT "client_analytics_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "public"."timelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "public"."mls_connections" ADD CONSTRAINT "mls_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conversations" ADD CONSTRAINT "conversations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conversations" ADD CONSTRAINT "conversations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conversations" ADD CONSTRAINT "conversations_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "public"."timelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conversations" ADD CONSTRAINT "conversations_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_conversations" ADD CONSTRAINT "property_conversations_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "public"."properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_conversations" ADD CONSTRAINT "property_conversations_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "public"."timelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_conversations" ADD CONSTRAINT "property_conversations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_conversations" ADD CONSTRAINT "property_conversations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages_v2" ADD CONSTRAINT "messages_v2_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."property_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications_v2" ADD CONSTRAINT "notifications_v2_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."property_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

