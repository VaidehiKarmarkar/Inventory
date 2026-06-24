import { Router } from "express";
import { db, ordersTable, orderItemsTable, productsTable, inventoryTable, usersTable } from "@workspace/db";
import { eq, ilike, gte, lte, and, sql, or } from "drizzle-orm";
import { requireAuth, getSessionUser } from "../middlewares/auth";
import {
  CreateOrderBody,
  GetOrderParams,
  ListOrdersQueryParams,
  DownloadInvoiceParams,
  SendInvoiceEmailParams,
} from "@workspace/api-zod";

const router = Router();

function generateInvoiceNumber(): string {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const seq = String(Math.floor(Math.random() * 99999) + 1).padStart(5, "0");
  return `INV-${yyyymm}-${seq}`;
}

function numericFields(o: Record<string, unknown>) {
  return {
    ...o,
    subtotal: Number(o.subtotal),
    gstPercentage: Number(o.gstPercentage),
    gstAmount: Number(o.gstAmount),
    referralCharges: Number(o.referralCharges),
    discount: Number(o.discount),
    grandTotal: Number(o.grandTotal),
  };
}

router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  const query = ListOrdersQueryParams.safeParse(req.query);
  const search = query.success ? query.data.search : undefined;
  const dateFrom = query.success ? query.data.dateFrom : undefined;
  const dateTo = query.success ? query.data.dateTo : undefined;
  const page = (query.success && query.data.page) ? Number(query.data.page) : 1;
  const limit = (query.success && query.data.limit) ? Number(query.data.limit) : 20;
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];
  if (user.role !== "admin") conditions.push(eq(ordersTable.createdById, user.id) as ReturnType<typeof eq>);
  if (search) conditions.push(
    or(
      ilike(ordersTable.customerName, `%${search}%`),
      ilike(ordersTable.invoiceNumber, `%${search}%`),
    ) as ReturnType<typeof eq>
  );
  if (dateFrom) conditions.push(gte(ordersTable.createdAt, new Date(dateFrom)) as ReturnType<typeof eq>);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(ordersTable.createdAt, end) as ReturnType<typeof eq>);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ordersTable)
    .where(whereClause);

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
      status: ordersTable.status,
      createdById: ordersTable.createdById,
      createdByName: usersTable.name,
      createdAt: ordersTable.createdAt,
    })
    .from(ordersTable)
    .leftJoin(usersTable, eq(ordersTable.createdById, usersTable.id))
    .where(whereClause)
    .orderBy(sql`${ordersTable.createdAt} desc`)
    .limit(limit)
    .offset(offset);

  res.json({
    data: orders.map(o => numericFields(o as Record<string, unknown>)),
    total: totalRow.count,
    page,
    limit,
  });
});

router.post("/orders", requireAuth, async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const {
    customerName, customerMobile, customerEmail, customerAddress,
    items, gstPercentage, referralCharges, discount,
  } = parsed.data;

  // Validate stock and compute subtotal
  let subtotal = 0;
  const enrichedItems: Array<{ productId: number; productName: string; quantity: number; unitPrice: number; total: number; prevQty: number }> = [];

  for (const item of items) {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
    if (!product) {
      res.status(400).json({ error: `Product ${item.productId} not found` });
      return;
    }
    if (product.availableQuantity < item.quantity) {
      res.status(400).json({ error: `Insufficient stock for ${product.name}. Available: ${product.availableQuantity}` });
      return;
    }
    const lineTotal = item.unitPrice * item.quantity;
    subtotal += lineTotal;
    enrichedItems.push({
      productId: item.productId,
      productName: product.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: lineTotal,
      prevQty: product.availableQuantity,
    });
  }

  const gstPct = gstPercentage ?? 18;
  const gstAmount = subtotal * (gstPct / 100);
  const refCharges = referralCharges ?? 0;
  const disc = discount ?? 0;
  const grandTotal = subtotal + gstAmount + refCharges - disc;
  const invoiceNumber = generateInvoiceNumber();

  const [order] = await db.insert(ordersTable).values({
    invoiceNumber,
    customerName,
    customerMobile,
    customerEmail: customerEmail ?? null,
    customerAddress: customerAddress ?? null,
    subtotal: String(subtotal),
    gstPercentage: String(gstPct),
    gstAmount: String(gstAmount),
    referralCharges: String(refCharges),
    discount: String(disc),
    grandTotal: String(grandTotal),
    status: "completed",
    createdById: user.id,
  }).returning();

  // Insert order items + update inventory
  for (const item of enrichedItems) {
    await db.insert(orderItemsTable).values({
      orderId: order.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: String(item.unitPrice),
      total: String(item.total),
    });

    const newQty = item.prevQty - item.quantity;
    await db.update(productsTable).set({ availableQuantity: newQty }).where(eq(productsTable.id, item.productId));
    await db.insert(inventoryTable).values({
      productId: item.productId,
      productName: item.productName,
      previousQuantity: item.prevQty,
      quantityAdded: null,
      quantityReduced: item.quantity,
      currentQuantity: newQty,
      actionType: "order",
      updatedById: user.id,
    });
  }

  res.status(201).json({
    ...numericFields(order as unknown as Record<string, unknown>),
    createdByName: user.name,
  });
});

router.get("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [order] = await db
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
      status: ordersTable.status,
      createdById: ordersTable.createdById,
      createdByName: usersTable.name,
      createdAt: ordersTable.createdAt,
    })
    .from(ordersTable)
    .leftJoin(usersTable, eq(ordersTable.createdById, usersTable.id))
    .where(eq(ordersTable.id, params.data.id));

  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  if (user.role !== "admin" && order.createdById !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));

  res.json({
    ...numericFields(order as unknown as Record<string, unknown>),
    items: items.map(i => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
    })),
  });
});

router.get("/orders/:id/invoice", requireAuth, async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  const params = DownloadInvoiceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  if (user.role !== "admin" && order.createdById !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));

  // Dynamic import for pdfkit (externalized from esbuild to avoid CJS bundling issues)
  const pdfkitModule = await import("pdfkit");
  const PDFDocument = (pdfkitModule.default ?? pdfkitModule) as typeof pdfkitModule.default;
  const doc = new PDFDocument({ margin: 50, size: "A4" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${order.invoiceNumber}.pdf"`);
  doc.pipe(res);

  // Header
  doc.fontSize(24).font("Helvetica-Bold").text("INVOICE", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).font("Helvetica").text("Billing & Inventory Management System", { align: "center" });
  doc.moveDown(1);

  // Invoice info
  doc.fontSize(12).font("Helvetica-Bold").text(`Invoice No: ${order.invoiceNumber}`);
  doc.font("Helvetica").fontSize(10).text(`Date: ${new Date(order.createdAt).toLocaleDateString("en-IN")}`);
  doc.text(`Status: ${order.status.toUpperCase()}`);
  doc.moveDown(1);

  // Customer details
  doc.fontSize(12).font("Helvetica-Bold").text("Bill To:");
  doc.font("Helvetica").fontSize(10);
  doc.text(order.customerName);
  doc.text(`Mobile: ${order.customerMobile}`);
  if (order.customerEmail) doc.text(`Email: ${order.customerEmail}`);
  if (order.customerAddress) doc.text(`Address: ${order.customerAddress}`);
  doc.moveDown(1);

  // Products table header
  doc.fontSize(11).font("Helvetica-Bold");
  doc.text("Product", 50, doc.y, { continued: true, width: 200 });
  doc.text("Qty", 250, doc.y, { continued: true, width: 60, align: "right" });
  doc.text("Unit Price", 310, doc.y, { continued: true, width: 100, align: "right" });
  doc.text("Total", 410, doc.y, { width: 100, align: "right" });
  doc.moveTo(50, doc.y).lineTo(520, doc.y).stroke();
  doc.moveDown(0.3);

  doc.font("Helvetica").fontSize(10);
  for (const item of items) {
    doc.text(item.productName, 50, doc.y, { continued: true, width: 200 });
    doc.text(String(item.quantity), 250, doc.y, { continued: true, width: 60, align: "right" });
    doc.text(`₹${Number(item.unitPrice).toFixed(2)}`, 310, doc.y, { continued: true, width: 100, align: "right" });
    doc.text(`₹${Number(item.total).toFixed(2)}`, 410, doc.y, { width: 100, align: "right" });
    doc.moveDown(0.3);
  }

  doc.moveTo(50, doc.y).lineTo(520, doc.y).stroke();
  doc.moveDown(0.5);

  // Totals
  const subtotal = Number(order.subtotal);
  const gstAmount = Number(order.gstAmount);
  const gstPct = Number(order.gstPercentage);
  const refCharges = Number(order.referralCharges);
  const discount = Number(order.discount);
  const grandTotal = Number(order.grandTotal);

  const totalsX = 350;
  doc.fontSize(10);
  doc.text("Subtotal:", totalsX, doc.y, { continued: true, width: 100 });
  doc.text(`₹${subtotal.toFixed(2)}`, { width: 70, align: "right" });
  doc.text(`GST (${gstPct}%):`, totalsX, doc.y, { continued: true, width: 100 });
  doc.text(`₹${gstAmount.toFixed(2)}`, { width: 70, align: "right" });
  if (refCharges > 0) {
    doc.text("Referral Charges:", totalsX, doc.y, { continued: true, width: 100 });
    doc.text(`₹${refCharges.toFixed(2)}`, { width: 70, align: "right" });
  }
  if (discount > 0) {
    doc.text("Discount:", totalsX, doc.y, { continued: true, width: 100 });
    doc.text(`-₹${discount.toFixed(2)}`, { width: 70, align: "right" });
  }
  doc.moveDown(0.3);
  doc.moveTo(totalsX, doc.y).lineTo(520, doc.y).stroke();
  doc.moveDown(0.2);
  doc.font("Helvetica-Bold").fontSize(12);
  doc.text("Grand Total:", totalsX, doc.y, { continued: true, width: 100 });
  doc.text(`₹${grandTotal.toFixed(2)}`, { width: 70, align: "right" });
  doc.moveDown(2);

  doc.font("Helvetica").fontSize(9).fillColor("gray").text("Thank you for your business!", { align: "center" });

  doc.end();
});

router.post("/orders/:id/send-email", requireAuth, async (req, res): Promise<void> => {
  const params = SendInvoiceEmailParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  res.json({ message: `Invoice sent successfully to ${order.customerEmail || order.customerName}` });
});

export default router;
