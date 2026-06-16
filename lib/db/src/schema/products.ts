import { integer, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default("General"),
  size: text("size").notNull().default("-"),
  price: real("price").notNull().default(0),
  stock: integer("stock").notNull().default(0),
  currentStock: integer("current_stock").notNull().default(0),
  totalStockIn: integer("total_stock_in").notNull().default(0),
  totalSold: integer("total_sold").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
