import { defineConfig } from "drizzle-kit";
import path from "path";

const dbUrl =
  process.env.DATABASE_URL ||
  "postgresql://postgres.qqfvfizhzfkthhlqrahv:JukxPJpwCyyUruXm@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
