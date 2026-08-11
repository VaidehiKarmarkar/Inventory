import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const useSSL =
  process.env.DATABASE_SSL === "true" ||
  process.env.DATABASE_URL.includes("supabase");

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl: useSSL ? { rejectUnauthorized: false } : undefined,
  },
});
