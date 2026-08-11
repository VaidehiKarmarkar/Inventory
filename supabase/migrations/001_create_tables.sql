-- ============================================================================
-- Supabase Migration: Create all tables for OptimaGodown Inventory System
-- Run order matters: tables are created in dependency order.
-- Safe to re-run: uses IF NOT EXISTS throughout.
-- ============================================================================

-- 1. Users table
CREATE TABLE IF NOT EXISTS "users" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "username" TEXT NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'user',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Products table
CREATE TABLE IF NOT EXISTS "products" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "price" NUMERIC(10, 2) NOT NULL,
  "available_quantity" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Orders table (references users)
CREATE TABLE IF NOT EXISTS "orders" (
  "id" SERIAL PRIMARY KEY,
  "invoice_number" TEXT NOT NULL UNIQUE,
  "customer_name" TEXT NOT NULL,
  "customer_mobile" TEXT NOT NULL,
  "customer_email" TEXT,
  "customer_address" TEXT,
  "subtotal" NUMERIC(12, 2) NOT NULL,
  "gst_percentage" NUMERIC(5, 2) NOT NULL DEFAULT 0,
  "gst_amount" NUMERIC(12, 2) NOT NULL,
  "referral_charges" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "discount" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "grand_total" NUMERIC(12, 2) NOT NULL,
  "paid_amount" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "pending_amount" NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "payment_method" TEXT NOT NULL DEFAULT 'Cash',
  "status" TEXT NOT NULL DEFAULT 'completed',
  "created_by_id" INTEGER REFERENCES "users"("id"),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Order items table (references orders, products)
CREATE TABLE IF NOT EXISTS "order_items" (
  "id" SERIAL PRIMARY KEY,
  "order_id" INTEGER NOT NULL REFERENCES "orders"("id"),
  "product_id" INTEGER NOT NULL REFERENCES "products"("id"),
  "product_name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit_price" NUMERIC(10, 2) NOT NULL,
  "total" NUMERIC(12, 2) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Order payments table (references orders, users)
CREATE TABLE IF NOT EXISTS "order_payments" (
  "id" SERIAL PRIMARY KEY,
  "order_id" INTEGER NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "amount" NUMERIC(12, 2) NOT NULL,
  "payment_method" TEXT NOT NULL DEFAULT 'Cash',
  "remarks" TEXT NOT NULL,
  "created_by_id" INTEGER REFERENCES "users"("id"),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Inventory transactions table (references products, users)
CREATE TABLE IF NOT EXISTS "inventory_transactions" (
  "id" SERIAL PRIMARY KEY,
  "product_id" INTEGER NOT NULL REFERENCES "products"("id"),
  "product_name" TEXT NOT NULL,
  "previous_quantity" INTEGER NOT NULL,
  "quantity_added" INTEGER,
  "quantity_reduced" INTEGER,
  "current_quantity" INTEGER NOT NULL,
  "action_type" TEXT NOT NULL,
  "updated_by_id" INTEGER REFERENCES "users"("id"),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Session table (for connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
  "sid" VARCHAR NOT NULL PRIMARY KEY,
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL
);

-- Index on session expiry for cleanup performance
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
