# Development Safety Protocol

## Database Protection Rules

### NEVER USE THESE COMMANDS WITHOUT BACKUP:
- `prisma db push` - Can wipe data
- `prisma migrate reset` - Wipes entire database
- `prisma migrate deploy` without testing

### ALWAYS USE THESE SAFE COMMANDS:
- `prisma migrate dev` - Creates migration files safely
- `prisma migrate diff` - Preview changes before applying
- `prisma db pull` - Sync schema with existing database

## Pre-Development Checklist

### Before Any Schema Changes:
1. **Create manual backup**: Export data from Prisma Studio
2. **Check Neon backup status**: Ensure point-in-time recovery is available
3. **Create migration file**: Use `prisma migrate dev --name descriptive_name`
4. **Test on staging**: Never test schema changes on production data first

## Emergency Recovery

### If Database Gets Wiped:
1. **Neon Console**: Check point-in-time recovery (24-48 hours available)
2. **Restore from backup**: Use most recent manual backup
3. **Check git history**: Look for data seeding scripts

## Backup Commands

```bash
# Manual data export (run before schema changes)
cd api
npx prisma studio
# Export each table manually from the UI

# Create migration (SAFE)
npx prisma migrate dev --name "add_messaging_system"

# Preview changes (SAFE)
npx prisma migrate diff --from-schema-datamodel ./prisma/schema.prisma --to-schema-datasource ./prisma/schema.prisma
```

## Red Flags 🚨

Stop immediately if you see:
- "Do you want to reset the database?"
- "This will delete all data"
- "Schema drift detected"
- Any mention of data loss

## Recovery Steps

1. Go to Neon Console
2. Navigate to your database
3. Check "Restore" or "Backups" section
4. Select point-in-time recovery
5. Choose timestamp before the issue
6. Restore to new branch first (safer)