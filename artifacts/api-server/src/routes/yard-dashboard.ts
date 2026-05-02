import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  yardLocationsTable,
  yardVehiclesTable,
  yardMovementsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/yard/dashboard/stats", async (_req, res) => {
  const locations = await db.select().from(yardLocationsTable);
  const totalCapacity = locations.reduce((sum, l) => sum + l.totalCapacity, 0);

  const allVehicles = await db.select().from(yardVehiclesTable);
  const totalOccupied = allVehicles.filter(
    (v) => v.status === "available" || v.status === "pdi_pending"
  ).length;
  const readyForPDI = allVehicles.filter((v) => v.status === "pdi_pending").length;
  const readyForSale = allVehicles.filter((v) => v.status === "available").length;
  const expectedInbound = allVehicles.filter((v) => v.status === "in_transit").length;

  // Count arriving today (arrived in last 24h)
  const yesterday = new Date(Date.now() - 86400000);
  const arrivingToday = allVehicles.filter(
    (v) => v.arrivedAt && v.arrivedAt > yesterday
  ).length;

  // Recent movements across all locations (last 10)
  const movements = await db
    .select()
    .from(yardMovementsTable)
    .orderBy(desc(yardMovementsTable.createdAt))
    .limit(10);

  const movementFeed = await Promise.all(
    movements.map(async (m) => {
      const [loc] = await db
        .select()
        .from(yardLocationsTable)
        .where(eq(yardLocationsTable.id, m.locationId))
        .limit(1);
      return {
        id: m.id,
        locationId: m.locationId,
        locationName: loc?.name ?? "Unknown",
        vehicleId: m.vehicleId ?? null,
        vehicleName: m.vehicleName ?? null,
        action: m.action,
        actor: m.actor,
        createdAt: m.createdAt.toISOString(),
      };
    })
  );

  res.json({
    totalCapacity,
    totalOccupied,
    readyForPDI,
    readyForSale,
    expectedInbound,
    arrivingToday,
    totalLocations: locations.length,
    recentMovements: movementFeed,
  });
});

export default router;
