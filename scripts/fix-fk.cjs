const path = require("path");
const fs = require("fs");

const pnpmDir = path.join(__dirname, "../node_modules/.pnpm");
const pgDir = fs.readdirSync(pnpmDir).find((d) => d.startsWith("pg@"));
const pg = require(path.join(pnpmDir, pgDir, "node_modules/pg"));

const pool = new pg.Pool({
  connectionString:
    "postgresql://postgres.qqfvfizhzfkthhlqrahv:JukxPJpwCyyUruXm@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log("Updating order_items foreign key to ON DELETE CASCADE...");
  await pool.query(`
    ALTER TABLE order_items
      DROP CONSTRAINT IF EXISTS order_items_order_id_orders_id_fk;

    ALTER TABLE order_items
      ADD CONSTRAINT order_items_order_id_orders_id_fk
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE;
  `);

  console.log("Successfully updated constraint to ON DELETE CASCADE!");

  // Verify the new constraint
  const res = await pool.query(`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'order_items' AND kcu.column_name = 'order_id';
  `);

  console.log("\nUpdated constraint details:", res.rows);

  await pool.end();
}

main().catch(console.error);
