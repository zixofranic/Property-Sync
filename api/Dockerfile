# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Install necessary packages for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to skip installing Chromium. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy application code (including updated schema)
COPY . .

# Debug: Check if schema file exists and show content
RUN ls -la prisma/ && head -20 prisma/schema.prisma

# Ensure we're using the correct schema with V2 messaging models
RUN echo "Verifying schema contains V2 models..." && grep -c "PropertyConversation\|MessageV2" prisma/schema.prisma

# Generate Prisma client with debug info (explicitly use schema.prisma)
RUN npx prisma generate --schema=./prisma/schema.prisma

# Verify client was generated with V2 models
RUN ls -la node_modules/.prisma/client/ && echo "Checking for V2 models in generated client..." && grep -c "propertyConversation\|messageV2" node_modules/.prisma/client/index.d.ts

# Build the application
RUN npm run build

# Remove devDependencies after build
RUN npm prune --production

# Expose port
EXPOSE 3001

# Start the application
CMD ["npm", "run", "start:prod"]