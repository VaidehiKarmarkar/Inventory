const path = require("path");
const fs = require("fs");

const pnpmDir = path.join(__dirname, "../node_modules/.pnpm");
const pgDir = fs.readdirSync(pnpmDir).find((d) => d.startsWith("pg@"));
const pg = require(path.join(pnpmDir, pgDir, "node_modules/pg"));

const bcryptDir = fs.readdirSync(pnpmDir).find((d) => d.startsWith("bcryptjs@"));
const bcrypt = require(path.join(pnpmDir, bcryptDir, "node_modules/bcryptjs"));

const pool = new pg.Pool({
  connectionString:
    "postgresql://postgres.qqfvfizhzfkthhlqrahv:JukxPJpwCyyUruXm@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const hash = await bcrypt.hash("Eeya@123", 10);
  await pool.query(
    `INSERT INTO users (name, username, email, password_hash, role, is_active)
     VALUES ('Admin User', 'admin', 'admin@alohacrystalworld.com', $1, 'admin', true)
     ON CONFLICT (username) DO UPDATE SET password_hash = $1`,
    [hash]
  );
  console.log("Successfully ensured 'admin' user with password 'Eeya@123' exists in Supabase.");

  const all = await pool.query("SELECT id, username, email, role, is_active FROM users ORDER BY id;");
  console.log("\nUsers in Supabase DB now:");
  for (const u of all.rows) {
    console.log(` - ID: ${u.id} | username: ${u.username} | email: ${u.email} | role: ${u.role}`);
  }
  await pool.end();
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
