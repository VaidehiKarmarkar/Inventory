# OptimaGodown — Billing & Inventory Management System

A full-stack godown/warehouse billing and inventory management app with role-based access control, order creation with PDF invoice generation, and real-time stock tracking.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/billing-app run dev` — run the frontend (port auto via $PORT)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + express-session + connect-pg-simple (PostgreSQL session store)
- DB: PostgreSQL + Drizzle ORM
- Auth: Session-based (bcryptjs password hashing), NOT JWT
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- PDF: pdfkit (dynamically imported in orders route)
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + React Query

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)
- `lib/api-client-react/src/generated/` — generated React Query hooks and types
- `lib/api-zod/src/generated/` — generated Zod validators for server-side use
- `lib/db/src/schema/` — Drizzle ORM schema definitions
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/billing-app/src/pages/` — React page components
- `artifacts/billing-app/src/components/` — UI components (shadcn/ui)

## Architecture decisions

- Session-based auth over JWT — simpler, no token refresh complexity, sessions stored in PostgreSQL via connect-pg-simple
- Contract-first API — OpenAPI spec is edited manually, then codegen produces typed hooks and Zod validators; never edit generated files directly
- All numeric DB fields use `numeric` type (Drizzle) — always call `Number()` before returning in API responses
- pdfkit dynamically imported (`await import("pdfkit")`) to avoid esbuild bundling issues
- Invoice numbers use format `INV-YYYYMM-XXXXX` (5-digit random sequence)

## Product

- **Login page** with role-based demo credentials shown
- **Dashboard** — admin sees KPIs (products, inventory, orders, today/monthly sales, out-of-stock count); user sees personal order metrics; both see recent orders + low stock alerts
- **Products** (admin only) — CRUD with search, pagination, stock badge
- **Inventory Log** (admin only) — all stock movements; manual stock adjust (add/reduce) with product filter
- **Customers** (admin only) — CRUD with search, GST number support
- **Orders** — list with date/customer filter + PDF download; new order form with customer selector, product line items, GST rate selector; order detail page with PDF download
- **Staff & Users** (admin only) — create/edit/delete users, role and active status management

## Seed Data

- Admin: `admin / admin123`
- User: `user / user123`
- 8 sample products (office supplies), 3 sample customers

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After editing `lib/api-spec/openapi.yaml`, always run codegen: `pnpm --filter @workspace/api-spec run codegen`
- After changing `lib/db` schema, run `pnpm --filter @workspace/db run push` then restart api-server workflow
- bcryptjs (pure JS) is used instead of bcrypt (no native build required)
- `UserUpdate` OpenAPI schema includes `isActive` and `password` fields (non-standard, needed for admin user management UI)
- session table auto-created by connect-pg-simple with `createTableIfMissing: true`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
