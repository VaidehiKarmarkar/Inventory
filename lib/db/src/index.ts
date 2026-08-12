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

/** Explicit DB_SSL wins; URL sslmode honored; Docker service hosts never get auto-SSL. */
function shouldUseSsl(databaseUrl: string): boolean {
  if (process.env.DB_SSL === "true") return true;
  if (process.env.DB_SSL === "false") return false;

  try {
    const url = new URL(databaseUrl);
    const sslmode = url.searchParams.get("sslmode")?.toLowerCase();
    if (sslmode === "disable") return false;
    if (
      sslmode === "require" ||
      sslmode === "verify-ca" ||
      sslmode === "verify-full"
    ) {
      return true;
    }

    if (process.env.NODE_ENV !== "production") return false;

    const host = url.hostname;
    if (host === "localhost" || host === "127.0.0.1") return false;
    // Compose/Kubernetes short names (e.g. "db") — no TLS on the private network
    if (!host.includes(".")) return false;
    return true;
  } catch {
    return false;
  }
}

const useSSL = shouldUseSsl(process.env.DATABASE_URL);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" }
    : false,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
