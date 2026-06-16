import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, pool, productsTable, stockMovementsTable } from "@workspace/db";
import { requireAdmin, type AuthUser } from "../lib/auth";

const router: IRouter = Router();
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function serialize(p: typeof productsTable.$inferSelect) {
  return {
    ...p,
    price: parseFloat(String(p.price)),
    stock: p.currentStock,
    currentStock: p.currentStock,
    totalStockIn: p.totalStockIn,
    totalSold: p.totalSold,
    current_stock: p.currentStock,
    total_stock_in: p.totalStockIn,
    total_sold: p.totalSold,
    createdAt: String(p.createdAt),
  };
}

function parseBody(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = typeof body.category === "string" ? body.category : "General";
  const size = typeof body.size === "string" ? body.size : "-";
  const price = typeof body.price === "number" ? body.price : parseFloat(String(body.price)) || 0;
  const stock = typeof body.stock === "number" ? Math.round(body.stock) : parseInt(String(body.stock)) || 0;
  if (!name) return null;
  return { name, category, size, price, stock };
}

function parseStockBody(body: Record<string, unknown>) {
  const quantity = typeof body.quantity === "number" ? Math.round(body.quantity) : parseInt(String(body.quantity)) || 0;
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
  if (quantity <= 0) return null;
  return { quantity, note };
}

async function addStockIn(
  tx: DbTransaction,
  productId: number,
  quantity: number,
  userId: number | null,
  note: string | null,
) {
  const [product] = await tx
    .update(productsTable)
    .set({
      stock: sql`${productsTable.stock} + ${quantity}`,
      currentStock: sql`${productsTable.currentStock} + ${quantity}`,
      totalStockIn: sql`${productsTable.totalStockIn} + ${quantity}`,
    })
    .where(eq(productsTable.id, productId))
    .returning();

  if (!product) {
    throw new Error("Product not found");
  }

  await tx.insert(stockMovementsTable).values({
    productId,
    type: "IN",
    quantity,
    reason: "manual",
    createdBy: userId,
    note,
  });

  return product;
}

router.get("/products", async (_req, res): Promise<void> => {
  const products = await db
    .select()
    .from(productsTable)
    .orderBy(productsTable.createdAt);
  res.json(products.map(serialize));
});

router.post("/products", requireAdmin, async (req, res): Promise<void> => {
  try {
    const data = parseBody(req.body as Record<string, unknown>);
    if (!data) { res.status(400).json({ error: "name is required" }); return; }

    const user = res.locals.user as AuthUser;
    const product = await db.transaction(async (tx: DbTransaction) => {
      const [created] = await tx
        .insert(productsTable)
        .values({
          ...data,
          stock: data.stock,
          currentStock: data.stock,
          totalStockIn: data.stock,
          totalSold: 0,
        })
        .returning();

      if (data.stock > 0) {
        await tx.insert(stockMovementsTable).values({
          productId: created.id,
          type: "IN",
          quantity: data.stock,
          reason: "manual",
          createdBy: user.id,
          note: "Opening stock",
        });
      }

      return created;
    });

    res.status(201).json(serialize(product));
  } catch (err) {
    req.log.error({ err, body: req.body }, "Failed to insert product");
    res.status(500).json({ error: "Failed to save product" });
  }
});

router.put("/products/:id", requireAdmin, async (req, res): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));
    if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const data = parseBody(req.body as Record<string, unknown>);
    if (!data) { res.status(400).json({ error: "name is required" }); return; }

    const [product] = await db
      .update(productsTable)
      .set({
        name: data.name,
        category: data.category,
        size: data.size,
        price: data.price,
      })
      .where(eq(productsTable.id, id))
      .returning();

    if (!product) { res.status(404).json({ error: "Product not found" }); return; }
    res.json(serialize(product));
  } catch (err) {
    req.log.error({ err, productId: req.params.id, body: req.body }, "Failed to update product");
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.delete("/products/:id", requireAdmin, async (req, res): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));
    if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [product] = await db
      .delete(productsTable)
      .where(eq(productsTable.id, id))
      .returning();

    if (!product) { res.status(404).json({ error: "Product not found" }); return; }
    res.sendStatus(204);
  } catch (err) {
    req.log.error({ err, productId: req.params.id }, "Failed to delete product");
    res.status(500).json({ error: "Failed to delete product" });
  }
});

router.post("/products/:id/stock-in", requireAdmin, async (req, res): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));
    if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const data = parseStockBody(req.body as Record<string, unknown>);
    if (!data) { res.status(400).json({ error: "quantity must be greater than 0" }); return; }

    const user = res.locals.user as AuthUser;
    const product = await db.transaction((tx: DbTransaction) =>
      addStockIn(tx, id, data.quantity, user.id, data.note)
    );

    res.status(201).json(serialize(product));
  } catch (err) {
    req.log.error({ err, productId: req.params.id, body: req.body }, "Failed to add stock");
    const message = err instanceof Error && err.message === "Product not found"
      ? "Product not found"
      : "Failed to add stock";
    res.status(message === "Product not found" ? 404 : 500).json({ error: message });
  }
});

router.get("/products/:id/stock-movements", async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id));
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const result = await pool.query(
    `SELECT
      sm.id,
      sm.product_id AS "productId",
      p.name AS "productName",
      sm.type,
      sm.quantity,
      sm.reason,
      sm.sale_id AS "saleId",
      sm.created_by AS "createdBy",
      u.email AS "createdByEmail",
      sm.note,
      sm.created_at AS "createdAt"
    FROM stock_movements sm
    JOIN products p ON p.id = sm.product_id
    LEFT JOIN users u ON u.id = sm.created_by
    WHERE sm.product_id = $1
    ORDER BY sm.created_at DESC, sm.id DESC`,
    [id],
  );

  res.json(result.rows);
});

router.get("/stock-movements", async (_req, res): Promise<void> => {
  const result = await pool.query(
    `SELECT
      sm.id,
      sm.product_id AS "productId",
      p.name AS "productName",
      sm.type,
      sm.quantity,
      sm.reason,
      sm.sale_id AS "saleId",
      sm.created_by AS "createdBy",
      u.email AS "createdByEmail",
      sm.note,
      sm.created_at AS "createdAt"
    FROM stock_movements sm
    JOIN products p ON p.id = sm.product_id
    LEFT JOIN users u ON u.id = sm.created_by
    ORDER BY sm.created_at DESC, sm.id DESC`,
  );

  res.json(result.rows);
});

export default router;
