import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

import fs from "node:fs";
import path from "node:path";

if (!process.env.DATABASE_URL) {
  const envPaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(process.cwd(), "../.env"),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      try {
        process.loadEnvFile(envPath);
        if (process.env.DATABASE_URL) break;
      } catch (e) {}
    }
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Enable SSL for Supabase or when DATABASE_SSL=true (required for hosted PG)
const useSSL =
  process.env.DATABASE_SSL === "true" ||
  process.env.DATABASE_URL.includes("supabase");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
