import { Router } from "express";
import { db, productsTable } from "@workspace/db";
import { eq, ilike, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import {
  CreateProductBody,
  UpdateProductBody,
  UpdateProductParams,
  DeleteProductParams,
  GetProductParams,
  ListProductsQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/products", requireAuth, async (req, res): Promise<void> => {
  const query = ListProductsQueryParams.safeParse(req.query);
  const search = query.success ? query.data.search : undefined;
  const page = (query.success && query.data.page) ? Number(query.data.page) : 1;
  const limit = (query.success && query.data.limit) ? Number(query.data.limit) : 20;
  const offset = (page - 1) * limit;

  const conditions = search ? [ilike(productsTable.name, `%${search}%`)] : [];

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productsTable)
    .where(conditions.length ? conditions[0] : undefined);

  const data = await db
    .select()
    .from(productsTable)
    .where(conditions.length ? conditions[0] : undefined)
    .orderBy(productsTable.name)
    .limit(limit)
    .offset(offset);

  res.json({
    data: data.map(p => ({ ...p, price: Number(p.price) })),
    total: totalRow.count,
    page,
    limit,
  });
});

router.post("/products", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, description, price, availableQuantity } = parsed.data;
  const [product] = await db
    .insert(productsTable)
    .values({
      name,
      description: description ?? "",
      price: String(price),
      availableQuantity: availableQuantity ?? 0,
    })
    .returning();

  res.status(201).json({ ...product, price: Number(product.price) });
});

router.get("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, params.data.id));

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json({ ...product, price: Number(product.price) });
});

router.patch("/products/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.price !== undefined) updateData.price = String(parsed.data.price);
  if (parsed.data.availableQuantity !== undefined) updateData.availableQuantity = parsed.data.availableQuantity;

  const [product] = await db
    .update(productsTable)
    .set(updateData)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json({ ...product, price: Number(product.price) });
});

router.delete("/products/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [product] = await db
    .delete(productsTable)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
