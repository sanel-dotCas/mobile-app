import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  yardLocationsTable,
  yardZonesTable,
  yardSpotsTable,
  yardVehiclesTable,
  yardMovementsTable,
} from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

async function getLocationStats(locationId: number) {
  const spots = await db
    .select()
    .from(yardSpotsTable)
    .innerJoin(yardZonesTable, eq(yardSpotsTable.zoneId, yardZonesTable.id))
    .where(eq(yardZonesTable.locationId, locationId));

  const occupied = spots.filter((s) => s.yard_spots.status === "occupied").length;
  const reserved = spots.filter((s) => s.yard_spots.status === "reserved").length;

  // Count vehicles in location by status
  const vehicles = await db
    .select()
    .from(yardVehiclesTable)
    .where(eq(yardVehiclesTable.locationId, locationId));

  const arrived = vehicles.length;
  const inYard = vehicles.filter(
    (v) => v.status === "available" || v.status === "pdi_pending"
  ).length;
  const readyPDI = vehicles.filter((v) => v.status === "pdi_pending").length;
  const readySale = vehicles.filter((v) => v.status === "available").length;

  return { occupied: occupied + reserved, arrived, inYard, readyPDI, readySale };
}

// List all locations
router.get("/yard/locations", async (_req, res) => {
  const locations = await db.select().from(yardLocationsTable).orderBy(yardLocationsTable.name);
  const result = await Promise.all(
    locations.map(async (loc) => {
      const stats = await getLocationStats(loc.id);
      return {
        id: loc.id,
        name: loc.name,
        type: loc.type,
        city: loc.city,
        address: loc.address ?? null,
        totalCapacity: loc.totalCapacity,
        autoChecks: loc.autoChecks,
        ...stats,
      };
    })
  );
  res.json(result);
});

// Create location
router.post("/yard/locations", async (req, res) => {
  const { name, type, city, address, totalCapacity } = req.body;
  const [loc] = await db
    .insert(yardLocationsTable)
    .values({ name, type, city, address, totalCapacity })
    .returning();
  res.status(201).json({ ...loc, occupied: 0, arrived: 0, inYard: 0, readyPDI: 0, readySale: 0 });
});

// Get location detail with zones + spots
router.get("/yard/locations/:locationId", async (req, res) => {
  const locationId = Number(req.params.locationId);
  const [loc] = await db
    .select()
    .from(yardLocationsTable)
    .where(eq(yardLocationsTable.id, locationId))
    .limit(1);

  if (!loc) {
    res.status(404).json({ error: "Location not found" });
    return;
  }

  const zones = await db
    .select()
    .from(yardZonesTable)
    .where(eq(yardZonesTable.locationId, locationId))
    .orderBy(yardZonesTable.displayOrder);

  const zonesWithSpots = await Promise.all(
    zones.map(async (zone) => {
      const spots = await db
        .select()
        .from(yardSpotsTable)
        .where(eq(yardSpotsTable.zoneId, zone.id))
        .orderBy(yardSpotsTable.code);

      const spotsWithVehicles = await Promise.all(
        spots.map(async (spot) => {
          let vehicle = null;
          if (spot.vehicleId) {
            const [v] = await db
              .select()
              .from(yardVehiclesTable)
              .where(eq(yardVehiclesTable.id, spot.vehicleId))
              .limit(1);
            if (v) {
              const [locRow] = await db
                .select()
                .from(yardLocationsTable)
                .where(eq(yardLocationsTable.id, v.locationId ?? -1))
                .limit(1);
              vehicle = {
                id: v.id,
                vin: v.vin,
                stockNumber: v.stockNumber,
                make: v.make,
                model: v.model,
                year: v.year,
                color: v.color ?? null,
                mileage: v.mileage ?? null,
                condition: v.condition ?? null,
                status: v.status,
                locationId: v.locationId ?? null,
                locationName: locRow?.name ?? null,
                spotId: v.spotId ?? null,
                spotCode: spot.code,
                zoneName: zone.name,
                price: v.price ? Number(v.price) : null,
                imageUrl: v.imageUrl ?? null,
                arrivedAt: v.arrivedAt?.toISOString() ?? null,
              };
            }
          }
          let timeInSpot: string | null = null;
          if (spot.assignedAt) {
            const hours = Math.floor(
              (Date.now() - spot.assignedAt.getTime()) / 3600000
            );
            const days = Math.floor(hours / 24);
            const remHours = hours % 24;
            timeInSpot =
              days > 0 ? `${days}d ${remHours}h` : `${remHours}h`;
          }
          return {
            id: spot.id,
            zoneId: spot.zoneId,
            code: spot.code,
            status: spot.status,
            vehicleId: spot.vehicleId ?? null,
            vehicle,
            reservedUntil: spot.reservedUntil ?? null,
            dimensions: spot.dimensions ?? null,
            notes: spot.notes ?? null,
            spotType: spot.spotType ?? null,
            timeInSpot,
          };
        })
      );

      return {
        id: zone.id,
        locationId: zone.locationId,
        name: zone.name,
        type: zone.type,
        isPremium: zone.isPremium,
        spots: spotsWithVehicles,
      };
    })
  );

  const stats = await getLocationStats(locationId);
  res.json({
    id: loc.id,
    name: loc.name,
    type: loc.type,
    city: loc.city,
    address: loc.address ?? null,
    totalCapacity: loc.totalCapacity,
    autoChecks: loc.autoChecks,
    ...stats,
    zones: zonesWithSpots,
  });
});

// Movement feed for a location
router.get("/yard/locations/:locationId/movement", async (req, res) => {
  const locationId = Number(req.params.locationId);
  const limit = Math.min(Number(req.query.limit ?? 20), 100);

  const movements = await db
    .select()
    .from(yardMovementsTable)
    .where(eq(yardMovementsTable.locationId, locationId))
    .orderBy(desc(yardMovementsTable.createdAt))
    .limit(limit);

  const [loc] = await db
    .select()
    .from(yardLocationsTable)
    .where(eq(yardLocationsTable.id, locationId))
    .limit(1);

  res.json(
    movements.map((m) => ({
      id: m.id,
      locationId: m.locationId,
      locationName: loc?.name ?? "Unknown",
      vehicleId: m.vehicleId ?? null,
      vehicleName: m.vehicleName ?? null,
      action: m.action,
      actor: m.actor,
      createdAt: m.createdAt.toISOString(),
    }))
  );
});

export default router;
