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

export const partsSaleStatusEnum = pgEnum("parts_sale_status", [
  "draft",
  "confirmed",
  "paid",
  "cancelled",
]);

export const partsTransferStatusEnum = pgEnum("parts_transfer_status", [
  "requested",
  "approved",
  "shipped",
  "received",
  "cancelled",
]);

export const partsRoStatusEnum = pgEnum("parts_ro_status", [
  "pending",
  "picking",
  "issued",
  "cancelled",
]);

export const partsItemsTable = pgTable("parts_items", {
  id: serial("id").primaryKey(),
  partNumber: text("part_number").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull().default("General"),
  description: text("description"),
  binCode: text("bin_code"),
  imageUrl: text("image_url"),
  qtyOnHand: integer("qty_on_hand").notNull().default(0),
  qtyReserved: integer("qty_reserved").notNull().default(0),
  minStock: integer("min_stock").notNull().default(2),
  maxStock: integer("max_stock").notNull().default(20),
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }),
  unitSalePrice: numeric("unit_sale_price", { precision: 10, scale: 2 }),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).default("5"),
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
  invoiceNumber: text("invoice_number"),
  currency: text("currency").notNull().default("USD"),
  exchangeRate: numeric("exchange_rate", { precision: 12, scale: 6 }).default("1"),
  localCurrencyCode: text("local_currency_code").notNull().default("AED"),
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
  discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).default("0"),
  markupPct: numeric("markup_pct", { precision: 5, scale: 2 }).default("0"),
  vatPct: numeric("vat_pct", { precision: 5, scale: 2 }).default("5"),
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

export const partsSalesTable = pgTable("parts_sales", {
  id: serial("id").primaryKey(),
  saleNumber: text("sale_number").notNull().unique(),
  customerName: text("customer_name"),
  customerRef: text("customer_ref"),
  status: partsSaleStatusEnum("status").notNull().default("draft"),
  currency: text("currency").notNull().default("USD"),
  exchangeRate: numeric("exchange_rate", { precision: 12, scale: 6 }).notNull().default("1"),
  localCurrencyCode: text("local_currency_code").notNull().default("AED"),
  notes: text("notes"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
});

export const partsSaleItemsTable = pgTable("parts_sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull(),
  partNumber: text("part_number").notNull(),
  partName: text("part_name").notNull(),
  qty: integer("qty").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  markupPct: numeric("markup_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  vatPct: numeric("vat_pct", { precision: 5, scale: 2 }).notNull().default("5"),
  currency: text("currency").notNull().default("USD"),
});

export const partsTransfersTable = pgTable("parts_transfers", {
  id: serial("id").primaryKey(),
  transferNumber: text("transfer_number").notNull().unique(),
  fromBranch: text("from_branch").notNull(),
  toBranch: text("to_branch").notNull(),
  status: partsTransferStatusEnum("status").notNull().default("requested"),
  requestedBy: text("requested_by").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  shippedAt: timestamp("shipped_at"),
  receivedAt: timestamp("received_at"),
});

export const partsTransferItemsTable = pgTable("parts_transfer_items", {
  id: serial("id").primaryKey(),
  transferId: integer("transfer_id").notNull(),
  partNumber: text("part_number").notNull(),
  partName: text("part_name").notNull(),
  qtyRequested: integer("qty_requested").notNull(),
  qtyShipped: integer("qty_shipped").notNull().default(0),
  qtyReceived: integer("qty_received").notNull().default(0),
});

export const partsRoRequestsTable = pgTable("parts_ro_requests", {
  id: serial("id").primaryKey(),
  requestNumber: text("request_number").notNull().unique(),
  roNumber: text("ro_number").notNull(),
  department: text("department").notNull().default("Service"),
  status: partsRoStatusEnum("status").notNull().default("pending"),
  requestedBy: text("requested_by").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  issuedAt: timestamp("issued_at"),
});

export const partsRoRequestItemsTable = pgTable("parts_ro_request_items", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  partNumber: text("part_number").notNull(),
  partName: text("part_name").notNull(),
  qtyRequested: integer("qty_requested").notNull(),
  qtyIssued: integer("qty_issued").notNull().default(0),
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }),
  notes: text("notes"),
});
