import { Router } from "express";
import { db, usersTable, productsTable, ordersTable, inventoryTable } from "@workspace/db";
import { sql, lt, gte, and } from "drizzle-orm";
import { requireAuth, getSessionUser } from "../middlewares/auth";

const router = Router();

router.get("/dashboard/admin", requireAuth, async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalProducts] = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable);
  const [totalInventory] = await db.select({ sum: sql<number>`coalesce(sum(available_quantity), 0)::int` }).from(productsTable);
  const [totalOrders] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable);
  const [todaySalesRow] = await db.select({ sum: sql<number>`coalesce(sum(grand_total::numeric), 0)::float` }).from(ordersTable).where(gte(ordersTable.createdAt, todayStart));
  const [monthlySalesRow] = await db.select({ sum: sql<number>`coalesce(sum(grand_total::numeric), 0)::float` }).from(ordersTable).where(gte(ordersTable.createdAt, monthStart));
  const [totalUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
  const [outOfStock] = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(sql`available_quantity = 0`);
  const [lowStock] = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(and(sql`available_quantity > 0`, lt(productsTable.availableQuantity, 10)));

  res.json({
    totalProducts: totalProducts.count,
    totalInventory: totalInventory.sum,
    totalOrders: totalOrders.count,
    todaySales: todaySalesRow.sum,
    monthlySales: monthlySalesRow.sum,
    totalUsers: totalUsers.count,
    outOfStockCount: outOfStock.count,
    lowStockCount: lowStock.count,
  });
});

router.get("/dashboard/user", requireAuth, async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [ordersToday] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(
    and(sql`created_by_id = ${user.id}`, gte(ordersTable.createdAt, todayStart))
  );
  const [totalOrders] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(sql`created_by_id = ${user.id}`);
  const [totalRevenue] = await db.select({ sum: sql<number>`coalesce(sum(grand_total::numeric), 0)::float` }).from(ordersTable).where(sql`created_by_id = ${user.id}`);

  res.json({
    ordersToday: ordersToday.count,
    totalOrders: totalOrders.count,
    totalRevenue: totalRevenue.sum,
  });
});

router.get("/dashboard/recent-orders", requireAuth, async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const orders = await db
    .select({
      id: ordersTable.id,
      invoiceNumber: ordersTable.invoiceNumber,
      customerName: ordersTable.customerName,
      customerMobile: ordersTable.customerMobile,
      customerEmail: ordersTable.customerEmail,
      customerAddress: ordersTable.customerAddress,
      subtotal: ordersTable.subtotal,
      gstPercentage: ordersTable.gstPercentage,
      gstAmount: ordersTable.gstAmount,
      referralCharges: ordersTable.referralCharges,
      discount: ordersTable.discount,
      grandTotal: ordersTable.grandTotal,
      paidAmount: ordersTable.paidAmount,
      pendingAmount: ordersTable.pendingAmount,
      status: ordersTable.status,
      createdById: ordersTable.createdById,
      createdByName: usersTable.name,
      createdAt: ordersTable.createdAt,
    })
    .from(ordersTable)
    .leftJoin(usersTable, sql`${ordersTable.createdById} = ${usersTable.id}`)
    .orderBy(sql`${ordersTable.createdAt} desc`)
    .limit(10);

  res.json(orders.map(o => ({
    ...o,
    subtotal: Number(o.subtotal),
    gstPercentage: Number(o.gstPercentage),
    gstAmount: Number(o.gstAmount),
    referralCharges: Number(o.referralCharges),
    discount: Number(o.discount),
    grandTotal: Number(o.grandTotal),
    paidAmount: Number(o.paidAmount),
    pendingAmount: Number(o.pendingAmount),
  })));
});

router.get("/dashboard/low-stock", requireAuth, async (req, res): Promise<void> => {
  const products = await db
    .select()
    .from(productsTable)
    .where(lt(productsTable.availableQuantity, 10))
    .orderBy(productsTable.availableQuantity)
    .limit(20);

  res.json(products.map(p => ({ ...p, price: Number(p.price) })));
});

export default router;
