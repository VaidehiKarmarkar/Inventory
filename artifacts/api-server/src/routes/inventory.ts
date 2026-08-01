import { Router } from "express";
import { db, inventoryTable, productsTable } from "@workspace/db";
import { eq, sql, ilike, and } from "drizzle-orm";
import { requireAuth, requireAdmin, getSessionUser } from "../middlewares/auth";

const router = Router();

router.get("/inventory", requireAuth, async (req, res): Promise<void> => {
  const productId = req.query.productId ? Number(req.query.productId) : undefined;
  const search = typeof req.query.search === "string" && req.query.search.trim() ? req.query.search.trim() : undefined;
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (productId) {
    conditions.push(eq(inventoryTable.productId, productId));
  }
  if (search) {
    conditions.push(ilike(inventoryTable.productName, `%${search}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inventoryTable)
    .where(whereClause);

  const data = await db
    .select({
      id: inventoryTable.id,
      productId: inventoryTable.productId,
      productName: inventoryTable.productName,
      previousQuantity: inventoryTable.previousQuantity,
      quantityAdded: inventoryTable.quantityAdded,
      quantityReduced: inventoryTable.quantityReduced,
      currentQuantity: inventoryTable.currentQuantity,
      actionType: inventoryTable.actionType,
      updatedById: inventoryTable.updatedById,
      updatedByName: sql<string | null>`(select name from users where id = ${inventoryTable.updatedById})`,
      updatedAt: inventoryTable.updatedAt,
    })
    .from(inventoryTable)
    .where(whereClause)
    .orderBy(sql`${inventoryTable.updatedAt} desc`)
    .limit(limit)
    .offset(offset);

  res.json({ data, total: totalRow.count, page, limit });
});

router.post("/inventory", requireAdmin, async (req, res): Promise<void> => {
  const { productId, quantity, actionType } = req.body;
  const pId = Number(productId);
  const qty = Number(quantity);

  if (!pId || isNaN(qty) || qty < 1) {
    res.status(400).json({ error: "Invalid product or quantity" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, pId));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const previous = product.availableQuantity;
  let current: number;

  if (actionType === "add") {
    current = previous + qty;
  } else {
    if (previous < qty) {
      res.status(400).json({ error: "Insufficient stock" });
      return;
    }
    current = previous - qty;
  }

  await db.update(productsTable).set({ availableQuantity: current }).where(eq(productsTable.id, pId));

  const user = await getSessionUser(req);

  const [txn] = await db.insert(inventoryTable).values({
    productId: pId,
    productName: product.name,
    previousQuantity: previous,
    quantityAdded: actionType === "add" ? qty : null,
    quantityReduced: actionType === "reduce" ? qty : null,
    currentQuantity: current,
    actionType: actionType || "add",
    updatedById: user?.id ?? null,
  }).returning();

  res.status(201).json({
    ...txn,
    updatedByName: user?.name ?? null,
  });
});

export default router;
