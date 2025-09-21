#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function generateDevSchema() {
  const apiDir = path.join(__dirname, '..');
  const masterSchemaPath = path.join(apiDir, 'prisma', 'schema.master.prisma');
  const devSchemaPath = path.join(apiDir, 'prisma', 'schema.dev.prisma');
  
  console.log('🔄 Generating SQLite development schema from master...');
  
  if (!fs.existsSync(masterSchemaPath)) {
    console.error('❌ Master schema not found:', masterSchemaPath);
    process.exit(1);
  }
  
  let content = fs.readFileSync(masterSchemaPath, 'utf8');
  
  // Convert PostgreSQL to SQLite
  content = content.replace(/provider = "postgresql"/, 'provider = "sqlite"');
  
  // Convert arrays to JSON strings for SQLite compatibility
  content = content.replace(/specialties\s+String\[\]/g, 'specialties String? // JSON string for SQLite compatibility');
  content = content.replace(/imageUrls\s+String\[\]/g, 'imageUrls String? // JSON array as string');
  content = content.replace(/parseErrors\s+String\[\]/g, 'parseErrors String? // JSON array as string');
  
  // Add SQLite compatibility comment
  const header = `// Property Sync - Development Database Schema (SQLite Compatible)
// Generated from schema.master.prisma
// DO NOT EDIT DIRECTLY - Use schema.master.prisma and regenerate

`;
  
  content = content.replace(/\/\/ Property Sync - Master Database Schema.*?\n/, header);
  
  fs.writeFileSync(devSchemaPath, content);
  console.log('✅ Development schema generated successfully');
  console.log('📁 Generated:', path.basename(devSchemaPath));
}

if (require.main === module) {
  generateDevSchema();
}

module.exports = generateDevSchema;