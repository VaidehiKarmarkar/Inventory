const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.env.APPDATA, 'OptimaGodown', 'inventory.db');
const backupSqlPath = 'c:/Backup/readable_backup.sql';

if (!fs.existsSync(backupSqlPath)) {
  console.error(`Backup file not found at: ${backupSqlPath}`);
  process.exit(1);
}

// 1. Backup existing DB if present
if (fs.existsSync(dbPath)) {
  const bakPath = `${dbPath}.bak-${Date.now()}`;
  fs.copyFileSync(dbPath, bakPath);
  console.log(`Backed up existing database to: ${bakPath}`);
} else {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

// Resolve @libsql/client
const libsqlPath = require.resolve('@libsql/client', { paths: [path.join(__dirname, '../lib/db')] });
const { createClient } = require(libsqlPath);

const client = createClient({
  url: 'file:' + dbPath.replace(/\\/g, '/')
});

const sql = fs.readFileSync(backupSqlPath, 'utf8');

function parseCopyBlock(tableName) {
  const marker = `COPY public.${tableName} (`;
  const idx = sql.indexOf(marker);
  if (idx === -1) return null;
  const headerEnd = sql.indexOf(') FROM stdin;', idx);
  const colStr = sql.substring(idx + marker.length, headerEnd);
  const columns = colStr.split(',').map(s => s.trim());
  
  const lineEnd = sql.indexOf('\n', headerEnd);
  const dataStart = lineEnd + 1;
  const dataEnd = sql.indexOf('\n\\.\n', dataStart);
  const rawData = sql.substring(dataStart, dataEnd === -1 ? undefined : dataEnd).trim();
  const rawLines = rawData ? rawData.split('\n') : [];
  
  const rows = rawLines.map(line => {
    const parts = line.split('\t');
    const row = {};
    columns.forEach((col, i) => {
      let val = parts[i];
      if (val === '\\N') val = null;
      row[col] = val;
    });
    return row;
  });
  
  return { columns, rows };
}

function toUnix(str) {
  if (!str) return Math.floor(Date.now() / 1000);
  const dt = new Date(str);
  if (isNaN(dt.getTime())) return Math.floor(Date.now() / 1000);
  return Math.floor(dt.getTime() / 1000);
}

async function main() {
  console.log('Initializing tables...');
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price TEXT NOT NULL,
      available_quantity INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_mobile TEXT NOT NULL,
      customer_email TEXT,
      customer_address TEXT,
      subtotal TEXT NOT NULL,
      gst_percentage TEXT NOT NULL DEFAULT '0',
      gst_amount TEXT NOT NULL,
      referral_charges TEXT NOT NULL DEFAULT '0',
      discount TEXT NOT NULL DEFAULT '0',
      grand_total TEXT NOT NULL,
      paid_amount TEXT NOT NULL DEFAULT '0',
      pending_amount TEXT NOT NULL DEFAULT '0',
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      status TEXT NOT NULL DEFAULT 'completed',
      created_by_id INTEGER REFERENCES users(id),
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price TEXT NOT NULL,
      total TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS order_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      amount TEXT NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      remarks TEXT NOT NULL,
      created_by_id INTEGER REFERENCES users(id),
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      previous_quantity INTEGER NOT NULL,
      quantity_added INTEGER,
      quantity_reduced INTEGER,
      current_quantity INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      updated_by_id INTEGER REFERENCES users(id),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS session (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expire INTEGER NOT NULL
    );
  `);

  // Temporarily disable foreign keys for clean table reset and batch insertion
  await client.execute("PRAGMA foreign_keys = OFF;");

  console.log('Clearing existing tables...');
  await client.execute("DELETE FROM order_payments;");
  await client.execute("DELETE FROM order_items;");
  await client.execute("DELETE FROM inventory_transactions;");
  await client.execute("DELETE FROM orders;");
  await client.execute("DELETE FROM products;");
  await client.execute("DELETE FROM users;");

  console.log('Importing users...');
  const users = parseCopyBlock('users').rows;
  // Known working bcrypt hash for "Eeya@123"
  const defaultHash = "$2b$10$kLYuNb2azr1vjcgSq7SzmeCsvAfIh1Vipvw2eKjLrW/rFuHjmuFFi";
  for (const u of users) {
    await client.execute({
      sql: `INSERT INTO users (id, name, email, username, password_hash, role, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        parseInt(u.id, 10),
        u.name,
        u.email,
        u.username,
        defaultHash,
        u.role || 'admin',
        u.is_active === 't' ? 1 : 0,
        toUnix(u.created_at),
        toUnix(u.updated_at)
      ]
    });
  }
  console.log(`Imported ${users.length} user(s).`);

  console.log('Importing products...');
  const products = parseCopyBlock('products').rows;
  for (const p of products) {
    await client.execute({
      sql: `INSERT INTO products (id, name, description, price, available_quantity, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        parseInt(p.id, 10),
        p.name,
        p.description || '',
        p.price,
        parseInt(p.available_quantity, 10) || 0,
        toUnix(p.created_at),
        toUnix(p.updated_at)
      ]
    });
  }
  console.log(`Imported ${products.length} product(s).`);

  console.log('Importing orders...');
  const orders = parseCopyBlock('orders').rows;
  for (const o of orders) {
    await client.execute({
      sql: `INSERT INTO orders (id, invoice_number, customer_name, customer_mobile, customer_email, customer_address, subtotal, gst_percentage, gst_amount, referral_charges, discount, grand_total, paid_amount, pending_amount, payment_method, status, created_by_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        parseInt(o.id, 10),
        o.invoice_number,
        o.customer_name,
        o.customer_mobile,
        o.customer_email || null,
        o.customer_address || null,
        o.subtotal,
        o.gst_percentage || '0',
        o.gst_amount || '0',
        o.referral_charges || '0',
        o.discount || '0',
        o.grand_total,
        o.paid_amount || '0',
        o.pending_amount || '0',
        o.payment_method || 'Cash',
        o.status || 'completed',
        parseInt(o.created_by_id, 10) || 1,
        toUnix(o.created_at)
      ]
    });
  }
  console.log(`Imported ${orders.length} order(s).`);

  console.log('Importing order items...');
  const orderItems = parseCopyBlock('order_items').rows;
  for (const item of orderItems) {
    await client.execute({
      sql: `INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, total, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        parseInt(item.id, 10),
        parseInt(item.order_id, 10),
        parseInt(item.product_id, 10),
        item.product_name,
        parseInt(item.quantity, 10),
        item.unit_price,
        item.total,
        toUnix(item.created_at)
      ]
    });
  }
  console.log(`Imported ${orderItems.length} order item(s).`);

  console.log('Importing order payments...');
  const orderPayments = parseCopyBlock('order_payments').rows;
  for (const pay of orderPayments) {
    await client.execute({
      sql: `INSERT INTO order_payments (id, order_id, amount, payment_method, remarks, created_by_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        parseInt(pay.id, 10),
        parseInt(pay.order_id, 10),
        pay.amount,
        pay.payment_method || 'Cash',
        pay.remarks || '',
        pay.created_by_id ? parseInt(pay.created_by_id, 10) : 1,
        toUnix(pay.created_at)
      ]
    });
  }
  console.log(`Imported ${orderPayments.length} order payment(s).`);

  console.log('Importing inventory transactions...');
  const inventoryTx = parseCopyBlock('inventory_transactions').rows;
  for (const tx of inventoryTx) {
    await client.execute({
      sql: `INSERT INTO inventory_transactions (id, product_id, product_name, previous_quantity, quantity_added, quantity_reduced, current_quantity, action_type, updated_by_id, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        parseInt(tx.id, 10),
        parseInt(tx.product_id, 10),
        tx.product_name,
        parseInt(tx.previous_quantity, 10) || 0,
        tx.quantity_added ? parseInt(tx.quantity_added, 10) : null,
        tx.quantity_reduced ? parseInt(tx.quantity_reduced, 10) : null,
        parseInt(tx.current_quantity, 10) || 0,
        tx.action_type,
        tx.updated_by_id ? parseInt(tx.updated_by_id, 10) : 1,
        toUnix(tx.updated_at)
      ]
    });
  }
  console.log(`Imported ${inventoryTx.length} inventory transaction(s).`);

  // Re-enable foreign keys and verify integrity
  await client.execute("PRAGMA foreign_keys = ON;");
  const fkCheck = await client.execute("PRAGMA foreign_key_check;");
  if (fkCheck.rows.length > 0) {
    console.error("Foreign key check failed with violations:", fkCheck.rows);
  } else {
    console.log("Foreign key check passed: 0 violations.");
  }

  // Copy to workspace root for standalone runs
  const rootDbPath = path.join(__dirname, '../inventory.db');
  fs.copyFileSync(dbPath, rootDbPath);
  console.log(`Synced populated database to workspace root: ${rootDbPath}`);

  // Summary counts
  const tables = ['users', 'products', 'orders', 'order_items', 'order_payments', 'inventory_transactions'];
  console.log('\n--- Final Database Status ---');
  for (const t of tables) {
    const res = await client.execute(`SELECT COUNT(*) as count FROM ${t}`);
    console.log(`${t}: ${res.rows[0].count} records`);
  }
  console.log('-----------------------------\nData migration completed successfully!');
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
