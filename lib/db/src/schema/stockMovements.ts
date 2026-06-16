import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { productsTable } from "./products";
import { salesTable } from "./sales";
import { usersTable } from "./users";

export const stockMovementsTable = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => productsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  quantity: integer("quantity").notNull(),
  reason: text("reason").notNull(),
  saleId: integer("sale_id").references(() => salesTable.id, { onDelete: "set null" }),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type StockMovement = typeof stockMovementsTable.$inferSelect;
