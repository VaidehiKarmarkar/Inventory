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
    { name: "Premium Leather Notebook", description: "A5, grid paper, 160 pages", price: "24.99", qty: 45 },
    { name: "Gel Pen Box (Black)", description: "0.5mm needle point, smooth flow, pack of 12", price: "12.50", qty: 80 },
    { name: "Ergonomic Office Chair", description: "High-back mesh chair with lumbar support", price: "189.99", qty: 8 },
    { name: "Mechanical Keyboard", description: "RGB backlight, blue tactile switches", price: "79.00", qty: 15 },
    { name: "Aluminum Laptop Stand", description: "Adjustable height, non-slip design", price: "34.50", qty: 25 },
    { name: "Matte Black Desk Pad", description: "Vegan leather, water-resistant, 80x40cm", price: "19.99", qty: 5 }, // Low stock (5 < 10)
    { name: "USB-C Multiport Hub", description: "6-in-1 adapter with HDMI, USB 3.0, and PD", price: "45.00", qty: 30 },
    { name: "Wireless Charging Pad", description: "15W fast charging, Qi-compatible", price: "29.99", qty: 0 }, // Out of stock
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
