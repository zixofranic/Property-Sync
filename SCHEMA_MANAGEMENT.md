# Database Schema Management System

## 🎯 Purpose
This document establishes a systematic approach to managing database schema changes and ensuring consistency between documented designs, application code, and actual database schemas.

## 📁 Schema File Organization

### Master Schema Files
- `api/prisma/schema.master.prisma` - Master schema with all models and fields
- `api/prisma/schema.dev.prisma` - SQLite-compatible version for development  
- `api/prisma/schema.production.prisma` - PostgreSQL version for production

### Documentation Files
- `CHATTING_SYSTEM_STUDY.md` - Original messaging system design
- `SCHEMA_MANAGEMENT.md` - This file (schema management practices)
- `api/prisma/SCHEMA_CHANGELOG.md` - Detailed change log for all schema modifications

## 🔄 Schema Change Process

### 1. Design Phase
- Document new features/changes in relevant `.md` files
- Update the master schema design
- Review changes with stakeholders

### 2. Implementation Phase  
- Update `schema.master.prisma` first
- Generate environment-specific schemas (`dev`, `production`)
- Update application code to match schema changes
- Run database migrations

### 3. Validation Phase
- Ensure schema compiles without TypeScript errors
- Test all CRUD operations
- Verify environment-specific compatibility
- Update documentation

## 🗂️ Current Schema Issues

### Identified Mismatches
Based on compilation errors and the documented design in `CHATTING_SYSTEM_STUDY.md`, the following fields are missing or incorrect:

#### ConversationParticipant Model
- Missing: `userType` field (documented but not in schema)
- Missing: `isActive` field (used in application code)
- Missing: `lastReadAt` field (for read status tracking)
- Mismatch: `last_read_at` vs `lastReadAt` naming convention

#### Conversation Model  
- Missing: `description` field (used in application code)
- Missing: `lastMessageAt` field (for conversation sorting)
- Missing: `isActive` field (for soft deletion)

#### Message Model
- Correct: Already matches documented design
- Has: `senderType`, `messageType`, `content`, `metadata` fields

#### MessageRead Model
- Correct: Matches documented design
- Has: `messageId`, `userId`, `readAt` fields

#### Other Models Needing Attention
- **Profile**: Missing billing/usage tracking fields
- **Client**: Missing `phone` field vs `phoneNumber`
- **Timeline**: Missing required `shareToken` field
- **Property**: Has correct `viewedAt` field
- **UsageEvent**: Missing fields for usage tracking
- **PaymentHistory**: Missing `billingPeriodStart` field

## 📋 Schema Synchronization Strategy

### Step 1: Create Master Schema
Create a single source of truth schema that includes all documented and required fields.

### Step 2: Environment Adaptation
- **SQLite (Development)**: Convert arrays to JSON strings, remove advanced features
- **PostgreSQL (Production)**: Use native arrays and advanced constraints

### Step 3: Migration Strategy
- Generate fresh migrations for clean environments
- Create upgrade migrations for existing databases
- Maintain backward compatibility during transitions

### Step 4: Code Alignment
- Update all service files to match schema
- Fix TypeScript compilation errors
- Update DTOs and interfaces

## 🛡️ Schema Validation Rules

### Naming Conventions
- Use `camelCase` for field names in Prisma schema
- Use `snake_case` for database column names via `@map()`
- Consistent enum naming across all models

### Required Fields
- All models must have `id`, `createdAt`, `updatedAt`
- Relationship models must have proper foreign keys
- Unique constraints must be explicitly defined

### Environment Compatibility
- SQLite schemas must not use PostgreSQL-specific features
- Array fields must have JSON string alternatives for SQLite
- Complex constraints should have fallback strategies

## 📊 Change Tracking

### Version Control
- All schema changes must be committed with detailed messages
- Tag major schema versions (v1.0, v1.1, etc.)
- Maintain migration history in version control

### Documentation Updates
- Update all relevant `.md` files when schema changes
- Maintain a detailed changelog of all modifications
- Cross-reference between code, schema, and documentation

### Testing Requirements
- Schema changes must pass compilation
- All existing tests must continue to pass
- New fields must have appropriate test coverage

## 🚀 Next Steps

1. **Create Master Schema**: Build comprehensive `schema.master.prisma`
2. **Fix Current Issues**: Address all compilation errors systematically
3. **Implement Validation**: Add automated schema validation checks
4. **Update Documentation**: Ensure all docs reflect current reality
5. **Establish Monitoring**: Track schema drift and inconsistencies

---

**Created**: January 2025
**Status**: Initial Framework
**Next Review**: After master schema implementation