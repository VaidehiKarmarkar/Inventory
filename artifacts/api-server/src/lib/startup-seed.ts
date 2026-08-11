import { db } from "@workspace/db";
import { usersTable, productsTable, inventoryTable } from "@workspace/db/schema";
import { count } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logger } from "./logger";

export async function seedIfEmpty() {
  const [{ value: userCount }] = await db
    .select({ value: count() })
    .from(usersTable);

  if (Number(userCount) > 0) return;

  logger.info("No users found — seeding default data...");

  const adminPasswordHash = await bcrypt.hash("Eeya@123", 10);

  const [adminUser] = await db
    .insert(usersTable)
    .values({
      name: "Aloha Administrator",
      username: "alohaamravati",
      email: "alohaamravati@alohacrystalworld.com",
      passwordHash: adminPasswordHash,
      role: "admin",
      isActive: true,
    })
    .returning();

  const sampleProducts = [
    { name: "BT Hanging", price: "775", qty: 10 },
    { name: "Kuber Bowl", price: "7000", qty: 5 },
    { name: "Money Oil", price: "1550", qty: 10 },
    { name: "Education Br.", price: "1800", qty: 10 },
    { name: "Wealth Br.", price: "1800", qty: 10 },
    { name: "Mitawa", price: "550", qty: 20 },
    { name: "7 Stone Tumble Br.", price: "2000", qty: 10 },
    { name: "7 Stone Br.", price: "1300", qty: 10 },
    { name: "Citrin Keychain", price: "1000", qty: 5 },
    { name: "Prosperity Br.", price: "1500", qty: 10 },
    { name: "Health Br.", price: "1800", qty: 10 },
    { name: "Rudraksh Br.", price: "2100", qty: 10 },
    { name: "7 Chakra Car Hanging", price: "850", qty: 5 },
    { name: "Pyrite Anklet", price: "1250", qty: 10 },
    { name: "Clear Quartz Br.", price: "2800", qty: 10 },
    { name: "Money Mag. Br. 8mm", price: "2600", qty: 10 },
    { name: "Bell Hanging", price: "1500", qty: 10 },
    { name: "Selenite Tumble", price: "555", qty: 10 },
    { name: "Gomati", price: "555", qty: 10 },
    { name: "Lava Br.", price: "2100", qty: 10 },
    { name: "Copper Kada", price: "1700", qty: 5 },
    { name: "Pyrite Br.", price: "2200", qty: 5 },
    { name: "Crysocola Br. Diabetes", price: "3200", qty: 5 },
    { name: "Sulemani Hakik", price: "2100", qty: 10 },
    { name: "Navratan Mala", price: "6111", qty: 10 },
    { name: "7 Stone Mala", price: "6111", qty: 10 },
    { name: "Black Tourm. Mala", price: "6111", qty: 10 },
    { name: "Zibu", price: "555", qty: 10 },
    { name: "Pyrite Zibu", price: "555", qty: 10 },
    { name: "Pyrite Kasav", price: "999", qty: 10 },
    { name: "Citrin Mala", price: "10000", qty: 1 },
    { name: "Guasha", price: "1399", qty: 10 },
    { name: "7 Chakra Angle", price: "1300", qty: 10 },
    { name: "Roller", price: "1555", qty: 10 },
    { name: "Rudraksh Clear Mala", price: "9000", qty: 1 },
    { name: "Rose Quartz Mala", price: "4999", qty: 1 },
    { name: "Garnet Pendent", price: "1500", qty: 5 },
    { name: "Citrin Pyramid", price: "1800", qty: 10 },
    { name: "Citrin Br.", price: "4000", qty: 10 },
    { name: "Pixue Br.", price: "5000", qty: 10 },
    { name: "5 Elements Br.", price: "3555", qty: 10 },
    { name: "Black Pixue", price: "7000", qty: 10 },
    { name: "Amber Pendent", price: "2200", qty: 5 },
    { name: "Firoza", price: "4500", qty: 5 },
    { name: "Money Magnet 10mm", price: "3000", qty: 10 },
    { name: "Protection Coin", price: "1000", qty: 10 },
    { name: "Pyrite Chunk 200gm@22Rs", price: "4400", qty: 10 },
    { name: "Pyrite Chunk 195gm@22Rs", price: "4290", qty: 10 },
  ];

  for (const prod of sampleProducts) {
    const [inserted] = await db
      .insert(productsTable)
      .values({ name: prod.name, description: prod.name, price: prod.price, availableQuantity: prod.qty })
      .returning();

    await db.insert(inventoryTable).values({
      productId: inserted.id,
      productName: inserted.name,
      previousQuantity: 0,
      quantityAdded: prod.qty,
      quantityReduced: 0,
      currentQuantity: prod.qty,
      actionType: "add",
      updatedById: adminUser.id,
    });
  }

  logger.info("Seeding complete: 2 users, 48 products.");
}
