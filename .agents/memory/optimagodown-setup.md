---
name: OptimaGodown setup
description: Key decisions and gotchas for the billing & inventory management system
---

## Auth
- Session-based (express-session + connect-pg-simple), NOT JWT
- bcryptjs (pure JS, no native build) for password hashing
- Session table auto-created by `createTableIfMissing: true`
- SESSION_SECRET env var required

## Contract-first API
- Edit `lib/api-spec/openapi.yaml` → run `pnpm --filter @workspace/api-spec run codegen` → regenerated hooks in `lib/api-client-react/src/generated/`
- After changing lib packages, run `pnpm run typecheck:libs` before leaf typechecks
- Never edit generated files directly

## Type gotchas
- User type from API client is `AppUser` (not `User`)
- Mutation input types: `UserInput` (create), `UserUpdate` (edit)
- `OrderInput` requires `customerName` + `customerMobile` (not just `customerId`)
- `OrderDetail`/`Order` use `gstPercentage` (not `gstPercent`)
- `OrderItem` has `total` field (not `subtotal`)
- Generated query hooks require explicit `queryKey` in their query options object

## pdfkit
- Dynamically imported (`await import("pdfkit")`) to avoid esbuild bundling issues
- Installed `@types/pdfkit` as devDependency in api-server

**Why:** Static import causes esbuild to fail bundling pdfkit's binary assets.

## Numeric fields
- All monetary/quantity DB fields are `numeric` Drizzle type
- Always call `Number()` on them before returning in API responses

## Seed credentials
- Admin: admin / admin123
- User: user / user123
