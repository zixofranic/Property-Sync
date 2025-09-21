#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const envDir = path.join(__dirname, '..');
const envFile = path.join(envDir, '.env');

function copyFile(source, destination) {
  try {
    const content = fs.readFileSync(source, 'utf8');
    fs.writeFileSync(destination, content);
    return true;
  } catch (error) {
    console.error(`Error copying ${source} to ${destination}:`, error.message);
    return false;
  }
}

function switchEnvironment(env) {
  const sourceFile = path.join(envDir, `.env.${env}`);
  const schemaFile = path.join(envDir, 'prisma', 'schema.prisma');
  const sourceSchemaFile = path.join(envDir, 'prisma', `schema.${env}.prisma`);
  
  if (!fs.existsSync(sourceFile)) {
    console.error(`❌ Environment file .env.${env} does not exist!`);
    return;
  }

  // Backup current .env if it exists
  if (fs.existsSync(envFile)) {
    const backupFile = path.join(envDir, `.env.backup.${Date.now()}`);
    copyFile(envFile, backupFile);
    console.log(`📋 Backed up current .env to ${path.basename(backupFile)}`);
  }

  // Copy the new environment file
  if (copyFile(sourceFile, envFile)) {
    console.log(`✅ Switched to ${env} environment`);
    console.log(`📁 Using: .env.${env}`);
    
    // Switch schema if available
    if (fs.existsSync(sourceSchemaFile)) {
      if (fs.existsSync(schemaFile)) {
        const schemaBackup = path.join(envDir, 'prisma', `schema.backup.${Date.now()}.prisma`);
        copyFile(schemaFile, schemaBackup);
        console.log(`📋 Backed up schema.prisma to ${path.basename(schemaBackup)}`);
      }
      
      if (copyFile(sourceSchemaFile, schemaFile)) {
        console.log(`🔄 Switched to ${env} schema`);
      }
    }
    
    // Show database info
    const content = fs.readFileSync(envFile, 'utf8');
    const dbUrl = content.match(/DATABASE_URL="([^"]+)"/)?.[1];
    if (dbUrl) {
      if (dbUrl.startsWith('file:')) {
        console.log(`🗄️  Database: Local SQLite (${dbUrl})`);
      } else if (dbUrl.includes('neon.tech') || dbUrl.includes('railway')) {
        console.log(`🌐 Database: Remote PostgreSQL`);
      }
    }
  }
}

const env = process.argv[2];

if (!env || !['development', 'production'].includes(env)) {
  console.log('🔄 Database Environment Switcher');
  console.log('');
  console.log('Usage: npm run switch-env <environment>');
  console.log('');
  console.log('Available environments:');
  console.log('  development  - Local SQLite database (safe for testing)');
  console.log('  production   - Remote PostgreSQL database (live data)');
  console.log('');
  console.log('Examples:');
  console.log('  npm run switch-env development');
  console.log('  npm run switch-env production');
  process.exit(1);
}

switchEnvironment(env);