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
  const res = await pool.query("SELECT * FROM users WHERE username = 'alohaamravati';");
  console.log("Full user row for alohaamravati:");
  console.log(res.rows[0]);

  if (res.rows[0]) {
    const u = res.rows[0];
    console.log("\nField checks:");
    console.log("- username length:", u.username.length, `"${u.username}"`);
    console.log("- is_active:", u.is_active, typeof u.is_active);
    console.log("- password compare 'Eeya@123':", bcrypt.compareSync("Eeya@123", u.password_hash));
    console.log("- password compare 'eeya@123':", bcrypt.compareSync("eeya@123", u.password_hash));
  }
  await pool.end();
}

main().catch(console.error);
