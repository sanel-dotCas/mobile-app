import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  yardVehiclesTable,
  yardLocationsTable,
  yardSpotsTable,
  yardZonesTable,
} from "@workspace/db";
import { eq, ilike, and, or, SQL, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/yard/vehicles", async (req, res) => {
  const { q, status, locationId, page = "1", limit = "15" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(50, Math.max(1, Number(limit)));
  const offset = (pageNum - 1) * limitNum;

  const conditions: SQL[] = [];
  if (q) {
    conditions.push(
      or(
        ilike(yardVehiclesTable.vin, `%${q}%`),
        ilike(yardVehiclesTable.stockNumber, `%${q}%`),
        ilike(yardVehiclesTable.make, `%${q}%`),
        ilike(yardVehiclesTable.model, `%${q}%`)
      )!
    );
  }
  if (status && status !== "all") {
    conditions.push(eq(yardVehiclesTable.status, status as "available" | "in_transit" | "pdi_pending" | "sold"));
  }
  if (locationId) {
    conditions.push(eq(yardVehiclesTable.locationId, Number(locationId)));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ count }] = await db
    .select({ count: db.$count(yardVehiclesTable, where) })
    .from(yardVehiclesTable);

  const vehicles = await db
    .select()
    .from(yardVehiclesTable)
    .where(where)
    .orderBy(desc(yardVehiclesTable.createdAt))
    .limit(limitNum)
    .offset(offset);

  const vehiclesWithDetails = await Promise.all(
    vehicles.map(async (v) => {
      let locationName: string | null = null;
      let spotCode: string | null = null;
      let zoneName: string | null = null;

      if (v.locationId) {
        const [loc] = await db
          .select()
          .from(yardLocationsTable)
          .where(eq(yardLocationsTable.id, v.locationId))
          .limit(1);
        locationName = loc?.name ?? null;
      }
      if (v.spotId) {
        const [spot] = await db
          .select()
          .from(yardSpotsTable)
          .where(eq(yardSpotsTable.id, v.spotId))
          .limit(1);
        spotCode = spot?.code ?? null;
        if (spot) {
          const [zone] = await db
            .select()
            .from(yardZonesTable)
            .where(eq(yardZonesTable.id, spot.zoneId))
            .limit(1);
          zoneName = zone?.name ?? null;
        }
      }

      return {
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
        locationName,
        spotId: v.spotId ?? null,
        spotCode,
        zoneName,
        price: v.price ? Number(v.price) : null,
        imageUrl: v.imageUrl ?? null,
        arrivedAt: v.arrivedAt?.toISOString() ?? null,
      };
    })
  );

  const total = Number(count);
  res.json({
    vehicles: vehiclesWithDetails,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

router.post("/yard/vehicles", async (req, res) => {
  const {
    vin, stockNumber, make, model, year, color, mileage,
    condition, status, locationId, price,
  } = req.body;

  const [vehicle] = await db
    .insert(yardVehiclesTable)
    .values({
      vin,
      stockNumber,
      make,
      model,
      year: Number(year),
      color,
      mileage: mileage ? Number(mileage) : null,
      condition,
      status: status || "available",
      locationId: locationId ? Number(locationId) : null,
      price: price ? String(price) : null,
      arrivedAt: new Date(),
    })
    .returning();

  res.status(201).json({
    id: vehicle.id,
    vin: vehicle.vin,
    stockNumber: vehicle.stockNumber,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    color: vehicle.color ?? null,
    mileage: vehicle.mileage ?? null,
    condition: vehicle.condition ?? null,
    status: vehicle.status,
    locationId: vehicle.locationId ?? null,
    locationName: null,
    spotId: null,
    spotCode: null,
    zoneName: null,
    price: vehicle.price ? Number(vehicle.price) : null,
    imageUrl: vehicle.imageUrl ?? null,
    arrivedAt: vehicle.arrivedAt?.toISOString() ?? null,
  });
});

router.get("/yard/vehicles/:vehicleId", async (req, res) => {
  const vehicleId = Number(req.params.vehicleId);
  const [v] = await db
    .select()
    .from(yardVehiclesTable)
    .where(eq(yardVehiclesTable.id, vehicleId))
    .limit(1);

  if (!v) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  let locationName: string | null = null;
  let spotCode: string | null = null;
  let zoneName: string | null = null;

  if (v.locationId) {
    const [loc] = await db
      .select()
      .from(yardLocationsTable)
      .where(eq(yardLocationsTable.id, v.locationId))
      .limit(1);
    locationName = loc?.name ?? null;
  }
  if (v.spotId) {
    const [spot] = await db
      .select()
      .from(yardSpotsTable)
      .where(eq(yardSpotsTable.id, v.spotId))
      .limit(1);
    spotCode = spot?.code ?? null;
    if (spot) {
      const [zone] = await db
        .select()
        .from(yardZonesTable)
        .where(eq(yardZonesTable.id, spot.zoneId))
        .limit(1);
      zoneName = zone?.name ?? null;
    }
  }

  res.json({
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
    locationName,
    spotId: v.spotId ?? null,
    spotCode,
    zoneName,
    price: v.price ? Number(v.price) : null,
    imageUrl: v.imageUrl ?? null,
    arrivedAt: v.arrivedAt?.toISOString() ?? null,
  });
});

router.patch("/yard/vehicles/:vehicleId", async (req, res) => {
  const vehicleId = Number(req.params.vehicleId);
  const { status, locationId, spotId, color, price } = req.body;

  const updates: Record<string, unknown> = {};
  if (status !== undefined) updates.status = status;
  if (locationId !== undefined) updates.locationId = locationId;
  if (spotId !== undefined) updates.spotId = spotId;
  if (color !== undefined) updates.color = color;
  if (price !== undefined) updates.price = String(price);

  const [updated] = await db
    .update(yardVehiclesTable)
    .set(updates)
    .where(eq(yardVehiclesTable.id, vehicleId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  res.json({
    id: updated.id,
    vin: updated.vin,
    stockNumber: updated.stockNumber,
    make: updated.make,
    model: updated.model,
    year: updated.year,
    color: updated.color ?? null,
    mileage: updated.mileage ?? null,
    condition: updated.condition ?? null,
    status: updated.status,
    locationId: updated.locationId ?? null,
    locationName: null,
    spotId: updated.spotId ?? null,
    spotCode: null,
    zoneName: null,
    price: updated.price ? Number(updated.price) : null,
    imageUrl: updated.imageUrl ?? null,
    arrivedAt: updated.arrivedAt?.toISOString() ?? null,
  });
});

export default router;
