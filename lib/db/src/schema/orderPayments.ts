import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { ordersTable } from "./orders";
import { usersTable } from "./users";

export const orderPaymentsTable = sqliteTable("order_payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  amount: text("amount").notNull(),
  paymentMethod: text("payment_method").notNull().default("Cash"),
  remarks: text("remarks").notNull(),
  createdById: integer("created_by_id").references(() => usersTable.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const insertOrderPaymentSchema = createInsertSchema(orderPaymentsTable).omit({ id: true, createdAt: true });
export type InsertOrderPayment = z.infer<typeof insertOrderPaymentSchema>;
export type OrderPayment = typeof orderPaymentsTable.$inferSelect;
