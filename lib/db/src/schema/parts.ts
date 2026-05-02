import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  numeric,
  pgEnum,
} from "drizzle-orm/pg-core";

export const partsOrderStatusEnum = pgEnum("parts_order_status", [
  "draft",
  "ordered",
  "partial",
  "received",
  "cancelled",
]);

export const partsCountStatusEnum = pgEnum("parts_count_status", [
  "in_progress",
  "completed",
  "cancelled",
]);

export const partsItemsTable = pgTable("parts_items", {
  id: serial("id").primaryKey(),
  partNumber: text("part_number").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull().default("General"),
  description: text("description"),
  binCode: text("bin_code"),
  qtyOnHand: integer("qty_on_hand").notNull().default(0),
  qtyReserved: integer("qty_reserved").notNull().default(0),
  minStock: integer("min_stock").notNull().default(2),
  maxStock: integer("max_stock").notNull().default(20),
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }),
  supplierCode: text("supplier_code"),
  lastCountedAt: timestamp("last_counted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const partsOrdersTable = pgTable("parts_orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  supplierCode: text("supplier_code").notNull(),
  supplierName: text("supplier_name").notNull(),
  status: partsOrderStatusEnum("status").notNull().default("ordered"),
  notes: text("notes"),
  orderedAt: timestamp("ordered_at"),
  expectedAt: timestamp("expected_at"),
  receivedAt: timestamp("received_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const partsOrderItemsTable = pgTable("parts_order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  partNumber: text("part_number").notNull(),
  partName: text("part_name").notNull(),
  qtyOrdered: integer("qty_ordered").notNull(),
  qtyReceived: integer("qty_received").notNull().default(0),
  binCode: text("bin_code"),
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }),
});

export const partsCountSessionsTable = pgTable("parts_count_sessions", {
  id: serial("id").primaryKey(),
  sessionNumber: text("session_number").notNull().unique(),
  status: partsCountStatusEnum("status").notNull().default("in_progress"),
  startedBy: text("started_by").notNull(),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const partsCountItemsTable = pgTable("parts_count_items", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  partNumber: text("part_number").notNull(),
  partName: text("part_name").notNull(),
  binCode: text("bin_code"),
  expectedQty: integer("expected_qty").notNull(),
  countedQty: integer("counted_qty"),
});
