#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const envDir = path.join(__dirname, '..');
const schemaFile = path.join(envDir, 'prisma', 'schema.prisma');

function prepareSchema() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  console.log(`🔧 Preparing database schema for: ${nodeEnv}`);
  
  let sourceSchema;
  if (nodeEnv === 'production') {
    sourceSchema = path.join(envDir, 'prisma', 'schema.production.prisma');
    console.log('📊 Using PostgreSQL schema for production');
  } else {
    sourceSchema = path.join(envDir, 'prisma', 'schema.dev.prisma');
    console.log('🗄️  Using SQLite schema for development');
  }
  
  if (!fs.existsSync(sourceSchema)) {
    console.error(`❌ Schema file not found: ${sourceSchema}`);
    process.exit(1);
  }
  
  try {
    const content = fs.readFileSync(sourceSchema, 'utf8');
    fs.writeFileSync(schemaFile, content);
    console.log(`✅ Schema prepared successfully`);
    console.log(`📁 Active schema: ${path.basename(sourceSchema)}`);
  } catch (error) {
    console.error(`❌ Error preparing schema:`, error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  prepareSchema();
}

module.exports = prepareSchema;