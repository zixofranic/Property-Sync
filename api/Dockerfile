# Multi-stage build for production
FROM node:18-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
RUN npm ci --only=production && npm cache clean --force

# Build stage
FROM base AS build
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
RUN npm ci
COPY apps/api ./apps/api
COPY prisma ./prisma
RUN npm run build --workspace=apps/api
RUN npx prisma generate

# Production stage
FROM node:18-alpine AS production
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy dependencies
COPY --from=deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules

# Copy built application
COPY --from=build --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=nestjs:nodejs /app/apps/api/package*.json ./apps/api/
COPY --from=build --chown=nestjs:nodejs /app/prisma ./prisma

# Set user
USER nestjs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

# Start command
CMD ["npm", "run", "start:prod", "--workspace=apps/api"]