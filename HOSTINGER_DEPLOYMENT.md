# Hostinger PostgreSQL & Node.js Deployment Guide

This guide provides step-by-step instructions for deploying the **OptimaGodown** application to Hostinger using PostgreSQL and Node.js.

---

## 1. Prerequisites on Hostinger

1. **Node.js**: Ensure Node.js (version 20 or 22) is selected in the Hostinger Node.js Web App settings.
2. **PostgreSQL Database**: Provision a PostgreSQL database via Hostinger Database Manager (or external PostgreSQL instance like Supabase / ElephantSQL / AWS RDS).

---

## 2. Step 1: Provision Hostinger PostgreSQL Database

1. Log in to your Hostinger hPanel.
2. Go to **Databases** → **PostgreSQL Databases**.
3. Create a new PostgreSQL database:
   - **Database Name**: e.g., `u123456789_inventory`
   - **Username**: e.g., `u123456789_admin`
   - **Password**: Create a strong password.
4. Note your database credentials and connection details:
   ```
   Host: localhost (or provided remote host/IP)
   Port: 5432
   Database Name: u123456789_inventory
   Username: u123456789_admin
   Password: YOUR_STRONG_PASSWORD
   ```

---

## 3. Step 2: Configure Environment Variables

In your Hostinger Application settings (or via `.env` file on the server), configure the following environment variables:

```env
# Database Connection URL (Constructed from your Hostinger DB details)
DATABASE_URL=postgresql://u123456789_admin:YOUR_STRONG_PASSWORD@localhost:5432/u123456789_inventory

# Set DB_SSL=true if using a remote SSL database (e.g. Supabase/AWS RDS)
DB_SSL=false

# Production Security Secrets
SESSION_SECRET=create-a-secure-random-64-char-string-here
NODE_ENV=production
PORT=8080
COOKIE_SECURE=true
```

> [!IMPORTANT]
> - Never commit `.env` or real passwords to Git repository. `.env` is listed in `.gitignore`.
> - Always use a strong random string for `SESSION_SECRET`.

---

## 4. Step 3: Deployment & Migration Commands

Execute the following commands on the server terminal (via Hostinger SSH or build pipeline):

```bash
# 1. Install Workspace Dependencies
pnpm install --frozen-lockfile

# 2. Push Database Schema to Hostinger PostgreSQL
pnpm run db:migrate

# 3. Seed Default Admin User (If database is brand new)
pnpm run db:seed

# 4. Build Production Frontend & Backend Bundles
pnpm run build
```

---

## 5. Step 4: Configure Node.js Web App Start Command

In Hostinger hPanel → **Node.js Web App** deploy settings:

| Setting | Value |
| --- | --- |
| Framework | Other (or Express) |
| Node version | `22` (or `20`) |
| Build command | `build` / `pnpm run build` |
| Package manager | `pnpm` |
| Output directory | leave empty (server app; not a static-only site) |
| **Entry file** | `artifacts/api-server/dist/index.mjs` |

> [!IMPORTANT]
> If **Entry file** is empty, the build can succeed but the site returns **403 Forbidden** because Hostinger never starts the Node process. Set the entry file, redeploy (regenerates `public_html/.htaccess`), then restart.

The API server also serves the Vite SPA from `artifacts/billing-app/dist/public` and listens on `0.0.0.0:$PORT`.

---

## 6. Security & Architecture Checklist

- [x] **Backend Only Access**: The PostgreSQL database is queried exclusively by `@workspace/api-server` via server-side connection pool. The React frontend SPA never connects directly to PostgreSQL.
- [x] **Parameterized Queries & ORM**: All database queries use Drizzle ORM parameterized queries to prevent SQL injection.
- [x] **Bcrypt Hashing**: User passwords are securely hashed using bcrypt (`salt rounds = 10`). Plaintext passwords are never stored or logged.
- [x] **Environment Separation**: Local development uses local `.env` or Docker PostgreSQL; Hostinger production uses Hostinger `.env` environment variables.

---

## 7. Troubleshooting Build & Install Issues

### `[ERR_PNPM_IGNORED_BUILDS]` on Hostinger / CI
pnpm 11 requires every package with lifecycle scripts to appear under `allowBuilds` in `pnpm-workspace.yaml`:
- `esbuild: false` — intentionally skip (reviewed; does **not** error)
- other packages: `true` if their install scripts must run

Do **not** leave a package unlisted — that is what triggers `ERR_PNPM_IGNORED_BUILDS`.

### `esbuild` postinstall `EACCES` / `spawnSync .../bin/esbuild`
Hostinger often materializes `@esbuild/*` binaries without `+x`. Running esbuild’s postinstall then fails on `--version`.

This repo:
1. Sets `allowBuilds.esbuild: false` so that postinstall is skipped cleanly
2. Uses `package-import-method=copy` plus root `postinstall` (`scripts/fix-esbuild-perms.cjs`) to restore `+x` before `pnpm run build`

If you still see `EACCES` during **build**, SSH in and run:
```bash
find node_modules -type f -name esbuild -exec chmod +x {} +
pnpm run build
```

### `pnpm: command not found` during build
Hostinger runs `package.json` scripts in a shell where `pnpm` is not on `PATH`. Nested `pnpm ...` calls then fail even though install used pnpm.

Root scripts go through `node scripts/pnpm.cjs`, which reuses `npm_execpath` (the pnpm binary that started the script). Keep using **Build command**: `pnpm run build` (or leave Hostinger auto-detect).

### Site returns `403 Forbidden` after a green build
Usually one of:
1. **Missing entry file** — set to `artifacts/api-server/dist/index.mjs` and redeploy
2. **Stale `.htaccess`** — redeploy so Hostinger regenerates `public_html/.htaccess`
3. **App crash on boot** — check Runtime Logs; ensure `DATABASE_URL`, `SESSION_SECRET`, and `NODE_ENV=production` are set, then Restart
