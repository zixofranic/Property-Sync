# Deployment Guide - Environment Automatic Configuration

## 🚀 Automatic Database Selection

The application now automatically selects the correct database and schema based on the environment:

### **Local Development** 
- **Database**: SQLite (`api/dev.db`)
- **Schema**: `prisma/schema.dev.prisma`
- **Environment**: `NODE_ENV=development`
- **Trigger**: Running `npm run start:dev`

### **Production (Railway/Vercel)**
- **Database**: PostgreSQL (Neon via Railway)
- **Schema**: `prisma/schema.production.prisma`  
- **Environment**: `NODE_ENV=production`
- **Trigger**: Deployment automatically sets `NODE_ENV=production`

## 🔄 How It Works

1. **Pre-start Hook**: Before any start command, `scripts/prepare-schema.js` runs
2. **Environment Detection**: Checks `NODE_ENV` environment variable
3. **Schema Selection**: Copies the appropriate schema to `prisma/schema.prisma`
4. **Database Connection**: Uses the DATABASE_URL for the environment

## 📋 Environment Variables Required

### **Railway (API Backend)**
```bash
NODE_ENV=production
DATABASE_URL=<your-neon-postgresql-url>
JWT_SECRET=<production-jwt-secret>
RESEND_API_KEY=<your-resend-key>
# ... other production environment variables
```

### **Vercel (Frontend)**
```bash
NODE_ENV=production
NEXT_PUBLIC_API_URL=<your-railway-api-url>
```

## 🛠️ Local Development Commands

```bash
# Development with SQLite
npm run start:dev

# Switch to production database (use carefully!)
NODE_ENV=production npm run start:dev
```

## 🚢 Deployment Process

### **Railway (API)**
1. Push to main branch
2. Railway automatically sets `NODE_ENV=production`
3. Build process runs `prebuild` hook → selects PostgreSQL schema
4. Application starts with production database

### **Vercel (Frontend)**
1. Push to main branch  
2. Vercel automatically sets `NODE_ENV=production`
3. Frontend connects to Railway API URL

## ⚡ Key Benefits

- **Zero Manual Configuration**: No need to manually switch environments
- **Safe Development**: Local SQLite prevents production data corruption
- **Automatic Schema**: Right database schema for each environment
- **Environment Isolation**: Complete separation of dev/prod data
- **Deploy Confidence**: No risk of deploying with wrong database

## 🔍 Troubleshooting

### If build fails with schema errors:
```bash
# Manually prepare schema
cd api
NODE_ENV=production node scripts/prepare-schema.js
npm run build
```

### If wrong database is selected:
```bash
# Check environment variable
echo $NODE_ENV

# Force schema preparation
rm prisma/schema.prisma
node scripts/prepare-schema.js
```

## 📊 Database Schema Differences

| Feature | Development (SQLite) | Production (PostgreSQL) |
|---------|---------------------|-------------------------|
| Arrays | JSON strings | Native arrays |
| Enums | Supported | Supported |
| Performance | Fast for dev | Optimized for production |
| Constraints | Basic | Advanced |

This setup ensures your production data is always safe while giving you a fast, isolated development environment!