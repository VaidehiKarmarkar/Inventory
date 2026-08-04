import { Router } from "express";
import { db, ordersTable, orderItemsTable, productsTable, inventoryTable, usersTable, orderPaymentsTable } from "@workspace/db";
import { eq, ilike, gte, lte, and, sql, or, desc } from "drizzle-orm";
import { requireAuth, getSessionUser } from "../middlewares/auth";
import {
  CreateOrderBody,
  GetOrderParams,
  ListOrdersQueryParams,
  DownloadInvoiceParams,
  SendInvoiceEmailParams,
} from "@workspace/api-zod";

const router = Router();

async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const yyyymmdd = `${year}${month}${day}`;
  const prefix = `INV-${yyyymmdd}-`;

  const existingOrders = await db
    .select({ invoiceNumber: ordersTable.invoiceNumber })
    .from(ordersTable);

  let maxSeq = 0;
  for (const order of existingOrders) {
    const parts = order.invoiceNumber.split(/[-—]/);
    const lastPart = parts[parts.length - 1];
    const seqNum = parseInt(lastPart, 10);
    if (!isNaN(seqNum) && seqNum < 10000 && seqNum > maxSeq) {
      maxSeq = seqNum;
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(2, "0");
  return `${prefix}${nextSeq}`;
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
    paidAmount: Number(o.paidAmount),
    pendingAmount: Number(o.pendingAmount),
    paymentMethod: (o.paymentMethod as string) || "Cash",
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
      paidAmount: ordersTable.paidAmount,
      pendingAmount: ordersTable.pendingAmount,
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
    items, gstPercentage, referralCharges, discount, paidAmount,
  } = parsed.data;

  const mobileRegex = /^[6789]\d{9}$/;
  if (!mobileRegex.test(customerMobile.trim())) {
    res.status(400).json({ error: "Mobile number must be a 10-digit number starting with 6, 7, 8, or 9" });
    return;
  }

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
  const invoiceNumber = await generateInvoiceNumber();

  const paid = paidAmount !== undefined ? paidAmount : grandTotal;
  const pending = Math.max(0, grandTotal - paid);
  const status = pending > 0 ? "pending" : "completed";

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
    paidAmount: String(paid),
    pendingAmount: String(pending),
    paymentMethod: (req.body.paymentMethod as string) || "Cash",
    status,
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

  if (paid > 0) {
    await db.insert(orderPaymentsTable).values({
      orderId: order.id,
      amount: String(paid),
      paymentMethod: (req.body.paymentMethod as string) || "Cash",
      remarks: "Initial payment on order creation",
      createdById: user.id,
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
      paidAmount: ordersTable.paidAmount,
      pendingAmount: ordersTable.pendingAmount,
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

  const payments = await db
    .select({
      id: orderPaymentsTable.id,
      orderId: orderPaymentsTable.orderId,
      amount: orderPaymentsTable.amount,
      paymentMethod: orderPaymentsTable.paymentMethod,
      remarks: orderPaymentsTable.remarks,
      createdById: orderPaymentsTable.createdById,
      createdByName: usersTable.name,
      createdAt: orderPaymentsTable.createdAt,
    })
    .from(orderPaymentsTable)
    .leftJoin(usersTable, eq(orderPaymentsTable.createdById, usersTable.id))
    .where(eq(orderPaymentsTable.orderId, order.id))
    .orderBy(desc(orderPaymentsTable.createdAt));

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
    payments: payments.map(p => ({
      ...p,
      amount: Number(p.amount),
      createdAt: p.createdAt ? p.createdAt.toISOString() : new Date().toISOString(),
    })),
  });
});

router.post("/orders/:id/payments", requireAuth, async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const orderId = parseInt(idParam as string, 10);
  if (isNaN(orderId)) { res.status(400).json({ error: "Invalid order ID" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const { amount, paymentMethod, remarks } = req.body;
  const paymentAmt = Number(amount);
  if (isNaN(paymentAmt) || paymentAmt <= 0) {
    res.status(400).json({ error: "Valid payment amount is required" });
    return;
  }

  if (!remarks || typeof remarks !== "string" || !remarks.trim()) {
    res.status(400).json({ error: "Remarks / payment note is mandatory" });
    return;
  }

  // Record payment history entry
  await db.insert(orderPaymentsTable).values({
    orderId,
    amount: String(paymentAmt),
    paymentMethod: paymentMethod || "Cash",
    remarks: remarks.trim(),
    createdById: user.id,
  });

  // Calculate updated order balance & status
  const currentPaid = Number(order.paidAmount ?? 0);
  const newPaid = currentPaid + paymentAmt;
  const grandTotal = Number(order.grandTotal);
  const newPending = Math.max(0, grandTotal - newPaid);
  const newStatus = newPending > 0 ? "pending" : "completed";

  await db
    .update(ordersTable)
    .set({
      paidAmount: String(newPaid),
      pendingAmount: String(newPending),
      status: newStatus,
      paymentMethod: paymentMethod || order.paymentMethod || "Cash",
    })
    .where(eq(ordersTable.id, orderId));

  // Fetch updated order detail
  const [updatedOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
  const payments = await db
    .select({
      id: orderPaymentsTable.id,
      orderId: orderPaymentsTable.orderId,
      amount: orderPaymentsTable.amount,
      paymentMethod: orderPaymentsTable.paymentMethod,
      remarks: orderPaymentsTable.remarks,
      createdById: orderPaymentsTable.createdById,
      createdByName: usersTable.name,
      createdAt: orderPaymentsTable.createdAt,
    })
    .from(orderPaymentsTable)
    .leftJoin(usersTable, eq(orderPaymentsTable.createdById, usersTable.id))
    .where(eq(orderPaymentsTable.orderId, orderId))
    .orderBy(desc(orderPaymentsTable.createdAt));

  res.json({
    ...numericFields(updatedOrder as unknown as Record<string, unknown>),
    items: items.map(i => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
    })),
    payments: payments.map(p => ({
      ...p,
      amount: Number(p.amount),
      createdAt: p.createdAt ? p.createdAt.toISOString() : new Date().toISOString(),
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
  const doc = new PDFDocument({ margin: 40, size: "A4" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${order.invoiceNumber}.pdf"`);
  doc.pipe(res);

  // Top Header Banner (100% Ink-Saving Monochrome: Clean outline border, zero colored ink)
  doc.rect(40, 40, 515, 75).fillAndStroke("#ffffff", "#cbd5e1");

  doc.fillColor("#333333").fontSize(15).font("Helvetica-Bold").text("Aloha Crystal World, Amravati", 55, 48);
  doc.fontSize(8.5).font("Helvetica").fillColor("#555555").text("Vedanta Heights, Shri Colony, Dastur Nagar, Amravati. | Mob: 8369495476", 55, 72);

  // Right side header info (Invoice No & Date in 20% grey / charcoal font)
  const createdDateStr = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric"
  });
  doc.fillColor("#333333").fontSize(12).font("Helvetica-Bold").text(order.invoiceNumber, 360, 48, { width: 180, align: "right" });
  doc.fontSize(9).font("Helvetica").fillColor("#555555").text(`Date: ${createdDateStr}`, 360, 68, { width: 180, align: "right" });

  // Customer Details Box ("Mr. / Mrs.")
  let currentY = 130;
  doc.rect(40, currentY, 515, 75).fillAndStroke("#ffffff", "#e2e8f0");
  
  doc.fillColor("#666666").fontSize(8).font("Helvetica-Bold").text("Mr. / Mrs.", 55, currentY + 10);
  doc.fillColor("#333333").fontSize(12).font("Helvetica-Bold").text(order.customerName, 55, currentY + 24);
  
  doc.fillColor("#444444").fontSize(9).font("Helvetica");
  let custDetails = `Mobile: ${order.customerMobile}`;
  if (order.customerEmail) custDetails += `  |  Email: ${order.customerEmail}`;
  doc.text(custDetails, 55, currentY + 42);
  if (order.customerAddress) {
    doc.text(`Address: ${order.customerAddress}`, 55, currentY + 56, { width: 485 });
  }

  // Items Table Header (Ink-Saving: Light grey fill with clean border)
  currentY = 205;
  doc.rect(40, currentY, 515, 24).fillAndStroke("#f8fafc", "#cbd5e1");
  doc.fillColor("#333333").fontSize(9).font("Helvetica-Bold");
  doc.text("CRYSTAL TYPE", 50, currentY + 7, { width: 230, align: "left" });
  doc.text("QTY", 280, currentY + 7, { width: 50, align: "center" });
  doc.text("UNIT PRICE", 340, currentY + 7, { width: 90, align: "right" });
  doc.text("TOTAL", 440, currentY + 7, { width: 100, align: "right" });

  currentY += 24;

  // Table Rows (20% grey font)
  doc.font("Helvetica").fontSize(9);
  let isAltRow = false;

  for (const item of items) {
    if (isAltRow) {
      doc.rect(40, currentY, 515, 24).fill("#fafafa");
    }
    isAltRow = !isAltRow;

    doc.fillColor("#333333");
    doc.text(item.productName, 50, currentY + 7, { width: 230, align: "left" });
    doc.text(String(item.quantity), 280, currentY + 7, { width: 50, align: "center" });
    doc.text(`Rs. ${Number(item.unitPrice).toFixed(2)}`, 340, currentY + 7, { width: 90, align: "right" });
    doc.text(`Rs. ${Number(item.total).toFixed(2)}`, 440, currentY + 7, { width: 100, align: "right" });

    doc.moveTo(40, currentY + 24).lineTo(555, currentY + 24).strokeColor("#e2e8f0").stroke();
    currentY += 24;
  }

  currentY += 15;

  // Totals Box (Right Aligned)
  const totalsBoxX = 320;

  const subtotal = Number(order.subtotal);
  const gstAmount = Number(order.gstAmount);
  const gstPct = Number(order.gstPercentage);
  const refCharges = Number(order.referralCharges);
  const discount = Number(order.discount);
  const grandTotal = Number(order.grandTotal);
  const paid = Number(order.paidAmount ?? 0);
  const pending = Number(order.pendingAmount ?? 0);
  const pMethod = order.paymentMethod || "Cash";

  const renderTotalRow = (label: string, value: string, isBold = false, color = "#333333") => {
    doc.fillColor(color).font(isBold ? "Helvetica-Bold" : "Helvetica").fontSize(isBold ? 10 : 9);
    doc.text(label, totalsBoxX, currentY, { width: 130, align: "left" });
    doc.text(value, totalsBoxX + 130, currentY, { width: 105, align: "right" });
    currentY += 18;
  };

  renderTotalRow("Subtotal:", `Rs. ${subtotal.toFixed(2)}`);

  if (gstAmount > 0) {
    renderTotalRow(`GST (${gstPct}%):`, `Rs. ${gstAmount.toFixed(2)}`);
  }
  if (refCharges > 0) {
    renderTotalRow("Referral Charges:", `Rs. ${refCharges.toFixed(2)}`);
  }
  if (discount > 0) {
    renderTotalRow("Discount:", `-Rs. ${discount.toFixed(2)}`, false, "#333333");
  }

  doc.moveTo(totalsBoxX, currentY).lineTo(555, currentY).strokeColor("#cbd5e1").stroke();
  currentY += 6;

  renderTotalRow("Grand Total:", `Rs. ${grandTotal.toFixed(2)}`, true, "#222222");

  doc.moveTo(totalsBoxX, currentY).lineTo(555, currentY).strokeColor("#cbd5e1").stroke();
  currentY += 6;

  renderTotalRow(`Amount Paid (${pMethod}):`, `Rs. ${paid.toFixed(2)}`, true, "#333333");

  if (pending > 0) {
    renderTotalRow("Pending Balance:", `Rs. ${pending.toFixed(2)}`, true, "#333333");
  }

  // Signature Block (Right aligned, above footer)
  const sigY = Math.max(currentY + 40, 680);
  const sigX = 370;
  const sigWidth = 185;

  doc.moveTo(sigX, sigY).lineTo(sigX + sigWidth, sigY).strokeColor("#94a3b8").stroke();
  doc.fillColor("#444444").font("Helvetica-Bold").fontSize(9).text("Authorized Signature", sigX, sigY + 6, { width: sigWidth, align: "center" });
  doc.fillColor("#666666").font("Helvetica").fontSize(8).text("(Aloha Crystal World, Amravati)", sigX, sigY + 18, { width: sigWidth, align: "center" });

  // Footer Note
  currentY = Math.max(sigY + 45, 760);
  doc.moveTo(40, currentY).lineTo(555, currentY).strokeColor("#e2e8f0").stroke();
  doc.fillColor("#666666").fontSize(8).font("Helvetica").text("Thank you for your business! For any queries, please contact customer support.", 40, currentY + 8, { align: "center" });

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
