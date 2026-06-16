import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import bcrypt from "bcryptjs";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required.");
}

export const pool = new Pool({
  connectionString: databaseUrl,
});

export const db = drizzle(pool, { schema });

// Web development and VPS deployments use PostgreSQL. The backend waits for this
// promise before listening so a fresh Docker volume is ready on first startup.
export const ready = (async () => {
  await pool.query(`
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Administrator',
  role TEXT NOT NULL DEFAULT 'admin',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  size TEXT NOT NULL DEFAULT '-',
  price REAL NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  current_stock INTEGER NOT NULL DEFAULT 0,
  total_stock_in INTEGER NOT NULL DEFAULT 0,
  total_sold INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  bill_no TEXT NOT NULL,
  date TEXT NOT NULL,
  customer TEXT NOT NULL,
  phone TEXT,
  note TEXT,
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  total REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL,
  product_id INTEGER,
  name TEXT NOT NULL,
  size TEXT NOT NULL DEFAULT '-',
  qty INTEGER NOT NULL DEFAULT 1,
  rate REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL CHECK (reason IN ('purchase', 'sale', 'adjustment', 'return', 'manual')),
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

  await pool.query(`
ALTER TABLE products ADD COLUMN IF NOT EXISTS current_stock INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS total_stock_in INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS total_sold INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS product_id INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE products
SET
  current_stock = CASE WHEN current_stock = 0 AND stock > 0 THEN stock ELSE current_stock END,
  total_stock_in = CASE WHEN total_stock_in = 0 AND stock > 0 THEN stock ELSE total_stock_in END
WHERE stock > 0;

UPDATE products
SET stock = current_stock
WHERE stock <> current_stock;

INSERT INTO stock_movements (product_id, type, quantity, reason, note)
SELECT id, 'IN', total_stock_in, 'manual', 'Opening stock imported during PostgreSQL stock migration'
FROM products p
WHERE p.total_stock_in > 0
  AND NOT EXISTS (
    SELECT 1 FROM stock_movements sm WHERE sm.product_id = p.id
  );
`);

  const countResult = await pool.query<{ count: string }>("SELECT COUNT(*) AS count FROM users");
  const userCount = Number(countResult.rows[0]?.count ?? 0);

  if (userCount === 0) {
    const email = process.env.DEFAULT_ADMIN_EMAIL ?? "admin@example.com";
    const password = process.env.DEFAULT_ADMIN_PASSWORD ?? "Admin@12345";
    const passwordHash = await bcrypt.hash(password, 12);

    await pool.query(
      "INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4)",
      [email.toLowerCase(), passwordHash, "Administrator", "admin"],
    );
  }
})();

export * from "./schema";
