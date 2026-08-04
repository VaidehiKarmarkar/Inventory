import { Router } from "express";
import { db, usersTable, productsTable, ordersTable, inventoryTable } from "@workspace/db";
import { sql, lte, gte, and, desc } from "drizzle-orm";
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
  const [lowStock] = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(and(sql`available_quantity > 0`, lte(productsTable.availableQuantity, 2)));

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

router.get("/dashboard/analytics", requireAuth, async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { dateFrom, dateTo } = req.query;
  const whereClauses: string[] = [];

  if (dateFrom && typeof dateFrom === "string" && dateFrom.trim()) {
    whereClauses.push(`o.created_at >= '${dateFrom.trim()} 00:00:00'`);
  }
  if (dateTo && typeof dateTo === "string" && dateTo.trim()) {
    whereClauses.push(`o.created_at <= '${dateTo.trim()} 23:59:59'`);
  }

  const orderWhereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Month-wise aggregation
  const monthWiseRaw = await db.execute(sql.raw(`
    SELECT
      to_char(o.created_at, 'YYYY-MM') AS month_key,
      to_char(o.created_at, 'Mon YYYY') AS month_label,
      count(*)::int AS order_count,
      coalesce(sum(o.grand_total::numeric), 0)::float AS revenue,
      coalesce(sum(o.paid_amount::numeric), 0)::float AS paid_amount,
      coalesce(sum(o.pending_amount::numeric), 0)::float AS pending_amount
    FROM orders o
    ${orderWhereSql}
    GROUP BY to_char(o.created_at, 'YYYY-MM'), to_char(o.created_at, 'Mon YYYY')
    ORDER BY month_key ASC
    LIMIT 12
  `));

  // Product-wise sales aggregation
  const productWiseRaw = await db.execute(sql.raw(`
    SELECT
      oi.product_id,
      oi.product_name,
      sum(oi.quantity)::int AS total_quantity_sold,
      coalesce(sum(oi.total::numeric), 0)::float AS total_revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    ${orderWhereSql}
    GROUP BY oi.product_id, oi.product_name
    ORDER BY total_quantity_sold DESC
    LIMIT 8
  `));

  // Summary Totals
  const summaryRaw = await db.execute(sql.raw(`
    SELECT
      count(*)::int AS total_orders,
      coalesce(sum(grand_total::numeric), 0)::float AS total_revenue,
      coalesce(sum(paid_amount::numeric), 0)::float AS total_paid,
      coalesce(sum(pending_amount::numeric), 0)::float AS total_pending
    FROM orders o
    ${orderWhereSql}
  `));

  const summaryRow = (summaryRaw.rows[0] as Record<string, unknown>) ?? { total_orders: 0, total_revenue: 0, total_paid: 0, total_pending: 0 };

  res.json({
    monthWise: monthWiseRaw.rows.map(r => ({
      monthKey: String(r.month_key),
      monthLabel: String(r.month_label),
      orderCount: Number(r.order_count),
      revenue: Number(r.revenue),
      paidAmount: Number(r.paid_amount),
      pendingAmount: Number(r.pending_amount),
    })),
    productWise: productWiseRaw.rows.map(r => ({
      productId: Number(r.product_id),
      productName: String(r.product_name),
      totalQuantitySold: Number(r.total_quantity_sold),
      totalRevenue: Number(r.total_revenue),
    })),
    summary: {
      totalOrders: Number(summaryRow.total_orders ?? 0),
      totalRevenue: Number(summaryRow.total_revenue ?? 0),
      totalPaid: Number(summaryRow.total_paid ?? 0),
      totalPending: Number(summaryRow.total_pending ?? 0),
    },
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
    .where(lte(productsTable.availableQuantity, 2))
    .orderBy(productsTable.availableQuantity)
    .limit(20);

  res.json(products.map(p => ({ ...p, price: Number(p.price) })));
});

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

router.get("/dashboard/export/excel", requireAuth, async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const orders = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
  const products = await db.select().from(productsTable).orderBy(productsTable.name);
  const inventoryLogs = await db.select().from(inventoryTable).orderBy(desc(inventoryTable.updatedAt));

  const monthWiseRaw = await db.execute(sql.raw(`
    SELECT
      to_char(o.created_at, 'Mon YYYY') AS month_label,
      count(*)::int AS order_count,
      coalesce(sum(o.grand_total::numeric), 0)::float AS revenue,
      coalesce(sum(o.paid_amount::numeric), 0)::float AS paid_amount,
      coalesce(sum(o.pending_amount::numeric), 0)::float AS pending_amount
    FROM orders o
    GROUP BY to_char(o.created_at, 'YYYY-MM'), to_char(o.created_at, 'Mon YYYY')
    ORDER BY to_char(o.created_at, 'YYYY-MM') DESC
  `));

  const lines: string[] = [];

  lines.push("\uFEFFALOHA CRYSTAL WORLD - MASTER SYSTEM BACKUP");
  lines.push(`Generated On: "${new Date().toLocaleString("en-IN")}"`);
  lines.push("");

  // SECTION 1: MONTHLY SALES SUMMARY
  lines.push("--- MONTHLY SALES & REVENUE SUMMARY ---");
  lines.push(["Month", "Total Orders", "Total Revenue (₹)", "Total Paid (₹)", "Pending Balance (₹)"].map(escapeCsv).join(","));
  for (const m of monthWiseRaw.rows as any[]) {
    lines.push([
      m.month_label,
      m.order_count,
      Number(m.revenue).toFixed(2),
      Number(m.paid_amount).toFixed(2),
      Number(m.pending_amount).toFixed(2),
    ].map(escapeCsv).join(","));
  }
  lines.push("");

  // SECTION 2: ALL ORDERS
  lines.push("--- ALL ORDERS & INVOICES ---");
  lines.push([
    "Invoice No", "Date", "Customer Name", "Customer Mobile", "Customer Email",
    "Customer Address", "Payment Method", "Subtotal (₹)", "GST (%)", "GST Amount (₹)",
    "Discount (₹)", "Referral Charges (₹)", "Grand Total (₹)", "Paid Amount (₹)",
    "Pending Balance (₹)", "Status"
  ].map(escapeCsv).join(","));

  for (const o of orders) {
    lines.push([
      o.invoiceNumber,
      new Date(o.createdAt).toLocaleString("en-IN"),
      o.customerName,
      o.customerMobile,
      o.customerEmail || "",
      o.customerAddress || "",
      o.paymentMethod || "Cash",
      Number(o.subtotal).toFixed(2),
      Number(o.gstPercentage),
      Number(o.gstAmount).toFixed(2),
      Number(o.discount).toFixed(2),
      Number(o.referralCharges).toFixed(2),
      Number(o.grandTotal).toFixed(2),
      Number(o.paidAmount).toFixed(2),
      Number(o.pendingAmount).toFixed(2),
      o.status,
    ].map(escapeCsv).join(","));
  }
  lines.push("");

  // SECTION 3: PRODUCTS & INVENTORY DATA
  lines.push("--- PRODUCTS & STOCK INVENTORY DATA ---");
  lines.push([
    "Product ID", "Product Name", "Description", "Unit Price (₹)", "Available Stock Quantity",
    "Total Stock Value (₹)", "Stock Status"
  ].map(escapeCsv).join(","));

  for (const p of products) {
    const qty = p.availableQuantity;
    const price = Number(p.price);
    const stockValue = qty * price;
    const stockStatus = qty === 0 ? "Out of Stock" : qty <= 2 ? "Low Stock" : "In Stock";

    lines.push([
      p.id,
      p.name,
      p.description || "",
      price.toFixed(2),
      qty,
      stockValue.toFixed(2),
      stockStatus,
    ].map(escapeCsv).join(","));
  }
  lines.push("");

  // SECTION 4: INVENTORY TRANSACTIONS / AUDIT LOGS
  lines.push("--- INVENTORY MOVEMENT LOGS ---");
  lines.push([
    "Log ID", "Product Name", "Previous Qty", "Quantity Added", "Quantity Reduced",
    "Current Qty", "Action Type", "Timestamp"
  ].map(escapeCsv).join(","));

  for (const l of inventoryLogs) {
    lines.push([
      l.id,
      l.productName,
      l.previousQuantity,
      l.quantityAdded || 0,
      l.quantityReduced || 0,
      l.currentQuantity,
      l.actionType,
      new Date(l.updatedAt).toLocaleString("en-IN"),
    ].map(escapeCsv).join(","));
  }

  const csvContent = lines.join("\n");
  const filename = `Aloha_Crystal_World_Full_Backup_${new Date().toISOString().split("T")[0]}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csvContent);
});

router.get("/dashboard/export/orders", requireAuth, async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const orders = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
  const lines: string[] = [];

  lines.push("\uFEFFInvoice No,Date,Customer Name,Customer Mobile,Customer Email,Customer Address,Payment Method,Subtotal (₹),GST (%),GST Amount (₹),Discount (₹),Referral Charges (₹),Grand Total (₹),Paid Amount (₹),Pending Balance (₹),Status");

  for (const o of orders) {
    lines.push([
      o.invoiceNumber,
      new Date(o.createdAt).toLocaleString("en-IN"),
      o.customerName,
      o.customerMobile,
      o.customerEmail || "",
      o.customerAddress || "",
      o.paymentMethod || "Cash",
      Number(o.subtotal).toFixed(2),
      Number(o.gstPercentage),
      Number(o.gstAmount).toFixed(2),
      Number(o.discount).toFixed(2),
      Number(o.referralCharges).toFixed(2),
      Number(o.grandTotal).toFixed(2),
      Number(o.paidAmount).toFixed(2),
      Number(o.pendingAmount).toFixed(2),
      o.status,
    ].map(escapeCsv).join(","));
  }

  const filename = `All_Orders_${new Date().toISOString().split("T")[0]}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(lines.join("\n"));
});

router.get("/dashboard/export/inventory", requireAuth, async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const products = await db.select().from(productsTable).orderBy(productsTable.name);
  const lines: string[] = [];

  lines.push("\uFEFFProduct ID,Product Name,Description,Unit Price (₹),Available Stock Quantity,Total Stock Value (₹),Stock Status");

  for (const p of products) {
    const qty = p.availableQuantity;
    const price = Number(p.price);
    const stockValue = qty * price;
    const stockStatus = qty === 0 ? "Out of Stock" : qty <= 2 ? "Low Stock" : "In Stock";

    lines.push([
      p.id,
      p.name,
      p.description || "",
      price.toFixed(2),
      qty,
      stockValue.toFixed(2),
      stockStatus,
    ].map(escapeCsv).join(","));
  }

  const filename = `Products_Inventory_${new Date().toISOString().split("T")[0]}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(lines.join("\n"));
});

export default router;
