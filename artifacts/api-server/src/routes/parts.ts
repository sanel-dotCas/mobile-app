import { Router } from "express";
import { db } from "@workspace/db";
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
    if (!item) return res.status(404).json({ error: "Part not found" });
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
    if (!item) return res.status(404).json({ error: "Part not found" });
    res.json(item);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/parts/items", async (req, res) => {
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

router.patch("/parts/items/:id", async (req, res) => {
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
      .where(eq(partsItemsTable.id, parseInt(req.params.id)))
      .returning();
    if (!item) return res.status(404).json({ error: "Part not found" });
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
    if (!order) return res.status(404).json({ error: "Order not found" });

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
      status: "ordered",
      notes: notes ?? null,
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
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Invoice number required if not already set on the order
    const effectiveInvoice = invoiceNumber ?? order.invoiceNumber;
    if (!effectiveInvoice) {
      return res.status(400).json({ error: "Invoice number is required before receiving parts" });
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

    res.json({ order: { ...updatedOrder, items: allItems } });
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

router.get("/parts/sales/:id", async (req, res) => {
  await ensureSeeded();
  try {
    const [sale] = await db
      .select()
      .from(partsSalesTable)
      .where(eq(partsSalesTable.id, parseInt(req.params.id)));
    if (!sale) return res.status(404).json({ error: "Sale not found" });
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
    if (!session) return res.status(404).json({ error: "Session not found" });
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
      return res.json({ item });
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

    const priorityOrder = { critical: 0, urgent: 1, warning: 2, info: 3 };
    suggestions.sort((a: any, b: any) => priorityOrder[a.priority] - priorityOrder[b.priority]);

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
    if (!transfer) return res.status(404).json({ error: "Transfer not found" });
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
    if (!request) return res.status(404).json({ error: "Request not found" });
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
    if (!request) return res.status(404).json({ error: "Request not found" });

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

export default router;
