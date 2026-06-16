import { Router, type IRouter } from "express";
import {
  db,
  pool,
  productsTable,
  salesTable,
  saleItemsTable,
  stockMovementsTable,
  usersTable,
} from "@workspace/db";

const router: IRouter = Router();

type BackupValue = Record<string, unknown>;

type BackupPayload = {
  version?: unknown;
  exportedAt?: unknown;
  users?: BackupValue[];
  products?: BackupValue[];
  sales?: BackupValue[];
  saleItems?: BackupValue[];
  stockMovements?: BackupValue[];
  settings?: BackupValue[];
};

function asObject(value: unknown): BackupPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Backup file must contain a JSON object.");
  }

  return value as BackupPayload;
}

function asArray(payload: BackupPayload, key: keyof BackupPayload): BackupValue[] {
  const value = payload[key];

  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`Backup field "${String(key)}" must be an array.`);
  }

  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Backup field "${String(key)}" contains an invalid row at index ${index}.`);
    }
  }

  return value as BackupValue[];
}

function numberValue(row: BackupValue, key: string, fallback = 0): number {
  const value = row[key];

  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for "${key}".`);
  }

  return parsed;
}

function integerValue(row: BackupValue, key: string, fallback = 0): number {
  return Math.trunc(numberValue(row, key, fallback));
}

function stringValue(row: BackupValue, key: string, fallback = ""): string {
  const value = row[key];

  if (value === undefined || value === null) {
    return fallback;
  }

  return String(value);
}

function nullableString(row: BackupValue, key: string): string | null {
  const value = row[key];

  if (value === undefined || value === null) {
    return null;
  }

  return String(value);
}

function nullableInteger(row: BackupValue, key: string): number | null {
  const value = row[key];

  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid integer value for "${key}".`);
  }

  return Math.trunc(parsed);
}

function booleanValue(row: BackupValue, key: string, fallback = true): boolean {
  const value = row[key];

  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") return true;
  if (value === "false") return false;

  throw new Error(`Invalid boolean value for "${key}".`);
}

function timestampValue(row: BackupValue, key: string): Date | null {
  const value = row[key];

  if (value === undefined || value === null || value === "") {
    return null;
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp value for "${key}".`);
  }

  return date;
}

function validatePayload(payload: BackupPayload) {
  const users = asArray(payload, "users");
  const products = asArray(payload, "products");
  const sales = asArray(payload, "sales");
  const saleItems = asArray(payload, "saleItems");
  const stockMovements = asArray(payload, "stockMovements");
  const settings = asArray(payload, "settings");

  for (const product of products) {
    integerValue(product, "id");
    stringValue(product, "name");
    numberValue(product, "price");
  }

  for (const sale of sales) {
    integerValue(sale, "id");
    stringValue(sale, "billNo");
    stringValue(sale, "date");
    stringValue(sale, "customer");
  }

  for (const item of saleItems) {
    integerValue(item, "id");
    integerValue(item, "saleId");
    stringValue(item, "name");
    integerValue(item, "qty", 1);
  }

  for (const movement of stockMovements) {
    integerValue(movement, "id");
    integerValue(movement, "productId");
    stringValue(movement, "type");
    integerValue(movement, "quantity");
    stringValue(movement, "reason");
  }

  for (const user of users) {
    integerValue(user, "id");
    stringValue(user, "email");
    stringValue(user, "passwordHash");
    stringValue(user, "name");
    stringValue(user, "role");
    booleanValue(user, "active");
  }

  if (
    users.length > 0
    && !users.some((user) => stringValue(user, "role") === "admin" && booleanValue(user, "active"))
  ) {
    throw new Error("Backup must contain at least one active admin user.");
  }

  return {
    users,
    products,
    sales,
    saleItems,
    stockMovements,
    settings,
  };
}

router.get("/backup", async (_req, res): Promise<void> => {
  const [users, products, sales, saleItems, stockMovements] = await Promise.all([
    db.select().from(usersTable),
    db.select().from(productsTable),
    db.select().from(salesTable),
    db.select().from(saleItemsTable),
    db.select().from(stockMovementsTable),
  ]);

  res.json({
    version: 2,
    app: "Nibir Fashion",
    exportedAt: new Date().toISOString(),
    users,
    products,
    sales,
    saleItems,
    stockMovements,
    settings: [],
  });
});

router.post("/backup/restore", async (req, res): Promise<void> => {
  let data: ReturnType<typeof validatePayload>;

  try {
    data = validatePayload(asObject(req.body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid backup file.";
    req.log.warn({ err: error }, "Backup restore validation failed");
    res.status(400).json({ ok: false, error: message });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query("DELETE FROM stock_movements");
    await client.query("DELETE FROM sale_items");
    await client.query("DELETE FROM sales");
    await client.query("DELETE FROM products");

    if (data.users.length > 0) {
      await client.query("DELETE FROM users");

      for (const user of data.users) {
        await client.query(
          `INSERT INTO users (id, email, password_hash, name, role, active, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_TIMESTAMP))`,
          [
            integerValue(user, "id"),
            stringValue(user, "email").toLowerCase(),
            stringValue(user, "passwordHash"),
            stringValue(user, "name", "Staff"),
            stringValue(user, "role", "user"),
            booleanValue(user, "active", true),
            timestampValue(user, "createdAt"),
          ],
        );
      }
    }

    for (const product of data.products) {
      const currentStock = integerValue(product, "currentStock", integerValue(product, "stock", 0));
      const totalStockIn = integerValue(product, "totalStockIn", currentStock);

      await client.query(
        `INSERT INTO products (id, name, category, size, price, stock, current_stock, total_stock_in, total_sold, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, CURRENT_TIMESTAMP))`,
        [
          integerValue(product, "id"),
          stringValue(product, "name"),
          stringValue(product, "category", "General"),
          stringValue(product, "size", "-"),
          numberValue(product, "price", 0),
          currentStock,
          currentStock,
          totalStockIn,
          integerValue(product, "totalSold", 0),
          timestampValue(product, "createdAt"),
        ],
      );
    }

    for (const sale of data.sales) {
      await client.query(
        `INSERT INTO sales (id, bill_no, date, customer, phone, note, payment_method, total, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, CURRENT_TIMESTAMP))`,
        [
          integerValue(sale, "id"),
          stringValue(sale, "billNo"),
          stringValue(sale, "date"),
          stringValue(sale, "customer"),
          nullableString(sale, "phone"),
          nullableString(sale, "note"),
          stringValue(sale, "paymentMethod", "Cash"),
          numberValue(sale, "total", 0),
          timestampValue(sale, "createdAt"),
        ],
      );
    }

    for (const item of data.saleItems) {
      await client.query(
        `INSERT INTO sale_items (id, sale_id, product_id, name, size, qty, rate, amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          integerValue(item, "id"),
          integerValue(item, "saleId"),
          nullableInteger(item, "productId"),
          stringValue(item, "name"),
          stringValue(item, "size", "-"),
          integerValue(item, "qty", 1),
          numberValue(item, "rate", 0),
          numberValue(item, "amount", 0),
        ],
      );
    }

    for (const movement of data.stockMovements) {
      await client.query(
        `INSERT INTO stock_movements (id, product_id, type, quantity, reason, sale_id, created_by, note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, CURRENT_TIMESTAMP))`,
        [
          integerValue(movement, "id"),
          integerValue(movement, "productId"),
          stringValue(movement, "type"),
          integerValue(movement, "quantity"),
          stringValue(movement, "reason"),
          nullableInteger(movement, "saleId"),
          nullableInteger(movement, "createdBy"),
          nullableString(movement, "note"),
          timestampValue(movement, "createdAt"),
        ],
      );
    }

    await client.query(`
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1), (SELECT COUNT(*) > 0 FROM users));
SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE((SELECT MAX(id) FROM products), 1), (SELECT COUNT(*) > 0 FROM products));
SELECT setval(pg_get_serial_sequence('sales', 'id'), COALESCE((SELECT MAX(id) FROM sales), 1), (SELECT COUNT(*) > 0 FROM sales));
SELECT setval(pg_get_serial_sequence('sale_items', 'id'), COALESCE((SELECT MAX(id) FROM sale_items), 1), (SELECT COUNT(*) > 0 FROM sale_items));
SELECT setval(pg_get_serial_sequence('stock_movements', 'id'), COALESCE((SELECT MAX(id) FROM stock_movements), 1), (SELECT COUNT(*) > 0 FROM stock_movements));
`);

    await client.query("COMMIT");

    res.json({
      ok: true,
      counts: {
        users: data.users.length,
        products: data.products.length,
        sales: data.sales.length,
        saleItems: data.saleItems.length,
        stockMovements: data.stockMovements.length,
        settings: data.settings.length,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError: unknown) => {
      req.log.error({ err: rollbackError }, "Failed to rollback backup restore");
    });

    const detail = error instanceof Error ? error.message : "Unknown restore error";
    req.log.error(
      {
        err: error,
        counts: {
          users: data.users.length,
          products: data.products.length,
          sales: data.sales.length,
          saleItems: data.saleItems.length,
          stockMovements: data.stockMovements.length,
          settings: data.settings.length,
        },
      },
      "Failed to restore backup",
    );
    res.status(400).json({ ok: false, error: `Failed to restore backup: ${detail}` });
  } finally {
    client.release();
  }
});

export default router;
