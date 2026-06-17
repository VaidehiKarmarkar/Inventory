import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";
import { usersTable } from "./users";

export const inventoryTable = pgTable("inventory_transactions", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  productName: text("product_name").notNull(),
  previousQuantity: integer("previous_quantity").notNull(),
  quantityAdded: integer("quantity_added"),
  quantityReduced: integer("quantity_reduced"),
  currentQuantity: integer("current_quantity").notNull(),
  actionType: text("action_type").notNull(), // add | reduce | order
  updatedById: integer("updated_by_id").references(() => usersTable.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInventorySchema = createInsertSchema(inventoryTable).omit({ id: true, updatedAt: true });
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type InventoryTransaction = typeof inventoryTable.$inferSelect;
