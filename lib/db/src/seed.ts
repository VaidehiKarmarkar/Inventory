import { db } from "./index";
import { usersTable, productsTable, inventoryTable } from "./schema";
import bcrypt from "bcryptjs";

async function main() {
  console.log("Seeding database...");

  // 1. Create Default Users
  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const userPasswordHash = await bcrypt.hash("user123", 10);

  const [adminUser] = await db
    .insert(usersTable)
    .values({
      name: "System Administrator",
      username: "admin",
      email: "admin@inventorymasters.com",
      passwordHash: adminPasswordHash,
      role: "admin",
      isActive: true,
    })
    .returning();

  const [regularUser] = await db
    .insert(usersTable)
    .values({
      name: "Inventory Staff",
      username: "user",
      email: "staff@inventorymasters.com",
      passwordHash: userPasswordHash,
      role: "user",
      isActive: true,
    })
    .returning();

  console.log(`Created users: Admin (ID: ${adminUser.id}), Staff (ID: ${regularUser.id})`);

  // 2. Create Sample Products
  const sampleProducts = [
    { name: "BT Hanging", description: "BT Hanging", price: "775", qty: 10 },
    { name: "Kuber Bowl", description: "Kuber Bowl", price: "7000", qty: 5 },
    { name: "Money Oil", description: "Money Oil", price: "1550", qty: 10 },
    { name: "Education Br.", description: "Education Br.", price: "1800", qty: 10 },
    { name: "Wealth Br.", description: "Wealth Br.", price: "1800", qty: 10 },
    { name: "Mitawa", description: "Mitawa", price: "550", qty: 20 }, // Low stock (5 < 10)
    { name: "7 Stone Tumble Br.", description: "7 Stone Tumble Br.", price: "2000", qty: 10 },
    { name: "7 Stone Br.", description: "7 Stone Br.", price: "1300", qty: 10 },
    { name: "Citrin Keychain", description: "Citrin Keychain", price: "1000", qty: 5 },
    { name: "Prosperity Br.", description: "Prosperity Br.", price: "1500", qty: 10 },
    { name: "Health Br.", description: "Health Br.", price: "1800", qty: 10 },
    { name: "Rudraksh Br.", description: "Rudraksh Br.", price: "2100", qty: 10 },
    { name: "7 Chakra Car Hanging", description: "7 Chakra Car Hanging", price: "850", qty: 5 },
    { name: "Pyrite Anklet", description: "Pyrite Anklet", price: "1250", qty: 10 },
    { name: "Clear Quartz Br.", description: "Clear Quartz Br.", price: "2800", qty: 10 },
    { name: "Money Mag. Br. 8mm", description: "Money Mag. Br. 8mm", price: "2600", qty: 10 },
    { name: "Bell Hanging", description: "Bell Hanging", price: "1500", qty: 10 },
    { name: "Selenite Tumble", description: "Selenite Tumble", price: "555", qty: 10 },
    { name: "Gomati", description: "Gomati", price: "555", qty: 10 },
    { name: "Lava Br.", description: "Lava Br.", price: "2100", qty: 10 },
    { name: "Copper Kada", description: "Copper Kada", price: "1700", qty: 5 },
    { name: "Pyrite Br.", description: "Pyrite Br.", price: "2200", qty: 5 },
    { name: "Crysocola Br. Diabetes", description: "Crysocola Br. Diabetes", price: "3200", qty: 5 },
    { name: "Sulemani Hakik", description: "Sulemani Hakik", price: "2100", qty: 10 },
    { name: "Navratan Mala", description: "Navratan Mala", price: "6111", qty: 10 },
    { name: "7 Stone Mala", description: "7 Stone Mala", price: "6111", qty: 10 },
    { name: "Black Tourm. Mala", description: "Black Tourm. Mala", price: "6111", qty: 10 },
    { name: "Zibu", description: "Zibu", price: "555", qty: 10 },
    { name: "Pyrite Zibu", description: "Pyrite Zibu", price: "555", qty: 10 },
    { name: "Pyrite Kasav", description: "Pyrite Kasav", price: "999", qty: 10 },
    { name: "Citrin Mala", description: "Citrin Mala", price: "10000", qty: 1 },
    { name: "Guasha", description: "Guasha", price: "1399", qty: 10 },
    { name: "7 Chakra Angle", description: "7 Chakra Angle", price: "1300", qty: 10 },
    { name: "Roller", description: "Roller", price: "1555", qty: 10 },
    { name: "Rudraksh Clear Mala", description: "Rudraksh Clear Mala", price: "9000", qty: 1 },
    { name: "Rose Quartz Mala", description: "Rose Quartz Mala", price: "4999", qty: 1 },
    { name: "Garnet Pendent", description: "Garnet Pendent", price: "1500", qty: 5 },
    { name: "Citrin Pyramid", description: "Citrin Pyramid", price: "1800", qty: 10 },
    { name: "Citrin Br.", description: "Citrin Br.", price: "4000", qty: 10 },
    { name: "Pixue Br.", description: "Pixue Br.", price: "5000", qty: 10 },
    { name: "5 Elements Br.", description: "5 Elements Br.", price: "3555", qty: 10 },
    { name: "Black Pixue", description: "Black Pixue", price: "7000", qty: 10 },
    { name: "Amber Pendent", description: "Amber Pendent", price: "2200", qty: 5 },
    { name: "Firoza", description: "Firoza", price: "4500", qty: 5 },
    { name: "Money Magnet 10mm", description: "Money Magnet 10mm", price: "3000", qty: 10 },
    { name: "Protection Coin", description: "Protection Coin", price: "1000", qty: 10 },
    { name: "Pyrite Chunk 200gm@22Rs", description: "Pyrite Chunk 200gm@22Rs", price: "4400", qty: 10 },
    { name: "Pyrite Chunk 195gm@22Rs", description: "Pyrite Chunk 195gm@22Rs", price: "4290", qty: 10 },
  ];

  for (const prod of sampleProducts) {
    const [inserted] = await db
      .insert(productsTable)
      .values({
        name: prod.name,
        description: prod.description,
        price: prod.price,
        availableQuantity: prod.qty,
      })
      .returning();

    // 3. Create Initial Inventory Transaction logs
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

  console.log(`Successfully seeded ${sampleProducts.length} products and inventory logs.`);
  console.log("Seeding completed successfully.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error seeding database:", err);
    process.exit(1);
  });
