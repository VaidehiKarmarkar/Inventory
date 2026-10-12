import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

export const ordersTable = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceNumber: text("invoice_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  customerMobile: text("customer_mobile").notNull(),
  customerEmail: text("customer_email"),
  customerAddress: text("customer_address"),
  subtotal: text("subtotal").notNull(),
  gstPercentage: text("gst_percentage").notNull().default("0"),
  gstAmount: text("gst_amount").notNull(),
  referralCharges: text("referral_charges").notNull().default("0"),
  discount: text("discount").notNull().default("0"),
  grandTotal: text("grand_total").notNull(),
  paidAmount: text("paid_amount").notNull().default("0"),
  pendingAmount: text("pending_amount").notNull().default("0"),
  paymentMethod: text("payment_method").notNull().default("Cash"),
  status: text("status").notNull().default("completed"),
  createdById: integer("created_by_id").references(() => usersTable.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
