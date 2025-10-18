# Railway Build Fixes - PropertySync API

## Summary
Fixed 4 TypeScript build errors preventing Railway deployment.

---

## Error 1-3: JWT expiresIn Type Errors

### Problem
`@nestjs/jwt` v11 strictly types `expiresIn` as `number` (seconds), but code was passing strings like `'15m'`, `'7d'`.

### Files Fixed
1. `src/auth/auth.module.ts` - line 23
2. `src/auth/auth.service.ts` - lines 184, 188

### Solution
Added helper function `parseExpiryToSeconds()` to convert string duration notation to seconds:
- `'15m'` → `900` (seconds)
- `'7d'` → `604800` (seconds)
- Supports: `s` (seconds), `m` (minutes), `h` (hours), `d` (days)

### Changes
- **auth.module.ts**: Added `parseExpiryToSeconds()` helper and converted JWT module config
- **auth.service.ts**: Added private `parseExpiryToSeconds()` method in AuthService class

---

## Error 4: Missing Prisma Schema Fields

### Problem
`timelines.service.ts:1319` was creating Property with `rapidapi_property_id` and related RapidAPI fields that didn't exist in Prisma schema.

### File Fixed
`prisma/schema.prisma` - Property model

### Solution
Added RapidAPI-specific fields to Property model:
- `rapidapi_property_id` (String?) - RapidAPI property ID (shareId)
- `rapidapi_permalink` (String?) - RapidAPI permalink
- `tax_history` (Json?) - Tax history data
- `nearby_schools` (Json?) - Nearby schools data
- `flood_risk` (Json?) - Flood risk data
- `fire_risk` (Json?) - Fire risk data
- `noise_score` (Json?) - Noise score data
- `last_sold_price` (Int?) - Last sold price in cents
- `last_sold_date` (DateTime?) - Last sold date

---

## Required Actions

### 1. Generate Prisma Client
```bash
cd C:\Users\ziadf\Documents\Projects\property-sync-standalone\api
npm run db:generate
```

### 2. Push Schema to Database
```bash
npm run db:push
```
OR create migration:
```bash
npm run db:migrate
```

### 3. Rebuild
```bash
npm run build
```

### 4. Test Locally
```bash
npm run start:dev
```

---

## Deployment Notes

### Railway Environment Variables
Ensure these are set in Railway dashboard:
- `JWT_SECRET` - Secret key for JWT signing
- `JWT_ACCESS_TOKEN_EXPIRY` - e.g., `'15m'` (will be converted to 900 seconds)
- `JWT_REFRESH_TOKEN_EXPIRY` - e.g., `'7d'` (will be converted to 604800 seconds)
- `DATABASE_URL` - PostgreSQL connection string

### Build Command
Railway should run:
```bash
npm install && npm run db:generate && npm run build
```

### Start Command
```bash
npm run start:prod
```

---

## Verification Checklist

- [ ] Prisma client regenerated (`npm run db:generate`)
- [ ] Schema pushed to database (`npm run db:push`)
- [ ] Local build succeeds (`npm run build`)
- [ ] TypeScript compilation has no errors
- [ ] Railway environment variables configured
- [ ] Railway deployment triggered
- [ ] API health check endpoint responding
- [ ] JWT authentication working

---

## Files Modified

1. `C:\Users\ziadf\Documents\Projects\property-sync-standalone\api\src\auth\auth.module.ts`
2. `C:\Users\ziadf\Documents\Projects\property-sync-standalone\api\src\auth\auth.service.ts`
3. `C:\Users\ziadf\Documents\Projects\property-sync-standalone\api\prisma\schema.prisma`

---

## Next Steps After Deployment

1. Test authentication endpoints
2. Verify JWT token generation
3. Test RapidAPI property creation
4. Monitor Railway logs for runtime errors
5. Test property import with RapidAPI data

---

Generated: 2025-10-18
