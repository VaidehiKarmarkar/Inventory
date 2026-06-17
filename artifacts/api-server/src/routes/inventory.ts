import { Router } from "express";
import { db, inventoryTable, productsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireAdmin, getSessionUser } from "../middlewares/auth";
import {
  AdjustInventoryBody,
  ListInventoryQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/inventory", requireAuth, async (req, res): Promise<void> => {
  const query = ListInventoryQueryParams.safeParse(req.query);
  const productId = query.success && query.data.productId ? Number(query.data.productId) : undefined;
  const page = (query.success && query.data.page) ? Number(query.data.page) : 1;
  const limit = (query.success && query.data.limit) ? Number(query.data.limit) : 20;
  const offset = (page - 1) * limit;

  const condition = productId ? eq(inventoryTable.productId, productId) : undefined;

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inventoryTable)
    .where(condition);

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
    .where(condition)
    .orderBy(sql`${inventoryTable.updatedAt} desc`)
    .limit(limit)
    .offset(offset);

  res.json({ data, total: totalRow.count, page, limit });
});

router.post("/inventory", requireAdmin, async (req, res): Promise<void> => {
  const parsed = AdjustInventoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { productId, quantity, actionType } = parsed.data;

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const previous = product.availableQuantity;
  let current: number;

  if (actionType === "add") {
    current = previous + quantity;
  } else {
    if (previous < quantity) {
      res.status(400).json({ error: "Insufficient stock" });
      return;
    }
    current = previous - quantity;
  }

  await db.update(productsTable).set({ availableQuantity: current }).where(eq(productsTable.id, productId));

  const user = await getSessionUser(req);

  const [txn] = await db.insert(inventoryTable).values({
    productId,
    productName: product.name,
    previousQuantity: previous,
    quantityAdded: actionType === "add" ? quantity : null,
    quantityReduced: actionType === "reduce" ? quantity : null,
    currentQuantity: current,
    actionType,
    updatedById: user?.id ?? null,
  }).returning();

  res.status(201).json({
    ...txn,
    updatedByName: user?.name ?? null,
  });
});

export default router;
