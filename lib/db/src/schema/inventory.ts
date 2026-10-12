import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { productsTable } from "./products";
import { usersTable } from "./users";

export const inventoryTable = sqliteTable("inventory_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  productName: text("product_name").notNull(),
  previousQuantity: integer("previous_quantity").notNull(),
  quantityAdded: integer("quantity_added"),
  quantityReduced: integer("quantity_reduced"),
  currentQuantity: integer("current_quantity").notNull(),
  actionType: text("action_type").notNull(), // add | reduce | order
  updatedById: integer("updated_by_id").references(() => usersTable.id),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const insertInventorySchema = createInsertSchema(inventoryTable).omit({ id: true, updatedAt: true });
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type InventoryTransaction = typeof inventoryTable.$inferSelect;
