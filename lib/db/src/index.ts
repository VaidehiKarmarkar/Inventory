import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";
import path from "node:path";
import fs from "node:fs";

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL.startsWith("file:")
      ? process.env.DATABASE_URL
      : `file:${process.env.DATABASE_URL}`;
  }

  const appData =
    process.env.APPDATA ||
    process.env.LOCALAPPDATA ||
    (process.platform === "darwin"
      ? path.join(process.env.HOME || "", "Library", "Application Support")
      : process.env.HOME);

  if (process.env.ELECTRON_APP_DATA || (process.versions && process.versions.electron)) {
    const dbDir = path.join(appData || process.cwd(), "OptimaGodown");
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    return `file:${path.join(dbDir, "inventory.db")}`;
  }

  return "file:inventory.db";
}

const dbUrl = getDatabaseUrl();

export const client = createClient({
  url: dbUrl,
});

export const db = drizzle(client, { schema });

export async function initDb(): Promise<void> {
  await client.execute("PRAGMA foreign_keys = ON;");

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
}

export * from "./schema";
