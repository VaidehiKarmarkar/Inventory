-- ============================================================================
-- Supabase Seed: Insert default users, products, and inventory transactions
-- WARNING: Only run on a fresh/empty database. Will fail on duplicate keys.
-- ============================================================================

BEGIN;

-- 1. Insert default users
-- Passwords: admin => admin123, user => user123 (bcrypt hashed)
INSERT INTO "users" ("id", "name", "email", "username", "password_hash", "role", "is_active")
VALUES
  (1, 'System Administrator', 'admin@inventorymasters.com', 'admin',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin', true),
  (2, 'Inventory Staff', 'staff@inventorymasters.com', 'user',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'user', true)
ON CONFLICT ("id") DO NOTHING;

-- 2. Insert sample products
INSERT INTO "products" ("id", "name", "description", "price", "available_quantity")
VALUES
  (1,  'BT Hanging',              'BT Hanging',              775.00,  10),
  (2,  'Kuber Bowl',              'Kuber Bowl',              7000.00,  5),
  (3,  'Money Oil',               'Money Oil',               1550.00, 10),
  (4,  'Education Br.',           'Education Br.',           1800.00, 10),
  (5,  'Wealth Br.',              'Wealth Br.',              1800.00, 10),
  (6,  'Mitawa',                  'Mitawa',                   550.00, 20),
  (7,  '7 Stone Tumble Br.',      '7 Stone Tumble Br.',      2000.00, 10),
  (8,  '7 Stone Br.',             '7 Stone Br.',             1300.00, 10),
  (9,  'Citrin Keychain',         'Citrin Keychain',         1000.00,  5),
  (10, 'Prosperity Br.',          'Prosperity Br.',          1500.00, 10),
  (11, 'Health Br.',              'Health Br.',              1800.00, 10),
  (12, 'Rudraksh Br.',            'Rudraksh Br.',            2100.00, 10),
  (13, '7 Chakra Car Hanging',    '7 Chakra Car Hanging',     850.00,  5),
  (14, 'Pyrite Anklet',           'Pyrite Anklet',           1250.00, 10),
  (15, 'Clear Quartz Br.',        'Clear Quartz Br.',        2800.00, 10),
  (16, 'Money Mag. Br. 8mm',      'Money Mag. Br. 8mm',      2600.00, 10),
  (17, 'Bell Hanging',            'Bell Hanging',            1500.00, 10),
  (18, 'Selenite Tumble',         'Selenite Tumble',          555.00, 10),
  (19, 'Gomati',                  'Gomati',                   555.00, 10),
  (20, 'Lava Br.',                'Lava Br.',                2100.00, 10),
  (21, 'Copper Kada',             'Copper Kada',             1700.00,  5),
  (22, 'Pyrite Br.',              'Pyrite Br.',              2200.00,  5),
  (23, 'Crysocola Br. Diabetes',  'Crysocola Br. Diabetes',  3200.00,  5),
  (24, 'Sulemani Hakik',          'Sulemani Hakik',          2100.00, 10),
  (25, 'Navratan Mala',           'Navratan Mala',           6111.00, 10),
  (26, '7 Stone Mala',            '7 Stone Mala',            6111.00, 10),
  (27, 'Black Tourm. Mala',       'Black Tourm. Mala',       6111.00, 10),
  (28, 'Zibu',                    'Zibu',                     555.00, 10),
  (29, 'Pyrite Zibu',             'Pyrite Zibu',              555.00, 10),
  (30, 'Pyrite Kasav',            'Pyrite Kasav',             999.00, 10),
  (31, 'Citrin Mala',             'Citrin Mala',            10000.00,  1),
  (32, 'Guasha',                  'Guasha',                  1399.00, 10),
  (33, '7 Chakra Angle',          '7 Chakra Angle',          1300.00, 10),
  (34, 'Roller',                  'Roller',                  1555.00, 10),
  (35, 'Rudraksh Clear Mala',     'Rudraksh Clear Mala',     9000.00,  1),
  (36, 'Rose Quartz Mala',        'Rose Quartz Mala',        4999.00,  1),
  (37, 'Garnet Pendent',          'Garnet Pendent',          1500.00,  5),
  (38, 'Citrin Pyramid',          'Citrin Pyramid',          1800.00, 10),
  (39, 'Citrin Br.',              'Citrin Br.',              4000.00, 10),
  (40, 'Pixue Br.',               'Pixue Br.',               5000.00, 10),
  (41, '5 Elements Br.',          '5 Elements Br.',          3555.00, 10),
  (42, 'Black Pixue',             'Black Pixue',             7000.00, 10),
  (43, 'Amber Pendent',           'Amber Pendent',           2200.00,  5),
  (44, 'Firoza',                  'Firoza',                  4500.00,  5),
  (45, 'Money Magnet 10mm',       'Money Magnet 10mm',       3000.00, 10),
  (46, 'Protection Coin',         'Protection Coin',         1000.00, 10),
  (47, 'Pyrite Chunk 200gm@22Rs', 'Pyrite Chunk 200gm@22Rs', 4400.00, 10),
  (48, 'Pyrite Chunk 195gm@22Rs', 'Pyrite Chunk 195gm@22Rs', 4290.00, 10)
ON CONFLICT ("id") DO NOTHING;

-- 3. Insert initial inventory transactions (stock-in logs)
INSERT INTO "inventory_transactions" ("product_id", "product_name", "previous_quantity", "quantity_added", "quantity_reduced", "current_quantity", "action_type", "updated_by_id")
SELECT p."id", p."name", 0, p."available_quantity", 0, p."available_quantity", 'add', 1
FROM "products" p
WHERE p."id" BETWEEN 1 AND 48
ON CONFLICT DO NOTHING;

-- 4. Reset sequences so new inserts get correct IDs
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX("id") FROM "users"), 1));
SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE((SELECT MAX("id") FROM "products"), 1));
SELECT setval(pg_get_serial_sequence('orders', 'id'), COALESCE((SELECT MAX("id") FROM "orders"), 1));
SELECT setval(pg_get_serial_sequence('order_items', 'id'), COALESCE((SELECT MAX("id") FROM "order_items"), 1));
SELECT setval(pg_get_serial_sequence('order_payments', 'id'), COALESCE((SELECT MAX("id") FROM "order_payments"), 1));
SELECT setval(pg_get_serial_sequence('inventory_transactions', 'id'), COALESCE((SELECT MAX("id") FROM "inventory_transactions"), 1));

COMMIT;
