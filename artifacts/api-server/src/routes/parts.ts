import { Router } from "express";
import { requireMobileRoles, requireYardPrincipal } from "../middlewares/requireAuth";
import { db } from "@workspace/db";
import Anthropic from "@anthropic-ai/sdk";
import { randomBytes } from "crypto";
import {
  partsItemsTable,
  partsOrdersTable,
  partsOrderItemsTable,
  partsCountSessionsTable,
  partsCountItemsTable,
  partsSalesTable,
  partsSaleItemsTable,
  partsTransfersTable,
  partsTransferItemsTable,
  partsRoRequestsTable,
  partsRoRequestItemsTable,
  partsBillsTable,
  partsSalesReturnsTable,
  partsSaleReturnItemsTable,
  partsSupplierReturnsTable,
  partsSupplierReturnItemsTable,
  partsRfqTable,
  partsRfqItemsTable,
  partsRfqSuppliersTable,
  partsRfqResponseItemsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

// ── Seed helpers ─────────────────────────────────────────────────────────────
async function seedIfEmpty() {
  // Always seed the RO requests / transfers if they're empty (even if parts already exist)
  const [existingRo] = await db.select({ id: partsRoRequestsTable.id }).from(partsRoRequestsTable).limit(1);
  if (!existingRo) {
    const [r1] = await db.insert(partsRoRequestsTable).values({
      requestNumber: "PRQ-2026-001", roNumber: "RO-2026-0042", department: "Service",
      status: "pending", requestedBy: "SV", notes: "Service bay 3 - oil change + filter",
    } as typeof partsRoRequestsTable.$inferInsert).returning().onConflictDoNothing();
    const [r2] = await db.insert(partsRoRequestsTable).values({
      requestNumber: "PRQ-2026-002", roNumber: "RO-2026-0051", department: "Body Shop",
      status: "picking", requestedBy: "AD", notes: "Touch-up for white sedan",
    } as typeof partsRoRequestsTable.$inferInsert).returning().onConflictDoNothing();
    if (r1) {
      await db.insert(partsRoRequestItemsTable).values([
        { requestId: r1.id, partNumber: "OIL-5W30-4L",   partName: "Engine Oil 5W-30 4L", qtyRequested: 4, unitCost: "22.50" },
        { requestId: r1.id, partNumber: "FILTER-OIL-01", partName: "Oil Filter Standard",  qtyRequested: 1, unitCost: "8.50" },
      ] as typeof partsRoRequestItemsTable.$inferInsert[]).onConflictDoNothing();
    }
    if (r2) {
      await db.insert(partsRoRequestItemsTable).values([
        { requestId: r2.id, partNumber: "TOUCH-UP-WHT", partName: "Touch-Up Paint White", qtyRequested: 2, unitCost: "12.00" },
      ] as typeof partsRoRequestItemsTable.$inferInsert[]).onConflictDoNothing();
    }
  }

  const [existingTrf] = await db.select({ id: partsTransfersTable.id }).from(partsTransfersTable).limit(1);
  if (!existingTrf) {
    const [t1] = await db.insert(partsTransfersTable).values({
      transferNumber: "TRF-2026-001", fromBranch: "Main Branch", toBranch: "Airport Branch",
      status: "requested", requestedBy: "PT", notes: "Brake pad stock transfer request",
    } as typeof partsTransfersTable.$inferInsert).returning().onConflictDoNothing();
    if (t1) {
      await db.insert(partsTransferItemsTable).values([
        { transferId: t1.id, partNumber: "BRAKE-PAD-FR", partName: "Front Brake Pads Set", qtyRequested: 4 },
        { transferId: t1.id, partNumber: "BRAKE-PAD-RR", partName: "Rear Brake Pads Set",  qtyRequested: 4 },
      ] as typeof partsTransferItemsTable.$inferInsert[]).onConflictDoNothing();
    }
  }

  const existing = await db.select({ id: partsItemsTable.id }).from(partsItemsTable).limit(1);
  if (existing.length > 0) return;

  const items = [
    { partNumber: "OIL-5W30-4L",    name: "Engine Oil 5W-30 4L",           category: "Lubricants",  binCode: "A1",  qtyOnHand: 24, minStock: 10, maxStock: 50,  unitCost: "22.50", unitSalePrice: "32.00", supplierCode: "CASTROL" },
    { partNumber: "OIL-5W40-4L",    name: "Engine Oil 5W-40 4L",           category: "Lubricants",  binCode: "A2",  qtyOnHand: 12, minStock: 8,  maxStock: 40,  unitCost: "24.90", unitSalePrice: "35.00", supplierCode: "CASTROL" },
    { partNumber: "OIL-0W20-4L",    name: "Engine Oil 0W-20 4L",           category: "Lubricants",  binCode: "A3",  qtyOnHand: 6,  minStock: 8,  maxStock: 30,  unitCost: "28.00", unitSalePrice: "40.00", supplierCode: "MOBIL" },
    { partNumber: "FILTER-OIL-01",  name: "Oil Filter Standard",           category: "Filters",     binCode: "B1",  qtyOnHand: 18, minStock: 10, maxStock: 40,  unitCost: "8.50",  unitSalePrice: "14.00", supplierCode: "BOSCH" },
    { partNumber: "FILTER-OIL-02",  name: "Oil Filter Premium",            category: "Filters",     binCode: "B2",  qtyOnHand: 3,  minStock: 5,  maxStock: 20,  unitCost: "12.00", unitSalePrice: "19.00", supplierCode: "MANN" },
    { partNumber: "FILTER-AIR-01",  name: "Air Filter Panel",              category: "Filters",     binCode: "B3",  qtyOnHand: 8,  minStock: 5,  maxStock: 20,  unitCost: "15.00", unitSalePrice: "24.00", supplierCode: "MANN" },
    { partNumber: "FILTER-CAB-01",  name: "Cabin Air Filter",              category: "Filters",     binCode: "B4",  qtyOnHand: 5,  minStock: 4,  maxStock: 16,  unitCost: "18.50", unitSalePrice: "28.00", supplierCode: "MANN" },
    { partNumber: "FILTER-FUEL-1",  name: "Fuel Filter",                   category: "Filters",     binCode: "B5",  qtyOnHand: 0,  minStock: 3,  maxStock: 12,  unitCost: "22.00", unitSalePrice: "33.00", supplierCode: "BOSCH" },
    { partNumber: "BRAKE-PAD-FR",   name: "Front Brake Pads Set",          category: "Brakes",      binCode: "C1",  qtyOnHand: 6,  minStock: 4,  maxStock: 16,  unitCost: "45.00", unitSalePrice: "68.00", supplierCode: "BREMBO" },
    { partNumber: "BRAKE-PAD-RR",   name: "Rear Brake Pads Set",           category: "Brakes",      binCode: "C2",  qtyOnHand: 4,  minStock: 4,  maxStock: 16,  unitCost: "38.00", unitSalePrice: "57.00", supplierCode: "BREMBO" },
    { partNumber: "BRAKE-ROTOR-F",  name: "Front Brake Rotor",             category: "Brakes",      binCode: "C3",  qtyOnHand: 2,  minStock: 2,  maxStock: 8,   unitCost: "85.00", unitSalePrice: "125.00", supplierCode: "BREMBO" },
    { partNumber: "BRAKE-ROTOR-R",  name: "Rear Brake Rotor",              category: "Brakes",      binCode: "C4",  qtyOnHand: 1,  minStock: 2,  maxStock: 8,   unitCost: "72.00", unitSalePrice: "108.00", supplierCode: "BREMBO" },
    { partNumber: "BRAKE-FLUID",    name: "Brake Fluid DOT 4 500ml",       category: "Lubricants",  binCode: "A4",  qtyOnHand: 10, minStock: 5,  maxStock: 25,  unitCost: "9.50",  unitSalePrice: "15.00", supplierCode: "ATE" },
    { partNumber: "TYRE-205-55R16", name: "Tyre 205/55 R16",               category: "Tyres",       binCode: "T1",  qtyOnHand: 8,  minStock: 4,  maxStock: 20,  unitCost: "95.00", unitSalePrice: "140.00", supplierCode: "MICHELIN" },
    { partNumber: "TYRE-225-45R17", name: "Tyre 225/45 R17",               category: "Tyres",       binCode: "T2",  qtyOnHand: 4,  minStock: 4,  maxStock: 16,  unitCost: "120.00",unitSalePrice: "175.00", supplierCode: "MICHELIN" },
    { partNumber: "TYRE-195-65R15", name: "Tyre 195/65 R15",               category: "Tyres",       binCode: "T3",  qtyOnHand: 0,  minStock: 4,  maxStock: 16,  unitCost: "80.00", unitSalePrice: "118.00", supplierCode: "BRIDGESTONE" },
    { partNumber: "BATT-12V-60AH",  name: "Battery 12V 60Ah",              category: "Batteries",   binCode: "D1",  qtyOnHand: 3,  minStock: 2,  maxStock: 8,   unitCost: "125.00",unitSalePrice: "185.00", supplierCode: "VARTA" },
    { partNumber: "BATT-12V-72AH",  name: "Battery 12V 72Ah",              category: "Batteries",   binCode: "D2",  qtyOnHand: 2,  minStock: 2,  maxStock: 6,   unitCost: "145.00",unitSalePrice: "215.00", supplierCode: "VARTA" },
    { partNumber: "BATT-12V-100A",  name: "Battery 12V 100Ah AGM",         category: "Batteries",   binCode: "D3",  qtyOnHand: 1,  minStock: 2,  maxStock: 4,   unitCost: "210.00",unitSalePrice: "310.00", supplierCode: "BOSCH" },
    { partNumber: "COOLANT-5L",     name: "Coolant / Antifreeze 5L",       category: "Lubricants",  binCode: "A5",  qtyOnHand: 14, minStock: 6,  maxStock: 30,  unitCost: "18.00", unitSalePrice: "28.00", supplierCode: "COMMA" },
    { partNumber: "TRANS-FLUID-1",  name: "Transmission Fluid ATF 1L",     category: "Lubricants",  binCode: "A6",  qtyOnHand: 7,  minStock: 4,  maxStock: 20,  unitCost: "16.00", unitSalePrice: "25.00", supplierCode: "COMMA" },
    { partNumber: "WIPER-FRONT-U",  name: "Front Wiper Blade Universal",   category: "Materials",   binCode: "E1",  qtyOnHand: 10, minStock: 6,  maxStock: 24,  unitCost: "14.00", unitSalePrice: "22.00", supplierCode: "BOSCH" },
    { partNumber: "WIPER-REAR-01",  name: "Rear Wiper Blade",              category: "Materials",   binCode: "E2",  qtyOnHand: 5,  minStock: 4,  maxStock: 16,  unitCost: "10.00", unitSalePrice: "16.00", supplierCode: "BOSCH" },
    { partNumber: "SPARK-PLG-STD",  name: "Spark Plug Standard",           category: "Electrical",  binCode: "F1",  qtyOnHand: 16, minStock: 8,  maxStock: 32,  unitCost: "6.50",  unitSalePrice: "10.00", supplierCode: "NGK" },
    { partNumber: "SPARK-PLG-IRD",  name: "Spark Plug Iridium",            category: "Electrical",  binCode: "F2",  qtyOnHand: 8,  minStock: 4,  maxStock: 24,  unitCost: "14.00", unitSalePrice: "22.00", supplierCode: "NGK" },
    { partNumber: "BULB-H7-55W",    name: "Headlight Bulb H7 55W",         category: "Electrical",  binCode: "F3",  qtyOnHand: 6,  minStock: 4,  maxStock: 20,  unitCost: "7.00",  unitSalePrice: "12.00", supplierCode: "OSRAM" },
    { partNumber: "BULB-LED-DRL",   name: "LED DRL Bulb Set",              category: "Electrical",  binCode: "F4",  qtyOnHand: 2,  minStock: 2,  maxStock: 10,  unitCost: "22.00", unitSalePrice: "35.00", supplierCode: "PHILIPS" },
    { partNumber: "SHAMPOO-5L",     name: "Car Shampoo 5L",                category: "Materials",   binCode: "G1",  qtyOnHand: 8,  minStock: 3,  maxStock: 15,  unitCost: "19.00", unitSalePrice: "30.00", supplierCode: "MEGUIARS" },
    { partNumber: "POLISH-500ML",   name: "Machine Polish 500ml",          category: "Materials",   binCode: "G2",  qtyOnHand: 4,  minStock: 2,  maxStock: 10,  unitCost: "28.00", unitSalePrice: "45.00", supplierCode: "MEGUIARS" },
    { partNumber: "DETAIL-SPRAY",   name: "Quick Detailer Spray 500ml",    category: "Materials",   binCode: "G3",  qtyOnHand: 6,  minStock: 3,  maxStock: 12,  unitCost: "15.00", unitSalePrice: "24.00", supplierCode: "AUTOGLYM" },
    { partNumber: "TOUCH-UP-WHT",   name: "Touch-Up Paint White",          category: "Materials",   binCode: "G4",  qtyOnHand: 3,  minStock: 2,  maxStock: 10,  unitCost: "12.00", unitSalePrice: "20.00", supplierCode: "IGMMA-INT" },
    { partNumber: "TOUCH-UP-BLK",   name: "Touch-Up Paint Black",          category: "Materials",   binCode: "G5",  qtyOnHand: 3,  minStock: 2,  maxStock: 10,  unitCost: "12.00", unitSalePrice: "20.00", supplierCode: "IGMMA-INT" },
    { partNumber: "FUSE-10A-BOX",   name: "Mini Fuse 10A (Pack of 10)",    category: "Electrical",  binCode: "F5",  qtyOnHand: 5,  minStock: 3,  maxStock: 15,  unitCost: "4.50",  unitSalePrice: "8.00",  supplierCode: "HELLA" },
    { partNumber: "FUSE-15A-BOX",   name: "Mini Fuse 15A (Pack of 10)",    category: "Electrical",  binCode: "F6",  qtyOnHand: 4,  minStock: 3,  maxStock: 15,  unitCost: "4.50",  unitSalePrice: "8.00",  supplierCode: "HELLA" },
    { partNumber: "CABIN-DEODR",    name: "Cabin Deodorizer Bomb",         category: "Materials",   binCode: "G6",  qtyOnHand: 12, minStock: 5,  maxStock: 30,  unitCost: "6.00",  unitSalePrice: "10.00", supplierCode: "IGMMA-INT" },
    { partNumber: "TYRE-VALVE-K",   name: "Tyre Valve Caps (Set of 4)",    category: "Tyres",       binCode: "T4",  qtyOnHand: 20, minStock: 10, maxStock: 50,  unitCost: "2.50",  unitSalePrice: "5.00",  supplierCode: "IGMMA-INT" },
  ];

  await db.insert(partsItemsTable).values(items as typeof partsItemsTable.$inferInsert[]).onConflictDoNothing();

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
  const lastWeek = new Date(now.getTime() - 7 * 86400000);
  const tomorrow = new Date(now.getTime() + 86400000);

  const [o1] = await db.insert(partsOrdersTable).values({
    orderNumber: "PO-2026-001",
    supplierCode: "BOSCH",
    supplierName: "Bosch Automotive",
    status: "ordered",
    notes: "Urgent restock — filters and spark plugs",
    currency: "USD",
    localCurrencyCode: "AED",
    orderedAt: threeDaysAgo,
    expectedAt: tomorrow,
  }).returning().onConflictDoNothing();

  const [o2] = await db.insert(partsOrdersTable).values({
    orderNumber: "PO-2026-002",
    supplierCode: "MICHELIN",
    supplierName: "Michelin Tyres",
    status: "partial",
    notes: "Tyre delivery — two sizes",
    currency: "EUR",
    exchangeRate: "3.99",
    localCurrencyCode: "AED",
    orderedAt: lastWeek,
    expectedAt: now,
  }).returning().onConflictDoNothing();

  const [o3] = await db.insert(partsOrdersTable).values({
    orderNumber: "PO-2026-003",
    supplierCode: "VARTA",
    supplierName: "Varta Batteries",
    status: "received",
    invoiceNumber: "INV-VARTA-8821",
    notes: "Battery restock complete",
    currency: "USD",
    localCurrencyCode: "AED",
    orderedAt: new Date(now.getTime() - 14 * 86400000),
    receivedAt: lastWeek,
  }).returning().onConflictDoNothing();

  if (o1) {
    await db.insert(partsOrderItemsTable).values([
      { orderId: o1.id, partNumber: "FILTER-OIL-02", partName: "Oil Filter Premium",   qtyOrdered: 10, qtyReceived: 0, binCode: "B2", unitCost: "12.00", discountPct: "5", vatPct: "5" },
      { orderId: o1.id, partNumber: "FILTER-FUEL-1", partName: "Fuel Filter",           qtyOrdered: 6,  qtyReceived: 0, binCode: "B5", unitCost: "22.00", vatPct: "5" },
      { orderId: o1.id, partNumber: "FILTER-AIR-01", partName: "Air Filter Panel",      qtyOrdered: 8,  qtyReceived: 0, binCode: "B3", unitCost: "15.00", vatPct: "5" },
      { orderId: o1.id, partNumber: "SPARK-PLG-STD", partName: "Spark Plug Standard",  qtyOrdered: 20, qtyReceived: 0, binCode: "F1", unitCost: "6.50",  vatPct: "5" },
    ] as typeof partsOrderItemsTable.$inferInsert[]).onConflictDoNothing();
  }

  if (o2) {
    await db.insert(partsOrderItemsTable).values([
      { orderId: o2.id, partNumber: "TYRE-205-55R16", partName: "Tyre 205/55 R16", qtyOrdered: 8, qtyReceived: 4, binCode: "T1", unitCost: "95.00", markupPct: "10", vatPct: "5" },
      { orderId: o2.id, partNumber: "TYRE-195-65R15", partName: "Tyre 195/65 R15", qtyOrdered: 8, qtyReceived: 0, binCode: "T3", unitCost: "80.00", markupPct: "10", vatPct: "5" },
    ] as typeof partsOrderItemsTable.$inferInsert[]).onConflictDoNothing();
  }

  if (o3) {
    await db.insert(partsOrderItemsTable).values([
      { orderId: o3.id, partNumber: "BATT-12V-60AH", partName: "Battery 12V 60Ah",      qtyOrdered: 4, qtyReceived: 4, binCode: "D1", unitCost: "125.00", vatPct: "5" },
      { orderId: o3.id, partNumber: "BATT-12V-72AH", partName: "Battery 12V 72Ah",      qtyOrdered: 3, qtyReceived: 3, binCode: "D2", unitCost: "145.00", vatPct: "5" },
      { orderId: o3.id, partNumber: "BATT-12V-100A", partName: "Battery 12V 100Ah AGM", qtyOrdered: 2, qtyReceived: 2, binCode: "D3", unitCost: "210.00", vatPct: "5" },
    ] as typeof partsOrderItemsTable.$inferInsert[]).onConflictDoNothing();
  }

  // Seed RO Requests
  const [r1] = await db.insert(partsRoRequestsTable).values({
    requestNumber: "PRQ-2026-001",
    roNumber: "RO-2026-0042",
    department: "Service",
    status: "pending",
    requestedBy: "SV",
    notes: "Service bay 3 - oil change + filter",
  }).returning().onConflictDoNothing();

  const [r2] = await db.insert(partsRoRequestsTable).values({
    requestNumber: "PRQ-2026-002",
    roNumber: "RO-2026-0051",
    department: "Body Shop",
    status: "picking",
    requestedBy: "AD",
    notes: "Touch-up for white sedan",
  }).returning().onConflictDoNothing();

  if (r1) {
    await db.insert(partsRoRequestItemsTable).values([
      { requestId: r1.id, partNumber: "OIL-5W30-4L",   partName: "Engine Oil 5W-30 4L", qtyRequested: 4, unitCost: "22.50" },
      { requestId: r1.id, partNumber: "FILTER-OIL-01", partName: "Oil Filter Standard",  qtyRequested: 1, unitCost: "8.50" },
    ] as typeof partsRoRequestItemsTable.$inferInsert[]).onConflictDoNothing();
  }

  if (r2) {
    await db.insert(partsRoRequestItemsTable).values([
      { requestId: r2.id, partNumber: "TOUCH-UP-WHT", partName: "Touch-Up Paint White", qtyRequested: 2, unitCost: "12.00" },
    ] as typeof partsRoRequestItemsTable.$inferInsert[]).onConflictDoNothing();
  }

  // Seed Transfers
  const [t1] = await db.insert(partsTransfersTable).values({
    transferNumber: "TRF-2026-001",
    fromBranch: "Main Branch",
    toBranch: "Airport Branch",
    status: "requested",
    requestedBy: "PT",
    notes: "Brake pad stock transfer request",
  }).returning().onConflictDoNothing();

  if (t1) {
    await db.insert(partsTransferItemsTable).values([
      { transferId: t1.id, partNumber: "BRAKE-PAD-FR", partName: "Front Brake Pads Set", qtyRequested: 4 },
      { transferId: t1.id, partNumber: "BRAKE-PAD-RR", partName: "Rear Brake Pads Set",  qtyRequested: 4 },
    ] as typeof partsTransferItemsTable.$inferInsert[]).onConflictDoNothing();
  }
}

let seeded = false;
async function ensureSeeded() {
  if (!seeded) { await seedIfEmpty(); seeded = true; }
}

function nextNumber(prefix: string, existing: string[]): string {
  const year = new Date().getFullYear();
  const nums = existing
    .map((n) => parseInt(n.split("-").at(-1) ?? "0"))
    .filter((n) => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}-${year}-${String(next).padStart(3, "0")}`;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get("/parts/dashboard", async (req, res) => {
  await ensureSeeded();
  try {
    const items = await db.select().from(partsItemsTable);
    const orders = await db.select().from(partsOrdersTable);
    const counts = await db.select().from(partsCountSessionsTable);
    const sales = await db.select().from(partsSalesTable);
    const roRequests = await db.select().from(partsRoRequestsTable);
    const transfers = await db.select().from(partsTransfersTable);

    const totalParts = items.length;
    const lowStockCount = items.filter((i) => i.qtyOnHand > 0 && i.qtyOnHand < i.minStock).length;
    const outOfStockCount = items.filter((i) => i.qtyOnHand === 0).length;
    const pendingOrders = orders.filter((o) => o.status === "ordered" || o.status === "partial").length;
    const inProgressCounts = counts.filter((c) => c.status === "in_progress").length;
    const pendingRoRequests = roRequests.filter((r) => r.status === "pending" || r.status === "picking").length;
    const pendingTransfers = transfers.filter((t) => t.status === "requested" || t.status === "approved" || t.status === "shipped").length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySales = sales.filter((s) => s.status === "confirmed" || s.status === "paid").filter((s) => new Date(s.createdAt) >= today);

    const lastCount = [...counts]
      .filter((c) => c.status === "completed" && c.completedAt)
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())[0];

    const criticalItems = items
      .filter((i) => i.qtyOnHand === 0)
      .slice(0, 5)
      .map((i) => ({ id: i.id, partNumber: i.partNumber, name: i.name, binCode: i.binCode }));

    res.json({
      totalParts,
      lowStockCount,
      outOfStockCount,
      pendingOrders,
      inProgressCounts,
      pendingRoRequests,
      pendingTransfers,
      todaySalesCount: todaySales.length,
      lastCountDate: lastCount?.completedAt ?? null,
      criticalItems,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

// ── Items ─────────────────────────────────────────────────────────────────────
router.get("/parts/items", async (req, res) => {
  await ensureSeeded();
  try {
    const { search, category, lowStock, outOfStock, limit } = req.query;
    let items = await db.select().from(partsItemsTable);

    if (search) {
      const q = String(search).toLowerCase();
      items = items.filter((i) =>
        i.name.toLowerCase().includes(q) ||
        i.partNumber.toLowerCase().includes(q) ||
        (i.binCode?.toLowerCase().includes(q) ?? false)
      );
    }
    if (category && category !== "All") {
      items = items.filter((i) => i.category === String(category));
    }
    if (outOfStock === "true") {
      items = items.filter((i) => i.qtyOnHand === 0);
    } else if (lowStock === "true") {
      items = items.filter((i) => i.qtyOnHand < i.minStock);
    }

    if (limit) items = items.slice(0, parseInt(String(limit)));

    res.json({ items, total: items.length });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to load items" });
  }
});

router.get("/parts/items/by-number/:partNumber", async (req, res) => {
  await ensureSeeded();
  try {
    const [item] = await db
      .select()
      .from(partsItemsTable)
      .where(eq(partsItemsTable.partNumber, req.params.partNumber.toUpperCase()));
    if (!item) { res.status(404).json({ error: "Part not found" }); return; }
    res.json(item);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/parts/items/:id", async (req, res) => {
  await ensureSeeded();
  try {
    const [item] = await db
      .select()
      .from(partsItemsTable)
      .where(eq(partsItemsTable.id, parseInt(req.params.id)));
    if (!item) { res.status(404).json({ error: "Part not found" }); return; }
    res.json(item);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/parts/items", requireMobileRoles("parts", "supervisor", "admin"), async (req, res) => {
  await ensureSeeded();
  try {
    const { partNumber, name, category, description, binCode, imageUrl, qtyOnHand, minStock, maxStock, unitCost, unitSalePrice, vatRate, supplierCode } = req.body;
    const [item] = await db.insert(partsItemsTable).values({
      partNumber: String(partNumber).toUpperCase(),
      name,
      category: category ?? "General",
      description,
      binCode: binCode ?? null,
      imageUrl: imageUrl ?? null,
      qtyOnHand: parseInt(qtyOnHand) || 0,
      minStock: parseInt(minStock) || 2,
      maxStock: parseInt(maxStock) || 20,
      unitCost: unitCost ? String(unitCost) : null,
      unitSalePrice: unitSalePrice ? String(unitSalePrice) : null,
      vatRate: vatRate ? String(vatRate) : "5",
      supplierCode: supplierCode ?? null,
    } as typeof partsItemsTable.$inferInsert).returning();
    res.status(201).json(item);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create item" });
  }
});

router.patch("/parts/items/:id", requireMobileRoles("parts", "supervisor", "admin"), async (req, res) => {
  await ensureSeeded();
  try {
    const { binCode, imageUrl, qtyOnHand, minStock, maxStock, unitCost, unitSalePrice, vatRate, supplierCode, description } = req.body;
    const updates: Record<string, unknown> = {};
    if (binCode !== undefined) updates.binCode = binCode;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    if (qtyOnHand !== undefined) updates.qtyOnHand = parseInt(qtyOnHand);
    if (minStock !== undefined) updates.minStock = parseInt(minStock);
    if (maxStock !== undefined) updates.maxStock = parseInt(maxStock);
    if (unitCost !== undefined) updates.unitCost = String(unitCost);
    if (unitSalePrice !== undefined) updates.unitSalePrice = String(unitSalePrice);
    if (vatRate !== undefined) updates.vatRate = String(vatRate);
    if (supplierCode !== undefined) updates.supplierCode = supplierCode;
    if (description !== undefined) updates.description = description;

    const [item] = await db
      .update(partsItemsTable)
      .set(updates)
      .where(eq(partsItemsTable.id, parseInt(req.params.id as string)))
      .returning();
    if (!item) { res.status(404).json({ error: "Part not found" }); return; }
    res.json(item);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update item" });
  }
});

// ── Orders ────────────────────────────────────────────────────────────────────
router.get("/parts/orders", async (req, res) => {
  await ensureSeeded();
  try {
    const { status, limit } = req.query;
    let orders = await db.select().from(partsOrdersTable).orderBy(desc(partsOrdersTable.createdAt));

    if (status) {
      const statuses = Array.isArray(status) ? status.map(String) : [String(status)];
      orders = orders.filter((o) => statuses.includes(o.status));
    }
    if (limit) orders = orders.slice(0, parseInt(String(limit)));

    const allItems = await db.select().from(partsOrderItemsTable);

    const result = orders.map((o) => ({
      ...o,
      items: allItems.filter((i) => i.orderId === o.id),
    }));

    res.json({ orders: result, total: result.length });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to load orders" });
  }
});

router.get("/parts/orders/:id", async (req, res) => {
  await ensureSeeded();
  try {
    const [order] = await db
      .select()
      .from(partsOrdersTable)
      .where(eq(partsOrdersTable.id, parseInt(req.params.id)));
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    const items = await db
      .select()
      .from(partsOrderItemsTable)
      .where(eq(partsOrderItemsTable.orderId, order.id));

    // Enrich with imageUrl from parts_items
    const enriched = await Promise.all(
      items.map(async (item) => {
        const [part] = await db
          .select({ imageUrl: partsItemsTable.imageUrl })
          .from(partsItemsTable)
          .where(eq(partsItemsTable.partNumber, item.partNumber));
        return { ...item, imageUrl: part?.imageUrl ?? null };
      })
    );

    res.json({ ...order, items: enriched });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/parts/orders", async (req, res) => {
  await ensureSeeded();
  try {
    const { supplierCode, supplierName, notes, items = [], expectedAt, currency, exchangeRate, localCurrencyCode, invoiceNumber } = req.body;
    const existingOrders = await db.select({ orderNumber: partsOrdersTable.orderNumber }).from(partsOrdersTable);
    const orderNumber = nextNumber("PO", existingOrders.map((o) => o.orderNumber));

    const [order] = await db.insert(partsOrdersTable).values({
      orderNumber,
      supplierCode,
      supplierName,
      status: (req.body.isDraft ? "draft" : "ordered") as "draft" | "ordered",
      notes: notes ?? null,
      createdBy: req.body.createdBy ?? null,
      invoiceNumber: invoiceNumber ?? null,
      currency: currency ?? "USD",
      exchangeRate: exchangeRate ? String(exchangeRate) : "1",
      localCurrencyCode: localCurrencyCode ?? "AED",
      orderedAt: new Date(),
      expectedAt: expectedAt ? new Date(expectedAt) : null,
    } as typeof partsOrdersTable.$inferInsert).returning();

    if (items.length > 0) {
      await db.insert(partsOrderItemsTable).values(
        (items as Array<{partNumber: string; partName: string; qtyOrdered: number; binCode?: string; unitCost?: string; discountPct?: string; markupPct?: string; vatPct?: string}>).map((i) => ({
          orderId: order.id,
          partNumber: String(i.partNumber).toUpperCase(),
          partName: i.partName,
          qtyOrdered: parseInt(String(i.qtyOrdered)),
          qtyReceived: 0,
          binCode: i.binCode ?? null,
          unitCost: i.unitCost ? String(i.unitCost) : null,
          discountPct: i.discountPct ?? "0",
          markupPct: i.markupPct ?? "0",
          vatPct: i.vatPct ?? "5",
        })) as typeof partsOrderItemsTable.$inferInsert[]
      );
    }

    const orderItems = await db.select().from(partsOrderItemsTable).where(eq(partsOrderItemsTable.orderId, order.id));
    res.status(201).json({ ...order, items: orderItems });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

router.patch("/parts/orders/:id", async (req, res) => {
  await ensureSeeded();
  try {
    const { status, notes, invoiceNumber, currency, exchangeRate, localCurrencyCode } = req.body;
    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (invoiceNumber !== undefined) updates.invoiceNumber = invoiceNumber;
    if (currency !== undefined) updates.currency = currency;
    if (exchangeRate !== undefined) updates.exchangeRate = String(exchangeRate);
    if (localCurrencyCode !== undefined) updates.localCurrencyCode = localCurrencyCode;

    const [order] = await db
      .update(partsOrdersTable)
      .set(updates)
      .where(eq(partsOrdersTable.id, parseInt(req.params.id)))
      .returning();
    res.json(order);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/parts/orders/:id/receive", async (req, res) => {
  await ensureSeeded();
  try {
    const orderId = parseInt(req.params.id);
    const { receivedBy, invoiceNumber, items = [] }: {
      receivedBy?: string;
      invoiceNumber?: string;
      items: { orderItemId: number; qtyReceived: number; binCode?: string }[];
    } = req.body;

    const [order] = await db.select().from(partsOrdersTable).where(eq(partsOrdersTable.id, orderId));
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    // Invoice number required if not already set on the order
    const effectiveInvoice = invoiceNumber ?? order.invoiceNumber;
    if (!effectiveInvoice) {
      res.status(400).json({ error: "Invoice number is required before receiving parts" });
      return;
    }

    // Save invoice number if this is the first time receiving
    if (invoiceNumber && !order.invoiceNumber) {
      await db.update(partsOrdersTable).set({ invoiceNumber }).where(eq(partsOrdersTable.id, orderId));
    }

    for (const receipt of items) {
      if (receipt.qtyReceived <= 0) continue;

      const [orderItem] = await db
        .select()
        .from(partsOrderItemsTable)
        .where(eq(partsOrderItemsTable.id, receipt.orderItemId));
      if (!orderItem) continue;

      const newQtyReceived = orderItem.qtyReceived + receipt.qtyReceived;
      await db
        .update(partsOrderItemsTable)
        .set({ qtyReceived: newQtyReceived, binCode: receipt.binCode ?? orderItem.binCode })
        .where(eq(partsOrderItemsTable.id, orderItem.id));

      const [inv] = await db.select().from(partsItemsTable).where(eq(partsItemsTable.partNumber, orderItem.partNumber));
      if (inv) {
        await db
          .update(partsItemsTable)
          .set({ qtyOnHand: inv.qtyOnHand + receipt.qtyReceived, binCode: receipt.binCode ?? inv.binCode })
          .where(eq(partsItemsTable.id, inv.id));
      }

      // ── Auto-issue to linked RO request ─────────────────────────────────────
      if (orderItem.roRequestItemId && orderItem.qtyForRo > 0) {
        const [roReqItem] = await db.select().from(partsRoRequestItemsTable).where(eq(partsRoRequestItemsTable.id, orderItem.roRequestItemId));
        if (roReqItem) {
          const stillNeeded = roReqItem.qtyRequested - roReqItem.qtyIssued;
          const issueToRo = Math.min(receipt.qtyReceived, Math.max(0, stillNeeded));
          if (issueToRo > 0) {
            // Deduct the RO portion from inventory (we just added it above)
            if (inv) {
              await db.update(partsItemsTable)
                .set({ qtyOnHand: inv.qtyOnHand + receipt.qtyReceived - issueToRo })
                .where(eq(partsItemsTable.id, inv.id));
            }
            const newQtyIssued = roReqItem.qtyIssued + issueToRo;
            const isFullyIssued = newQtyIssued >= roReqItem.qtyRequested;
            await db.update(partsRoRequestItemsTable)
              .set({ qtyIssued: newQtyIssued, itemStatus: isFullyIssued ? "issued" : "partially_issued" })
              .where(eq(partsRoRequestItemsTable.id, roReqItem.id));
            // Check if all items in the RO request are now issued
            if (orderItem.roRequestId) {
              const allRoItems = await db.select().from(partsRoRequestItemsTable).where(eq(partsRoRequestItemsTable.requestId, orderItem.roRequestId));
              const allIssued = allRoItems.every((i) => (i.id === roReqItem.id ? newQtyIssued : i.qtyIssued) >= i.qtyRequested);
              if (allIssued) {
                await db.update(partsRoRequestsTable)
                  .set({ status: "issued", issuedAt: new Date() } as Partial<typeof partsRoRequestsTable.$inferInsert>)
                  .where(eq(partsRoRequestsTable.id, orderItem.roRequestId));
              } else {
                await db.update(partsRoRequestsTable)
                  .set({ status: "picking" } as Partial<typeof partsRoRequestsTable.$inferInsert>)
                  .where(eq(partsRoRequestsTable.id, orderItem.roRequestId));
              }
            }
          }
        }
      }
    }

    const allItems = await db.select().from(partsOrderItemsTable).where(eq(partsOrderItemsTable.orderId, orderId));
    const totalOrdered = allItems.reduce((a, i) => a + i.qtyOrdered, 0);
    const totalReceived = allItems.reduce((a, i) => a + i.qtyReceived, 0);
    const newStatus = totalReceived === 0 ? "ordered" : totalReceived >= totalOrdered ? "received" : "partial";

    const [updatedOrder] = await db
      .update(partsOrdersTable)
      .set({ status: newStatus, receivedAt: newStatus === "received" ? new Date() : undefined } as Partial<typeof partsOrdersTable.$inferInsert>)
      .where(eq(partsOrdersTable.id, orderId))
      .returning();

    // Calculate total amount for items received in this batch and create a vendor bill
    let billTotal = 0;
    for (const receipt of (items as { orderItemId: number; qtyReceived: number; binCode?: string }[])) {
      if (receipt.qtyReceived <= 0) continue;
      const [oi] = await db.select().from(partsOrderItemsTable).where(eq(partsOrderItemsTable.id, receipt.orderItemId));
      if (!oi || !oi.unitCost) continue;
      const unit = parseFloat(oi.unitCost);
      const disc = parseFloat(oi.discountPct ?? "0");
      const markup = parseFloat(oi.markupPct ?? "0");
      const vat = parseFloat(oi.vatPct ?? "5");
      const afterDisc = unit * receipt.qtyReceived * (1 - disc / 100);
      const afterMarkup = afterDisc * (1 + markup / 100);
      billTotal += afterMarkup * (1 + vat / 100);
    }

    let bill = null;
    if (billTotal > 0) {
      const existingBills = await db.select({ billNumber: partsBillsTable.billNumber }).from(partsBillsTable);
      const billNumber = nextNumber("BILL", existingBills.map((b) => b.billNumber));
      const [createdBill] = await db.insert(partsBillsTable).values({
        billNumber,
        orderId,
        supplierName: order.supplierName,
        supplierInvoiceNumber: effectiveInvoice ?? null,
        currency: order.currency ?? "USD",
        exchangeRate: order.exchangeRate ?? "1",
        localCurrencyCode: order.localCurrencyCode ?? "AED",
        totalAmount: billTotal.toFixed(2),
        status: "unpaid",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdBy: receivedBy ?? null,
      } as typeof partsBillsTable.$inferInsert).returning();
      bill = createdBill;
    }

    res.json({ order: { ...updatedOrder, items: allItems }, bill });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to receive items" });
  }
});

// ── OTC Sales ─────────────────────────────────────────────────────────────────
router.get("/parts/sales", async (req, res) => {
  await ensureSeeded();
  try {
    const { status, limit } = req.query;
    let sales = await db.select().from(partsSalesTable).orderBy(desc(partsSalesTable.createdAt));

    if (status) sales = sales.filter((s) => s.status === String(status));
    if (limit) sales = sales.slice(0, parseInt(String(limit)));

    const allItems = await db.select().from(partsSaleItemsTable);
    const result = sales.map((s) => ({
      ...s,
      items: allItems.filter((i) => i.saleId === s.id),
    }));

    res.json({ sales: result, total: result.length });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to load sales" });
  }
});

// ── Sales Returns (Credit Notes) — must be before /parts/sales/:id ──────────────
router.get("/parts/sales/returns", async (req, res) => {
  await ensureSeeded();
  try {
    const returns = await db.select().from(partsSalesReturnsTable).orderBy(desc(partsSalesReturnsTable.createdAt));
    const withItems = await Promise.all(
      returns.map(async (r) => {
        const items = await db.select().from(partsSaleReturnItemsTable).where(eq(partsSaleReturnItemsTable.returnId, r.id));
        return { ...r, items };
      })
    );
    res.json({ returns: withItems });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/parts/sales/:id", async (req, res) => {
  await ensureSeeded();
  try {
    const [sale] = await db
      .select()
      .from(partsSalesTable)
      .where(eq(partsSalesTable.id, parseInt(req.params.id)));
    if (!sale) { res.status(404).json({ error: "Sale not found" }); return; }
    const items = await db.select().from(partsSaleItemsTable).where(eq(partsSaleItemsTable.saleId, sale.id));
    res.json({ ...sale, items });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/parts/sales", async (req, res) => {
  await ensureSeeded();
  try {
    const { customerName, customerRef, currency, exchangeRate, localCurrencyCode, notes, createdBy, items = [] } = req.body;
    const existing = await db.select({ saleNumber: partsSalesTable.saleNumber }).from(partsSalesTable);
    const saleNumber = nextNumber("INV", existing.map((s) => s.saleNumber));

    const [sale] = await db.insert(partsSalesTable).values({
      saleNumber,
      customerName: customerName ?? null,
      customerRef: customerRef ?? null,
      status: "confirmed",
      currency: currency ?? "USD",
      exchangeRate: exchangeRate ? String(exchangeRate) : "1",
      localCurrencyCode: localCurrencyCode ?? "AED",
      notes: notes ?? null,
      createdBy: createdBy ?? "PT",
      confirmedAt: new Date(),
    } as typeof partsSalesTable.$inferInsert).returning();

    if (items.length > 0) {
      await db.insert(partsSaleItemsTable).values(
        (items as Array<{partNumber: string; partName: string; qty: number; unitPrice: string; discountPct?: string; markupPct?: string; vatPct?: string; currency?: string}>).map((i) => ({
          saleId: sale.id,
          partNumber: String(i.partNumber).toUpperCase(),
          partName: i.partName,
          qty: parseInt(String(i.qty)),
          unitPrice: String(i.unitPrice),
          discountPct: i.discountPct ?? "0",
          markupPct: i.markupPct ?? "0",
          vatPct: i.vatPct ?? "5",
          currency: i.currency ?? currency ?? "USD",
        })) as typeof partsSaleItemsTable.$inferInsert[]
      );

      // Deduct stock
      for (const item of items as Array<{partNumber: string; qty: number}>) {
        const [inv] = await db.select().from(partsItemsTable).where(eq(partsItemsTable.partNumber, String(item.partNumber).toUpperCase()));
        if (inv && inv.qtyOnHand >= item.qty) {
          await db.update(partsItemsTable)
            .set({ qtyOnHand: inv.qtyOnHand - item.qty })
            .where(eq(partsItemsTable.id, inv.id));
        }
      }
    }

    const saleItems = await db.select().from(partsSaleItemsTable).where(eq(partsSaleItemsTable.saleId, sale.id));
    res.status(201).json({ ...sale, items: saleItems });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create sale" });
  }
});

// ── Sales Payment ──────────────────────────────────────────────────────────────
router.post("/parts/sales/:id/payment", async (req, res) => {
  await ensureSeeded();
  try {
    const saleId = parseInt(req.params.id);
    const { paymentMethod, paymentRef } = req.body as { paymentMethod?: string; paymentRef?: string };

    const [sale] = await db.select().from(partsSalesTable).where(eq(partsSalesTable.id, saleId));
    if (!sale) { res.status(404).json({ error: "Sale not found" }); return; }
    if (sale.status === "paid") { res.status(400).json({ error: "Sale already paid" }); return; }

    const [updated] = await db
      .update(partsSalesTable)
      .set({
        status: "paid",
        paymentMethod: paymentMethod ?? "cash",
        paymentRef: paymentRef ?? null,
        paidAt: new Date(),
      } as Partial<typeof partsSalesTable.$inferInsert>)
      .where(eq(partsSalesTable.id, saleId))
      .returning();

    const items = await db.select().from(partsSaleItemsTable).where(eq(partsSaleItemsTable.saleId, saleId));
    res.json({ ...updated, items });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to record payment" });
  }
});

// ── Count Sessions ─────────────────────────────────────────────────────────────
router.get("/parts/count-sessions", async (req, res) => {
  await ensureSeeded();
  try {
    const sessions = await db.select().from(partsCountSessionsTable).orderBy(desc(partsCountSessionsTable.createdAt));
    const withStats = await Promise.all(
      sessions.map(async (s) => {
        const items = await db.select().from(partsCountItemsTable).where(eq(partsCountItemsTable.sessionId, s.id));
        const counted = items.filter((i) => i.countedQty !== null);
        const variance = counted.reduce((acc, i) => acc + ((i.countedQty ?? 0) - i.expectedQty), 0);
        return { ...s, itemCount: items.length, variance };
      })
    );
    res.json({ sessions: withStats });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/parts/count-sessions", async (req, res) => {
  await ensureSeeded();
  try {
    const { startedBy, notes } = req.body;
    const existing = await db.select({ sessionNumber: partsCountSessionsTable.sessionNumber }).from(partsCountSessionsTable);
    const sessionNumber = nextNumber("COUNT", existing.map((s) => s.sessionNumber));

    const [session] = await db.insert(partsCountSessionsTable).values({
      sessionNumber,
      startedBy,
      notes: notes ?? null,
      status: "in_progress",
    }).returning();

    res.status(201).json({ session });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to start count" });
  }
});

router.get("/parts/count-sessions/:id", async (req, res) => {
  await ensureSeeded();
  try {
    const [session] = await db.select().from(partsCountSessionsTable).where(eq(partsCountSessionsTable.id, parseInt(req.params.id)));
    if (!session) { res.status(404).json({ error: "Session not found" }); return; }
    const items = await db.select().from(partsCountItemsTable).where(eq(partsCountItemsTable.sessionId, session.id));
    res.json({ session, items });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/parts/count-sessions/:id/items", async (req, res) => {
  await ensureSeeded();
  try {
    const sessionId = parseInt(req.params.id);
    const { partNumber, partName, binCode, expectedQty, countedQty, countItemId } = req.body;

    if (countItemId) {
      const [item] = await db
        .update(partsCountItemsTable)
        .set({ countedQty: countedQty ?? null })
        .where(eq(partsCountItemsTable.id, countItemId))
        .returning();
      res.json({ item }); return;
    }

    const [item] = await db.insert(partsCountItemsTable).values({
      sessionId,
      partNumber,
      partName,
      binCode: binCode ?? null,
      expectedQty: parseInt(expectedQty),
      countedQty: countedQty !== undefined ? parseInt(countedQty) : null,
    }).returning();

    res.status(201).json({ item });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

router.patch("/parts/count-sessions/:id/complete", async (req, res) => {
  await ensureSeeded();
  try {
    const sessionId = parseInt(req.params.id);
    const items = await db.select().from(partsCountItemsTable).where(eq(partsCountItemsTable.sessionId, sessionId));
    const counted = items.filter((i) => i.countedQty !== null);

    for (const ci of counted) {
      const [inv] = await db.select().from(partsItemsTable).where(eq(partsItemsTable.partNumber, ci.partNumber));
      if (inv) {
        await db.update(partsItemsTable)
          .set({ qtyOnHand: ci.countedQty!, lastCountedAt: new Date() })
          .where(eq(partsItemsTable.id, inv.id));
      }
    }

    const [session] = await db
      .update(partsCountSessionsTable)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(partsCountSessionsTable.id, sessionId))
      .returning();

    res.json({ session });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to complete count" });
  }
});

// ── Smart Suggestions ─────────────────────────────────────────────────────────
router.get("/parts/suggestions", async (req, res) => {
  await ensureSeeded();
  try {
    const items = await db.select().from(partsItemsTable);

    const suggestions = items
      .map((item) => {
        const suggestedQty = Math.max(0, item.maxStock - item.qtyOnHand);
        const pctOfMin = item.qtyOnHand / Math.max(1, item.minStock);

        if (item.qtyOnHand === 0) {
          return { ...item, priority: "critical" as const, reason: `Out of stock — ${item.minStock} units minimum required`, action: `Order ${suggestedQty} units`, suggestedQty };
        }
        if (pctOfMin < 0.5) {
          return { ...item, priority: "urgent" as const, reason: `Critically low — ${item.qtyOnHand} units (${Math.round(pctOfMin * 100)}% of minimum)`, action: `Order ${suggestedQty} units`, suggestedQty };
        }
        if (item.qtyOnHand < item.minStock) {
          return { ...item, priority: "warning" as const, reason: `Below minimum — ${item.qtyOnHand}/${item.minStock} units`, action: `Order ${suggestedQty} units`, suggestedQty };
        }
        const daysSinceCounted = item.lastCountedAt
          ? (Date.now() - new Date(item.lastCountedAt).getTime()) / 86400000
          : 999;
        if (daysSinceCounted > 30) {
          return { ...item, priority: "info" as const, reason: `Not counted in ${daysSinceCounted > 999 ? "never" : Math.round(daysSinceCounted) + " days"}`, action: "Include in next cycle count", suggestedQty: 0 };
        }
        return null;
      })
      .filter(Boolean);

    const priorityOrder: Record<string, number> = { critical: 0, urgent: 1, warning: 2, info: 3 };
    suggestions.sort((a: any, b: any) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4));

    const summary = {
      critical: suggestions.filter((s: any) => s?.priority === "critical").length,
      urgent:   suggestions.filter((s: any) => s?.priority === "urgent").length,
      warning:  suggestions.filter((s: any) => s?.priority === "warning").length,
      info:     suggestions.filter((s: any) => s?.priority === "info").length,
      total:    suggestions.length,
    };

    res.json({ suggestions, summary });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to load suggestions" });
  }
});

// ── Inter-Branch Transfers ─────────────────────────────────────────────────────
router.get("/parts/transfers", async (req, res) => {
  await ensureSeeded();
  try {
    const { status } = req.query;
    let transfers = await db.select().from(partsTransfersTable).orderBy(desc(partsTransfersTable.createdAt));
    if (status) transfers = transfers.filter((t) => t.status === String(status));

    const allItems = await db.select().from(partsTransferItemsTable);
    const result = transfers.map((t) => ({
      ...t,
      items: allItems.filter((i) => i.transferId === t.id),
    }));

    res.json({ transfers: result, total: result.length });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to load transfers" });
  }
});

router.get("/parts/transfers/:id", async (req, res) => {
  await ensureSeeded();
  try {
    const [transfer] = await db.select().from(partsTransfersTable).where(eq(partsTransfersTable.id, parseInt(req.params.id)));
    if (!transfer) { res.status(404).json({ error: "Transfer not found" }); return; }
    const items = await db.select().from(partsTransferItemsTable).where(eq(partsTransferItemsTable.transferId, transfer.id));
    res.json({ ...transfer, items });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/parts/transfers", async (req, res) => {
  await ensureSeeded();
  try {
    const { fromBranch, toBranch, notes, requestedBy, items = [] } = req.body;
    const existing = await db.select({ transferNumber: partsTransfersTable.transferNumber }).from(partsTransfersTable);
    const transferNumber = nextNumber("TRF", existing.map((t) => t.transferNumber));

    const [transfer] = await db.insert(partsTransfersTable).values({
      transferNumber,
      fromBranch,
      toBranch,
      status: "requested",
      requestedBy: requestedBy ?? "PT",
      notes: notes ?? null,
    } as typeof partsTransfersTable.$inferInsert).returning();

    if (items.length > 0) {
      await db.insert(partsTransferItemsTable).values(
        (items as Array<{partNumber: string; partName: string; qtyRequested: number}>).map((i) => ({
          transferId: transfer.id,
          partNumber: String(i.partNumber).toUpperCase(),
          partName: i.partName,
          qtyRequested: parseInt(String(i.qtyRequested)),
        })) as typeof partsTransferItemsTable.$inferInsert[]
      );
    }

    const transferItems = await db.select().from(partsTransferItemsTable).where(eq(partsTransferItemsTable.transferId, transfer.id));
    res.status(201).json({ ...transfer, items: transferItems });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create transfer" });
  }
});

router.patch("/parts/transfers/:id", async (req, res) => {
  await ensureSeeded();
  try {
    const { status, notes } = req.body;
    const updates: Record<string, unknown> = {};
    if (status) {
      updates.status = status;
      if (status === "shipped") updates.shippedAt = new Date();
      if (status === "received") updates.receivedAt = new Date();
    }
    if (notes !== undefined) updates.notes = notes;

    const [transfer] = await db
      .update(partsTransfersTable)
      .set(updates)
      .where(eq(partsTransfersTable.id, parseInt(req.params.id)))
      .returning();
    res.json(transfer);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// ── Workshop RO Requests ───────────────────────────────────────────────────────
router.get("/parts/ro-requests", async (req, res) => {
  await ensureSeeded();
  try {
    const { status, department } = req.query;
    let requests = await db.select().from(partsRoRequestsTable).orderBy(desc(partsRoRequestsTable.createdAt));
    if (status) requests = requests.filter((r) => r.status === String(status));
    if (department) requests = requests.filter((r) => r.department === String(department));

    const allItems = await db.select().from(partsRoRequestItemsTable);
    const result = requests.map((r) => ({
      ...r,
      items: allItems.filter((i) => i.requestId === r.id),
    }));

    res.json({ requests: result, total: result.length });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to load RO requests" });
  }
});

router.get("/parts/ro-requests/:id", async (req, res) => {
  await ensureSeeded();
  try {
    const [request] = await db.select().from(partsRoRequestsTable).where(eq(partsRoRequestsTable.id, parseInt(req.params.id)));
    if (!request) { res.status(404).json({ error: "Request not found" }); return; }
    const items = await db.select().from(partsRoRequestItemsTable).where(eq(partsRoRequestItemsTable.requestId, request.id));
    res.json({ ...request, items });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/parts/ro-requests", async (req, res) => {
  await ensureSeeded();
  try {
    const { roNumber, department, notes, requestedBy, items = [] } = req.body;
    const existing = await db.select({ requestNumber: partsRoRequestsTable.requestNumber }).from(partsRoRequestsTable);
    const requestNumber = nextNumber("PRQ", existing.map((r) => r.requestNumber));

    const [request] = await db.insert(partsRoRequestsTable).values({
      requestNumber,
      roNumber,
      department: department ?? "Service",
      status: "pending",
      requestedBy: requestedBy ?? "PT",
      notes: notes ?? null,
    } as typeof partsRoRequestsTable.$inferInsert).returning();

    if (items.length > 0) {
      await db.insert(partsRoRequestItemsTable).values(
        (items as Array<{partNumber: string; partName: string; qtyRequested: number; unitCost?: string; notes?: string}>).map((i) => ({
          requestId: request.id,
          partNumber: String(i.partNumber).toUpperCase(),
          partName: i.partName,
          qtyRequested: parseInt(String(i.qtyRequested)),
          unitCost: i.unitCost ? String(i.unitCost) : null,
          notes: i.notes ?? null,
        })) as typeof partsRoRequestItemsTable.$inferInsert[]
      );
    }

    const requestItems = await db.select().from(partsRoRequestItemsTable).where(eq(partsRoRequestItemsTable.requestId, request.id));
    res.status(201).json({ ...request, items: requestItems });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create RO request" });
  }
});

router.post("/parts/ro-requests/:id/issue", async (req, res) => {
  await ensureSeeded();
  try {
    const requestId = parseInt(req.params.id);
    const { items = [] }: { items: { requestItemId: number; qtyIssued: number }[] } = req.body;

    const [request] = await db.select().from(partsRoRequestsTable).where(eq(partsRoRequestsTable.id, requestId));
    if (!request) { res.status(404).json({ error: "Request not found" }); return; }

    for (const issue of items) {
      if (issue.qtyIssued <= 0) continue;

      const [reqItem] = await db.select().from(partsRoRequestItemsTable).where(eq(partsRoRequestItemsTable.id, issue.requestItemId));
      if (!reqItem) continue;

      await db.update(partsRoRequestItemsTable)
        .set({ qtyIssued: reqItem.qtyIssued + issue.qtyIssued })
        .where(eq(partsRoRequestItemsTable.id, reqItem.id));

      const [inv] = await db.select().from(partsItemsTable).where(eq(partsItemsTable.partNumber, reqItem.partNumber));
      if (inv) {
        await db.update(partsItemsTable)
          .set({ qtyOnHand: Math.max(0, inv.qtyOnHand - issue.qtyIssued) })
          .where(eq(partsItemsTable.id, inv.id));
      }
    }

    const allItems = await db.select().from(partsRoRequestItemsTable).where(eq(partsRoRequestItemsTable.requestId, requestId));
    const allIssued = allItems.every((i) => i.qtyIssued >= i.qtyRequested);
    const newStatus = allIssued ? "issued" : "picking";

    const [updatedRequest] = await db
      .update(partsRoRequestsTable)
      .set({ status: newStatus, issuedAt: allIssued ? new Date() : undefined } as Partial<typeof partsRoRequestsTable.$inferInsert>)
      .where(eq(partsRoRequestsTable.id, requestId))
      .returning();

    res.json({ request: { ...updatedRequest, items: allItems } });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to issue parts" });
  }
});

// ── Smart RO Issue (check stock → issue or auto-PO) ────────────────────────────
router.post("/parts/ro-requests/:id/smart-issue", async (req, res) => {
  await ensureSeeded();
  try {
    const requestId = parseInt(req.params.id);
    const { issuedBy, supplierName, supplierCode } = req.body as { issuedBy?: string; supplierName?: string; supplierCode?: string };

    const [request] = await db.select().from(partsRoRequestsTable).where(eq(partsRoRequestsTable.id, requestId));
    if (!request) { res.status(404).json({ error: "Request not found" }); return; }

    const reqItems = await db.select().from(partsRoRequestItemsTable).where(eq(partsRoRequestItemsTable.requestId, requestId));

    const issuedNow: { partNumber: string; partName: string; qty: number }[] = [];
    const needsPo: { partNumber: string; partName: string; qtyNeeded: number; unitCost?: string | null }[] = [];

    for (const item of reqItems) {
      const remaining = item.qtyRequested - item.qtyIssued;
      if (remaining <= 0) continue;

      const [inv] = await db.select().from(partsItemsTable).where(eq(partsItemsTable.partNumber, item.partNumber));
      const stock = inv?.qtyOnHand ?? 0;

      if (stock >= remaining) {
        // Issue all from stock
        await db.update(partsRoRequestItemsTable)
          .set({ qtyIssued: item.qtyIssued + remaining, itemStatus: "issued" })
          .where(eq(partsRoRequestItemsTable.id, item.id));
        if (inv) {
          await db.update(partsItemsTable)
            .set({ qtyOnHand: inv.qtyOnHand - remaining })
            .where(eq(partsItemsTable.id, inv.id));
        }
        issuedNow.push({ partNumber: item.partNumber, partName: item.partName, qty: remaining });
      } else {
        // Issue partial from stock, order the rest
        const issueNow = stock;
        const orderQty = remaining - issueNow;
        if (issueNow > 0) {
          await db.update(partsRoRequestItemsTable)
            .set({ qtyIssued: item.qtyIssued + issueNow, itemStatus: "partially_issued", qtyFromPo: orderQty })
            .where(eq(partsRoRequestItemsTable.id, item.id));
          if (inv) {
            await db.update(partsItemsTable).set({ qtyOnHand: 0 }).where(eq(partsItemsTable.id, inv.id));
          }
          issuedNow.push({ partNumber: item.partNumber, partName: item.partName, qty: issueNow });
        } else {
          await db.update(partsRoRequestItemsTable)
            .set({ itemStatus: "po_pending", qtyFromPo: orderQty })
            .where(eq(partsRoRequestItemsTable.id, item.id));
        }
        needsPo.push({ partNumber: item.partNumber, partName: item.partName, qtyNeeded: orderQty, unitCost: inv?.unitCost });
      }
    }

    // Create a single draft PO for all items that need ordering
    let createdPo: typeof partsOrdersTable.$inferSelect & { itemCount: number } | null = null;
    if (needsPo.length > 0) {
      const existingOrders = await db.select({ orderNumber: partsOrdersTable.orderNumber }).from(partsOrdersTable);
      const orderNumber = nextNumber("PO", existingOrders.map((o) => o.orderNumber));

      const [po] = await db.insert(partsOrdersTable).values({
        orderNumber,
        supplierCode: supplierCode ?? "TBD",
        supplierName: supplierName ?? `RO ${request.roNumber} Supplier`,
        status: "draft",
        currency: "AED",
        notes: `Auto-created for RO ${request.roNumber} · ${request.requestNumber}`,
        createdBy: issuedBy ?? null,
      } as typeof partsOrdersTable.$inferInsert).returning();

      for (const needed of needsPo) {
        const reqItem = reqItems.find((i) => i.partNumber === needed.partNumber);
        const [orderItem] = await db.insert(partsOrderItemsTable).values({
          orderId: po.id,
          partNumber: needed.partNumber,
          partName: needed.partName,
          qtyOrdered: needed.qtyNeeded,
          qtyReceived: 0,
          unitCost: needed.unitCost ? String(needed.unitCost) : null,
          roRequestItemId: reqItem?.id ?? null,
          roRequestId: requestId,
          qtyForRo: needed.qtyNeeded,
        } as typeof partsOrderItemsTable.$inferInsert).returning();

        if (reqItem) {
          await db.update(partsRoRequestItemsTable)
            .set({ linkedPoId: po.id, linkedPoItemId: orderItem.id })
            .where(eq(partsRoRequestItemsTable.id, reqItem.id));
        }
      }
      createdPo = { ...po, itemCount: needsPo.length };
    }

    // Update request status
    const updatedItems = await db.select().from(partsRoRequestItemsTable).where(eq(partsRoRequestItemsTable.requestId, requestId));
    const allIssued = updatedItems.every((i) => i.qtyIssued >= i.qtyRequested);
    const anyIssued = updatedItems.some((i) => i.qtyIssued > 0);
    const newStatus: "pending" | "picking" | "issued" | "cancelled" =
      allIssued ? "issued" : (anyIssued || needsPo.length > 0) ? "picking" : "pending";

    const [updatedRequest] = await db.update(partsRoRequestsTable)
      .set({ status: newStatus, issuedAt: allIssued ? new Date() : undefined } as Partial<typeof partsRoRequestsTable.$inferInsert>)
      .where(eq(partsRoRequestsTable.id, requestId))
      .returning();

    res.json({
      request: { ...updatedRequest, items: updatedItems },
      issuedNow,
      createdPo,
      summary: {
        totalItems: reqItems.length,
        issuedFromStock: issuedNow.length,
        orderedViaPo: needsPo.length,
      },
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to smart-issue" });
  }
});

// ── PO Approval ────────────────────────────────────────────────────────────────
router.patch("/parts/orders/:id/approve", async (req, res) => {
  await ensureSeeded();
  try {
    const orderId = parseInt(req.params.id);
    const { approvedBy } = req.body as { approvedBy?: string };
    const [order] = await db.select().from(partsOrdersTable).where(eq(partsOrdersTable.id, orderId));
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (order.status !== "draft") { res.status(400).json({ error: "Only draft orders can be approved" }); return; }
    const [updated] = await db
      .update(partsOrdersTable)
      .set({ status: "ordered", approvedBy: approvedBy ?? null, approvedAt: new Date(), orderedAt: new Date() } as Partial<typeof partsOrdersTable.$inferInsert>)
      .where(eq(partsOrdersTable.id, orderId))
      .returning();
    const items = await db.select().from(partsOrderItemsTable).where(eq(partsOrderItemsTable.orderId, orderId));
    res.json({ ...updated, items });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to approve order" });
  }
});

router.post("/parts/sales/:id/return", async (req, res) => {
  await ensureSeeded();
  try {
    const saleId = parseInt(req.params.id);
    const { reason, createdBy, items = [] } = req.body as {
      reason?: string;
      createdBy?: string;
      items: { saleItemId: number; partNumber: string; partName: string; qty: number; unitPrice: string; discountPct?: string; vatPct?: string; reason?: string }[];
    };
    const [sale] = await db.select().from(partsSalesTable).where(eq(partsSalesTable.id, saleId));
    if (!sale) { res.status(404).json({ error: "Sale not found" }); return; }

    const existing = await db.select({ returnNumber: partsSalesReturnsTable.returnNumber }).from(partsSalesReturnsTable);
    const returnNumber = nextNumber("CRN", existing.map((r) => r.returnNumber));

    const [saleReturn] = await db.insert(partsSalesReturnsTable).values({
      returnNumber,
      originalSaleId: saleId,
      customerName: sale.customerName,
      reason: reason ?? null,
      currency: sale.currency,
      exchangeRate: String(sale.exchangeRate ?? "1"),
      localCurrencyCode: sale.localCurrencyCode,
      status: "confirmed",
      createdBy: createdBy ?? null,
    } as typeof partsSalesReturnsTable.$inferInsert).returning();

    if (items.length > 0) {
      await db.insert(partsSaleReturnItemsTable).values(
        items.map((i) => ({
          returnId: saleReturn.id,
          originalSaleItemId: i.saleItemId ?? null,
          partNumber: i.partNumber,
          partName: i.partName,
          qty: i.qty,
          unitPrice: String(i.unitPrice),
          discountPct: String(i.discountPct ?? "0"),
          vatPct: String(i.vatPct ?? "5"),
          reason: i.reason ?? null,
        })) as typeof partsSaleReturnItemsTable.$inferInsert[]
      );
      // Restore stock
      for (const item of items) {
        const [part] = await db.select().from(partsItemsTable).where(eq(partsItemsTable.partNumber, item.partNumber));
        if (part) {
          await db.update(partsItemsTable).set({ qtyOnHand: part.qtyOnHand + item.qty }).where(eq(partsItemsTable.id, part.id));
        }
      }
    }

    const returnItems = await db.select().from(partsSaleReturnItemsTable).where(eq(partsSaleReturnItemsTable.returnId, saleReturn.id));
    res.status(201).json({ ...saleReturn, items: returnItems });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create return" });
  }
});

// ── Supplier Returns ────────────────────────────────────────────────────────────
router.get("/parts/supplier-returns", async (req, res) => {
  await ensureSeeded();
  try {
    const returns = await db.select().from(partsSupplierReturnsTable).orderBy(desc(partsSupplierReturnsTable.createdAt));
    const withItems = await Promise.all(
      returns.map(async (r) => {
        const items = await db.select().from(partsSupplierReturnItemsTable).where(eq(partsSupplierReturnItemsTable.returnId, r.id));
        return { ...r, items };
      })
    );
    res.json({ returns: withItems });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/parts/orders/:id/supplier-return", async (req, res) => {
  await ensureSeeded();
  try {
    const orderId = parseInt(req.params.id);
    const { reason, notes, createdBy, items = [] } = req.body as {
      reason?: string; notes?: string; createdBy?: string;
      items: { partNumber: string; partName: string; qty: number; unitCost?: string; reason?: string }[];
    };
    const [order] = await db.select().from(partsOrdersTable).where(eq(partsOrdersTable.id, orderId));
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    const existing = await db.select({ returnNumber: partsSupplierReturnsTable.returnNumber }).from(partsSupplierReturnsTable);
    const returnNumber = nextNumber("SRN", existing.map((r) => r.returnNumber));

    const [supplierReturn] = await db.insert(partsSupplierReturnsTable).values({
      returnNumber,
      orderId,
      supplierName: order.supplierName,
      supplierCode: order.supplierCode,
      reason: reason ?? null,
      notes: notes ?? null,
      currency: order.currency,
      exchangeRate: String(order.exchangeRate ?? "1"),
      localCurrencyCode: order.localCurrencyCode,
      status: "pending",
      createdBy: createdBy ?? null,
    } as typeof partsSupplierReturnsTable.$inferInsert).returning();

    if (items.length > 0) {
      await db.insert(partsSupplierReturnItemsTable).values(
        items.map((i) => ({
          returnId: supplierReturn.id,
          partNumber: i.partNumber,
          partName: i.partName,
          qty: i.qty,
          unitCost: i.unitCost ? String(i.unitCost) : "0",
          reason: i.reason ?? null,
        })) as typeof partsSupplierReturnItemsTable.$inferInsert[]
      );
      // Reduce stock
      for (const item of items) {
        const [part] = await db.select().from(partsItemsTable).where(eq(partsItemsTable.partNumber, item.partNumber));
        if (part) {
          await db.update(partsItemsTable).set({ qtyOnHand: Math.max(0, part.qtyOnHand - item.qty) }).where(eq(partsItemsTable.id, part.id));
        }
      }
    }

    const returnItems = await db.select().from(partsSupplierReturnItemsTable).where(eq(partsSupplierReturnItemsTable.returnId, supplierReturn.id));
    res.status(201).json({ ...supplierReturn, items: returnItems });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create supplier return" });
  }
});

// ── AI Stock Review ─────────────────────────────────────────────────────────────
router.post("/parts/ai/stock-review", async (req, res) => {
  await ensureSeeded();
  try {
    const { createdBy } = req.body as { createdBy?: string };
    const allParts = await db.select().from(partsItemsTable);
    const lowStock = allParts.filter((p) => p.qtyOnHand <= Math.ceil(p.minStock * 1.5));

    if (lowStock.length === 0) {
      res.json({ summary: "All stock levels are healthy — no restocking needed at this time.", draftOrders: [], lowStockCount: 0 });
      return;
    }

    const anthropic = new Anthropic({
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    });

    const partsList = lowStock.map((p) =>
      `${p.partNumber}|${p.name}|qty:${p.qtyOnHand}|min:${p.minStock}|max:${p.maxStock}|supplier:${p.supplierCode ?? "UNKNOWN"}|cost:${p.unitCost ?? "0"}`
    ).join("\n");

    const aiMsg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      messages: [{
        role: "user",
        content: `You are an automotive parts inventory AI. Analyze low-stock items and recommend purchase orders. Respond ONLY with valid JSON, no markdown.

LOW STOCK ITEMS (format: partNumber|name|qty:current|min:threshold|max:target|supplier:code|cost:unitCost):
${partsList}

JSON response format:
{"summary":"2-3 sentence analysis","recommendations":[{"supplierCode":"code or UNKNOWN","supplierName":"name or Unknown Supplier","priority":"critical|high|normal","items":[{"partNumber":"","partName":"","currentQty":0,"minStock":0,"maxStock":0,"suggestedQty":0}]}]}`
      }],
    });

    const rawText = aiMsg.content[0]?.type === "text" ? aiMsg.content[0].text.trim() : "{}";
    let aiData: { summary: string; recommendations: Array<{ supplierCode: string; supplierName: string; priority: string; items: Array<{ partNumber: string; partName: string; currentQty: number; minStock: number; maxStock: number; suggestedQty: number }> }> };
    try {
      const j = rawText.slice(rawText.indexOf("{"), rawText.lastIndexOf("}") + 1);
      aiData = JSON.parse(j);
    } catch {
      aiData = { summary: rawText.slice(0, 400), recommendations: [] };
    }

    const draftOrders: object[] = [];
    for (const rec of aiData.recommendations ?? []) {
      if (!rec.items?.length) continue;
      const allOrders = await db.select({ orderNumber: partsOrdersTable.orderNumber }).from(partsOrdersTable);
      const orderNumber = nextNumber("PO", allOrders.map((o) => o.orderNumber));
      const [order] = await db.insert(partsOrdersTable).values({
        orderNumber,
        supplierCode: rec.supplierCode ?? "UNKNOWN",
        supplierName: rec.supplierName ?? "Unknown Supplier",
        status: "draft",
        notes: `AI-generated (${rec.priority ?? "normal"} priority) — ${new Date().toLocaleDateString("en-GB")}`,
        currency: "USD",
        localCurrencyCode: "AED",
        createdBy: createdBy ?? "AI",
      } as typeof partsOrdersTable.$inferInsert).returning();
      await db.insert(partsOrderItemsTable).values(
        rec.items.map((i) => ({ orderId: order.id, partNumber: i.partNumber, partName: i.partName, qtyOrdered: Math.max(1, i.suggestedQty ?? 1), qtyReceived: 0 })) as typeof partsOrderItemsTable.$inferInsert[]
      );
      draftOrders.push({ ...order, priority: rec.priority, itemCount: rec.items.length });
    }

    res.json({ summary: aiData.summary, draftOrders, lowStockCount: lowStock.length });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "AI stock review failed" });
  }
});

// ── RFQ (Request for Quotation) ─────────────────────────────────────────────────
router.get("/parts/rfq", async (req, res) => {
  await ensureSeeded();
  try {
    const rfqs = await db.select().from(partsRfqTable).orderBy(desc(partsRfqTable.createdAt));
    const withDetails = await Promise.all(
      rfqs.map(async (r) => {
        const items = await db.select().from(partsRfqItemsTable).where(eq(partsRfqItemsTable.rfqId, r.id));
        const suppliers = await db.select().from(partsRfqSuppliersTable).where(eq(partsRfqSuppliersTable.rfqId, r.id));
        return { ...r, items, suppliers };
      })
    );
    res.json({ rfqs: withDetails });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/parts/rfq", async (req, res) => {
  await ensureSeeded();
  try {
    const { subject, notes, dueDate, createdBy, items = [], suppliers = [] } = req.body as {
      subject?: string; notes?: string; dueDate?: string; createdBy?: string;
      items: { partNumber?: string; partName: string; description?: string; qtyRequired: number; unitOfMeasure?: string }[];
      suppliers: { supplierName: string; supplierCode?: string; contactEmail?: string; contactPhone?: string }[];
    };
    const existing = await db.select({ rfqNumber: partsRfqTable.rfqNumber }).from(partsRfqTable);
    const rfqNumber = nextNumber("RFQ", existing.map((r) => r.rfqNumber));
    const token = randomBytes(20).toString("hex");

    const [rfq] = await db.insert(partsRfqTable).values({
      rfqNumber, token, subject: subject ?? null, notes: notes ?? null,
      status: "draft", createdBy: createdBy ?? null,
      dueDate: dueDate ? new Date(dueDate) : null,
    } as typeof partsRfqTable.$inferInsert).returning();

    if (items.length > 0) {
      await db.insert(partsRfqItemsTable).values(
        items.map((i) => ({ rfqId: rfq.id, partNumber: i.partNumber ?? null, partName: i.partName, description: i.description ?? null, qtyRequired: i.qtyRequired, unitOfMeasure: i.unitOfMeasure ?? "EA" })) as typeof partsRfqItemsTable.$inferInsert[]
      );
    }
    if (suppliers.length > 0) {
      await db.insert(partsRfqSuppliersTable).values(
        suppliers.map((s) => ({ rfqId: rfq.id, supplierName: s.supplierName, supplierCode: s.supplierCode ?? null, contactEmail: s.contactEmail ?? null, contactPhone: s.contactPhone ?? null })) as typeof partsRfqSuppliersTable.$inferInsert[]
      );
    }

    const rfqItems = await db.select().from(partsRfqItemsTable).where(eq(partsRfqItemsTable.rfqId, rfq.id));
    const rfqSuppliers = await db.select().from(partsRfqSuppliersTable).where(eq(partsRfqSuppliersTable.rfqId, rfq.id));
    res.status(201).json({ ...rfq, items: rfqItems, suppliers: rfqSuppliers });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create RFQ" });
  }
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

router.get("/parts/rfq/:token/form", async (req, res) => {
  try {
    const [rfq] = await db.select().from(partsRfqTable).where(eq(partsRfqTable.token, req.params.token));
    if (!rfq) { res.status(404).send("<h1>RFQ not found or expired</h1>"); return; }
    const items = await db.select().from(partsRfqItemsTable).where(eq(partsRfqItemsTable.rfqId, rfq.id));
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RFQ ${escapeHtml(rfq.rfqNumber)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:16px;color:#1e293b}h1{color:#7c3aed}h2{color:#475569;font-size:15px;font-weight:600;margin-top:24px}table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#f1f5f9;padding:10px 12px;text-align:left;font-size:13px;color:#475569;border:1px solid #e2e8f0}td{padding:10px 12px;border:1px solid #e2e8f0;font-size:14px}input[type=number],input[type=text]{width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;box-sizing:border-box}button{background:#7c3aed;color:#fff;border:none;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;margin-top:20px}button:hover{background:#6d28d9}.badge{display:inline-block;background:#ede9fe;color:#7c3aed;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600}.meta{color:#64748b;font-size:13px;margin-top:4px}.success{background:#dcfce7;color:#16a34a;padding:20px;border-radius:10px;text-align:center;font-size:16px;font-weight:600;display:none}input[name=supplierName]{width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:15px;margin-bottom:8px;box-sizing:border-box}label{display:block;font-size:13px;color:#64748b;margin-bottom:4px;font-weight:500}</style></head>
<body>
<h1>📋 Request for Quotation</h1>
<span class="badge">${escapeHtml(rfq.rfqNumber)}</span>
${rfq.subject ? `<p style="margin-top:12px;font-size:16px;font-weight:600">${escapeHtml(rfq.subject)}</p>` : ""}
${rfq.dueDate ? `<p class="meta">⏰ Response required by: <strong>${new Date(rfq.dueDate).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })}</strong></p>` : ""}
${rfq.notes ? `<p class="meta">📝 ${escapeHtml(rfq.notes)}</p>` : ""}

<div id="form-area">
<h2>Your Company</h2>
<label>Supplier / Company Name *</label>
<input type="text" name="supplierName" id="supplierName" placeholder="Your company name" required>
<label>Contact Email</label>
<input type="text" name="contactEmail" id="contactEmail" placeholder="your@email.com">
<label>Notes / Comments</label>
<input type="text" name="suppNotes" id="suppNotes" placeholder="Lead times, special conditions...">

<h2>Parts Pricing</h2>
<table>
<thead><tr><th>#</th><th>Part Number</th><th>Description</th><th>Qty</th><th>Unit</th><th>Unit Price (USD)</th><th>Lead Time (days)</th><th>Available?</th></tr></thead>
<tbody>
${items.map((item, idx) => `<tr>
  <td>${idx + 1}</td>
  <td>${item.partNumber != null ? escapeHtml(item.partNumber) : "—"}</td>
  <td>${escapeHtml(item.partName)}${item.description ? `<br><small style="color:#64748b">${escapeHtml(item.description)}</small>` : ""}</td>
  <td>${item.qtyRequired}</td>
  <td>${item.unitOfMeasure != null ? escapeHtml(item.unitOfMeasure) : "EA"}</td>
  <td><input type="number" id="price_${item.id}" min="0" step="0.01" placeholder="0.00"></td>
  <td><input type="number" id="lead_${item.id}" min="0" step="1" placeholder="7"></td>
  <td><select id="avail_${item.id}"><option value="yes">Yes</option><option value="partial">Partial</option><option value="no">No</option></select></td>
</tr>`).join("")}
</tbody>
</table>

<button onclick="submitRFQ()">Submit Quotation</button>
</div>
<div class="success" id="success-msg">✅ Thank you! Your quotation has been submitted successfully. We will review and contact you shortly.</div>

<script>
const items = ${JSON.stringify(items.map(i => ({ id: i.id })))};
async function submitRFQ() {
  const supplierName = document.getElementById('supplierName').value.trim();
  if (!supplierName) { alert('Please enter your company name.'); return; }
  const responses = items.map(item => ({
    rfqItemId: item.id,
    unitPrice: parseFloat(document.getElementById('price_'+item.id).value) || null,
    leadTimeDays: parseInt(document.getElementById('lead_'+item.id).value) || null,
    available: document.getElementById('avail_'+item.id).value === 'yes' ? 1 : document.getElementById('avail_'+item.id).value === 'partial' ? 0 : -1,
  }));
  const body = { supplierName, contactEmail: document.getElementById('contactEmail').value, notes: document.getElementById('suppNotes').value, responses };
  const r = await fetch(window.location.href.replace('/form', '/submit'), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if (r.ok) { document.getElementById('form-area').style.display='none'; document.getElementById('success-msg').style.display='block'; }
  else { alert('Submission failed. Please try again.'); }
}
</script></body></html>`;
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (err) {
    req.log.error(err);
    res.status(500).send("<h1>Server error</h1>");
  }
});

router.post("/parts/rfq/:token/submit", async (req, res) => {
  try {
    const [rfq] = await db.select().from(partsRfqTable).where(eq(partsRfqTable.token, req.params.token));
    if (!rfq) { res.status(404).json({ error: "RFQ not found" }); return; }
    const { supplierName, contactEmail, notes, responses = [] } = req.body as {
      supplierName: string; contactEmail?: string; notes?: string;
      responses: { rfqItemId: number; unitPrice: number | null; leadTimeDays: number | null; available: number }[];
    };
    const [supplier] = await db.insert(partsRfqSuppliersTable).values({
      rfqId: rfq.id, supplierName, contactEmail: contactEmail ?? null, notes: notes ?? null, submittedAt: new Date(),
      totalQuoted: responses.reduce((acc, r) => acc + (r.unitPrice ?? 0), 0).toFixed(2),
    } as typeof partsRfqSuppliersTable.$inferInsert).returning();

    if (responses.length > 0) {
      await db.insert(partsRfqResponseItemsTable).values(
        responses.map((r) => ({ rfqSupplierId: supplier.id, rfqItemId: r.rfqItemId, unitPrice: r.unitPrice ? String(r.unitPrice) : null, leadTimeDays: r.leadTimeDays ?? null, available: r.available })) as typeof partsRfqResponseItemsTable.$inferInsert[]
      );
    }
    await db.update(partsRfqTable).set({ status: "received" } as Partial<typeof partsRfqTable.$inferInsert>).where(eq(partsRfqTable.id, rfq.id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to submit quotation" });
  }
});

router.patch("/parts/rfq/:id/send", async (req, res) => {
  await ensureSeeded();
  try {
    const rfqId = parseInt(req.params.id);
    const [updated] = await db.update(partsRfqTable).set({ status: "sent", sentAt: new Date() } as Partial<typeof partsRfqTable.$inferInsert>).where(eq(partsRfqTable.id, rfqId)).returning();
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

export default router;
