import { Router, type IRouter } from "express";
import { db, productsTable, salesTable, saleItemsTable, stockMovementsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

router.get("/backup", async (_req, res): Promise<void> => {
  const [products, sales, saleItems, stockMovements] = await Promise.all([
    db.select().from(productsTable),
    db.select().from(salesTable),
    db.select().from(saleItemsTable),
    db.select().from(stockMovementsTable),
  ]);

  res.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    products,
    sales,
    saleItems,
    stockMovements,
  });
});

router.post("/backup/restore", async (req, res): Promise<void> => {
  const payload = req.body as {
    products?: Array<typeof productsTable.$inferInsert>;
    sales?: Array<typeof salesTable.$inferInsert>;
    saleItems?: Array<typeof saleItemsTable.$inferInsert>;
    stockMovements?: Array<typeof stockMovementsTable.$inferInsert>;
  };

  const products = Array.isArray(payload?.products) ? payload.products : [];
  const sales = Array.isArray(payload?.sales) ? payload.sales : [];
  const saleItems = Array.isArray(payload?.saleItems) ? payload.saleItems : [];
  const stockMovements = Array.isArray(payload?.stockMovements) ? payload.stockMovements : [];

  try {
    await db.transaction(async (tx: DbTransaction) => {
      await tx.execute(sql`DELETE FROM stock_movements`);
      await tx.execute(sql`DELETE FROM sale_items`);
      await tx.execute(sql`DELETE FROM sales`);
      await tx.execute(sql`DELETE FROM products`);

      if (products.length > 0) {
        await tx.insert(productsTable).values(products);
      }

      if (sales.length > 0) {
        await tx.insert(salesTable).values(sales);
      }

      if (saleItems.length > 0) {
        await tx.insert(saleItemsTable).values(saleItems);
      }

      if (stockMovements.length > 0) {
        await tx.insert(stockMovementsTable).values(stockMovements);
      }
    });

    res.json({
      ok: true,
      counts: {
        products: products.length,
        sales: sales.length,
        saleItems: saleItems.length,
        stockMovements: stockMovements.length,
      },
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to restore backup");
    res.status(400).json({ ok: false, error: "Failed to restore backup payload" });
  }
});

export default router;
