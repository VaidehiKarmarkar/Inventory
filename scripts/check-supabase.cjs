let pg;
try {
  pg = require("pg");
} catch {
  try {
    pg = require("./lib/db/node_modules/pg");
  } catch {
    const path = require("path");
    const fs = require("fs");
    const pnpmDir = path.join(__dirname, "../node_modules/.pnpm");
    const found = fs.readdirSync(pnpmDir).find((d) => d.startsWith("pg@"));
    if (found) {
      pg = require(path.join(pnpmDir, found, "node_modules/pg"));
    } else {
      throw new Error("Could not find pg module in node_modules");
    }
  }
}
const { Pool } = pg;


const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres.qqfvfizhzfkthhlqrahv:JukxPJpwCyyUruXm@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log("Connecting to Supabase Cloud PostgreSQL...");
  try {
    const tableRes = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
    );

    console.log(`\nFound ${tableRes.rows.length} public tables in Supabase:\n`);

    for (const { table_name } of tableRes.rows) {
      try {
        const countRes = await pool.query(`SELECT COUNT(*) AS total FROM "${table_name}"`);
        console.log(`  • ${table_name.padEnd(20)}: ${countRes.rows[0].total} rows`);
      } catch (e) {
        console.log(`  • ${table_name.padEnd(20)}: (error counting: ${e.message})`);
      }
    }

    // Recent orders check if orders table exists
    const ordersRes = await pool
      .query(
        `SELECT id, invoice_number, customer_name, grand_total, status, created_at FROM orders ORDER BY created_at DESC LIMIT 5`
      )
      .catch((err) => {
        console.error("Orders query error:", err.message);
        return null;
      });

    if (ordersRes && ordersRes.rows.length > 0) {
      console.log("\nLatest 5 Orders in Supabase:");
      for (const order of ordersRes.rows) {
        console.log(
          `  - Invoice: ${order.invoice_number} | Customer: ${order.customer_name} | Total: ₹${order.grand_total} | Status: ${order.status} | Date: ${new Date(order.created_at).toLocaleString()}`
        );
      }
    }
  } catch (err) {
    console.error("Connection failed:", err.message);
  } finally {
    await pool.end();
  }
}

main();
