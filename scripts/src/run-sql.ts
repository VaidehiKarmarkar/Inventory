/**
 * run-sql.ts — Execute a SQL file against DATABASE_URL.
 *
 * Usage:  node --import tsx scripts/src/run-sql.ts <path-to-sql-file>
 *
 * Supports SSL via DATABASE_SSL=true env var (required for Supabase).
 * Loads .env from the workspace root automatically.
 */

import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

// ── Load .env ────────────────────────────────────────────────────────────────
const envPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(process.cwd(), "../.env"),
];
if (!process.env.DATABASE_URL) {
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      try {
        process.loadEnvFile(envPath);
        if (process.env.DATABASE_URL) break;
      } catch (_) {}
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set. Check your .env file.");
  process.exit(1);
}

// ── Resolve SQL file ─────────────────────────────────────────────────────────
const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error("Usage: run-sql.ts <path-to-sql-file>");
  process.exit(1);
}

// Find workspace root by walking up until we find pnpm-workspace.yaml
function findWorkspaceRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return startDir; // reached filesystem root, fallback
    dir = parent;
  }
}

const workspaceRoot = findWorkspaceRoot(process.cwd());
const resolvedPath = path.isAbsolute(sqlFile)
  ? sqlFile
  : path.resolve(workspaceRoot, sqlFile);

if (!fs.existsSync(resolvedPath)) {
  console.error(`❌ SQL file not found: ${resolvedPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(resolvedPath, "utf-8");

// ── Connect with optional SSL ────────────────────────────────────────────────
const useSSL =
  process.env.DATABASE_SSL === "true" ||
  process.env.DATABASE_URL.includes("supabase");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  const client = await pool.connect();
  try {
    console.log(`⏳ Running: ${path.basename(resolvedPath)} ...`);
    await client.query(sql);
    console.log(`✅ Successfully executed: ${path.basename(resolvedPath)}`);
  } catch (err: any) {
    console.error(`❌ SQL execution failed:`, err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
