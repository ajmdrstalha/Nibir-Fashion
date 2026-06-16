import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, productsTable, salesTable, saleItemsTable, stockMovementsTable } from "@workspace/db";
import {
  ListSalesQueryParams,
  CreateSaleBody,
  GetSaleParams,
  DeleteSaleParams,
  GetMonthlyTotalsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();
type SaleRow = typeof salesTable.$inferSelect;
type SaleItemRow = typeof saleItemsTable.$inferSelect;
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

class NotEnoughStockError extends Error {
  constructor() {
    super("Not enough stock available");
  }
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

router.get("/sales/summary/today", async (req, res): Promise<void> => {
  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const rows = await db.select().from(salesTable).where(eq(salesTable.date, today));
  const total = rows.reduce((s: number, r: SaleRow) => s + parseFloat(String(r.total)), 0);
  res.json({ total, count: rows.length });
});

router.get("/sales/summary/month", async (req, res): Promise<void> => {
  const now = new Date();
  const prefix = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const rows = await db
    .select()
    .from(salesTable)
    .where(sql`${salesTable.date} LIKE ${prefix + "%"}`);
  const total = rows.reduce((s: number, r: SaleRow) => s + parseFloat(String(r.total)), 0);
  res.json({ total, count: rows.length });
});

router.get("/sales/summary/monthly-totals", async (req, res): Promise<void> => {
  const parsed = GetMonthlyTotalsQueryParams.safeParse(req.query);
  const year = parsed.success && parsed.data.year ? parsed.data.year : new Date().getFullYear();

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const results = await Promise.all(
    months.map(async (label, i) => {
      const monthNum = i + 1;
      const prefix = `${year}-${pad(monthNum)}`;
      const rows = await db
        .select()
        .from(salesTable)
        .where(sql`${salesTable.date} LIKE ${prefix + "%"}`);
      const total = rows.reduce((s: number, r: SaleRow) => s + parseFloat(String(r.total)), 0);
      return { month: label, total, count: rows.length };
    })
  );

  res.json(results);
});

router.get("/sales", async (req, res): Promise<void> => {
  const parsed = ListSalesQueryParams.safeParse(req.query);
  const filters: ReturnType<typeof and>[] = [];

  if (parsed.success) {
    if (parsed.data.year && parsed.data.month) {
      const prefix = `${parsed.data.year}-${pad(parsed.data.month)}`;
      filters.push(sql`${salesTable.date} LIKE ${prefix + "%"}`);
    } else if (parsed.data.year) {
      filters.push(sql`${salesTable.date} LIKE ${parsed.data.year + "-%"}`);
    }
  }

  const sales = await db
    .select()
    .from(salesTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(sql`${salesTable.createdAt} DESC`);

  const withItems = await Promise.all(
    sales.map(async (sale: SaleRow) => {
      const items = await db
        .select()
        .from(saleItemsTable)
        .where(eq(saleItemsTable.saleId, sale.id));
      return {
        ...sale,
        total: parseFloat(String(sale.total)),
        items: items.map((i: SaleItemRow) => ({
          ...i,
          productId: i.productId,
          rate: parseFloat(String(i.rate)),
          amount: parseFloat(String(i.amount)),
        })),
      };
    })
  );

  res.json(withItems);
});

router.post("/sales", async (req, res): Promise<void> => {
  try {
    const parsed = CreateSaleBody.safeParse(req.body);
    if (!parsed.success) {
      req.log.warn({ errors: parsed.error.message }, "Invalid sale body");
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { items, ...saleData } = parsed.data;
    const total = items.reduce((s: number, i: { qty: number; rate: number }) => s + i.qty * i.rate, 0);

    const result = await db.transaction(async (tx: DbTransaction) => {
      const quantitiesByProduct = new Map<number, number>();

      for (const item of items) {
        if (!item.productId) {
          throw new NotEnoughStockError();
        }

        quantitiesByProduct.set(
          item.productId,
          (quantitiesByProduct.get(item.productId) ?? 0) + item.qty,
        );
      }

      for (const [productId, quantity] of quantitiesByProduct) {
        const [product] = await tx
          .select()
          .from(productsTable)
          .where(eq(productsTable.id, productId));

        if (!product || product.currentStock < quantity) {
          throw new NotEnoughStockError();
        }
      }

      const [sale] = await tx
        .insert(salesTable)
        .values({
          ...saleData,
          total,
        })
        .returning();

      const insertedItems = await tx
        .insert(saleItemsTable)
        .values(
          items.map((i: { name: string; productId: number; size: string; qty: number; rate: number }) => ({
            saleId: sale.id,
            productId: i.productId,
            name: i.name,
            size: i.size,
            qty: i.qty,
            rate: i.rate,
            amount: i.qty * i.rate,
          }))
        )
        .returning();

      for (const [productId, quantity] of quantitiesByProduct) {
        const [product] = await tx
          .update(productsTable)
          .set({
            stock: sql`${productsTable.stock} - ${quantity}`,
            currentStock: sql`${productsTable.currentStock} - ${quantity}`,
            totalSold: sql`${productsTable.totalSold} + ${quantity}`,
          })
          .where(sql`${productsTable.id} = ${productId} AND ${productsTable.currentStock} >= ${quantity}`)
          .returning();

        if (!product) {
          throw new NotEnoughStockError();
        }

        await tx.insert(stockMovementsTable).values({
          productId,
          type: "OUT",
          quantity,
          reason: "sale",
          saleId: sale.id,
          createdBy: res.locals.user?.id ?? null,
          note: sale.billNo,
        });
      }

      return { sale, insertedItems };
    });

    res.status(201).json({
      ...result.sale,
      total: parseFloat(String(result.sale.total)),
      items: result.insertedItems.map((i: SaleItemRow) => ({
        ...i,
        productId: i.productId,
        rate: parseFloat(String(i.rate)),
        amount: parseFloat(String(i.amount)),
      })),
    });
  } catch (err) {
    if (err instanceof NotEnoughStockError) {
      res.status(400).json({ error: "Not enough stock available" });
      return;
    }

    req.log.error({ err, body: req.body }, "Failed to insert sale");
    res.status(500).json({ error: "Failed to save sale" });
  }
});

router.get("/sales/:id", async (req, res): Promise<void> => {
  const params = GetSaleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [sale] = await db
    .select()
    .from(salesTable)
    .where(eq(salesTable.id, params.data.id));

  if (!sale) {
    res.status(404).json({ error: "Sale not found" });
    return;
  }

  const items = await db
    .select()
    .from(saleItemsTable)
    .where(eq(saleItemsTable.saleId, sale.id));

  res.json({
    ...sale,
    total: parseFloat(String(sale.total)),
    items: items.map((i: SaleItemRow) => ({
      ...i,
      productId: i.productId,
      rate: parseFloat(String(i.rate)),
      amount: parseFloat(String(i.amount)),
    })),
  });
});

router.delete("/sales/:id", async (req, res): Promise<void> => {
  try {
    const params = DeleteSaleParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [sale] = await db
      .delete(salesTable)
      .where(eq(salesTable.id, params.data.id))
      .returning();

    if (!sale) {
      res.status(404).json({ error: "Sale not found" });
      return;
    }

    res.sendStatus(204);
  } catch (err) {
    req.log.error({ err, saleId: req.params.id }, "Failed to delete sale");
    res.status(500).json({ error: "Failed to delete sale" });
  }
});

export default router;
