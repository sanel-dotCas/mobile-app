import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  yardInspectionsTable,
  yardVehiclesTable,
  yardLocationsTable,
} from "@workspace/db";
import { eq, and, SQL, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/yard/inspections", async (req, res) => {
  const { locationId, status, page = "1", limit = "15" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(50, Math.max(1, Number(limit)));
  const offset = (pageNum - 1) * limitNum;

  const conditions: SQL[] = [];
  if (locationId) conditions.push(eq(yardInspectionsTable.locationId, Number(locationId)));
  if (status && status !== "all") {
    conditions.push(eq(yardInspectionsTable.status, status as "finished" | "in-progress" | "queued"));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ count }] = await db
    .select({ count: db.$count(yardInspectionsTable, where) })
    .from(yardInspectionsTable);

  const inspections = await db
    .select()
    .from(yardInspectionsTable)
    .where(where)
    .orderBy(desc(yardInspectionsTable.createdAt))
    .limit(limitNum)
    .offset(offset);

  const withDetails = await Promise.all(
    inspections.map(async (insp) => {
      const [vehicle] = await db
        .select()
        .from(yardVehiclesTable)
        .where(eq(yardVehiclesTable.id, insp.vehicleId))
        .limit(1);
      let locationName: string | null = null;
      if (insp.locationId) {
        const [loc] = await db
          .select()
          .from(yardLocationsTable)
          .where(eq(yardLocationsTable.id, insp.locationId))
          .limit(1);
        locationName = loc?.name ?? null;
      }
      return {
        id: insp.id,
        inspectionNumber: insp.inspectionNumber,
        vehicleId: insp.vehicleId,
        stockVin: vehicle
          ? `Stock inventory # ${vehicle.stockNumber} · VIN: ${vehicle.vin}`
          : "",
        vehicleName: vehicle ? `${vehicle.make} ${vehicle.model}` : "Unknown",
        type: insp.type,
        status: insp.status,
        locationId: insp.locationId ?? null,
        locationName,
        notes: insp.notes ?? null,
        bodyDamage: insp.bodyDamage ?? null,
        fuelPercentage: insp.fuelPercentage ?? null,
        createdAt: insp.createdAt.toISOString(),
        completedAt: insp.completedAt?.toISOString() ?? null,
      };
    })
  );

  const total = Number(count);
  res.json({
    inspections: withDetails,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

router.post("/yard/inspections", async (req, res) => {
  const { vehicleId, type, locationId, notes, bodyDamage, fuelPercentage } = req.body;

  // Generate inspection number
  const [lastInsp] = await db
    .select()
    .from(yardInspectionsTable)
    .orderBy(desc(yardInspectionsTable.id))
    .limit(1);
  const nextNum = lastInsp
    ? String(Number(lastInsp.inspectionNumber) + 1).padStart(5, "0")
    : "00001";

  const [vehicle] = await db
    .select()
    .from(yardVehiclesTable)
    .where(eq(yardVehiclesTable.id, Number(vehicleId)))
    .limit(1);

  if (!vehicle) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  // Update vehicle status to pdi_pending
  await db
    .update(yardVehiclesTable)
    .set({ status: "pdi_pending" })
    .where(eq(yardVehiclesTable.id, Number(vehicleId)));

  const [insp] = await db
    .insert(yardInspectionsTable)
    .values({
      inspectionNumber: nextNum,
      vehicleId: Number(vehicleId),
      locationId: locationId ? Number(locationId) : vehicle.locationId,
      type,
      status: "queued",
      notes: notes ?? null,
      bodyDamage: bodyDamage ?? null,
      fuelPercentage: fuelPercentage ? Number(fuelPercentage) : null,
    })
    .returning();

  let locationName: string | null = null;
  if (insp.locationId) {
    const [loc] = await db
      .select()
      .from(yardLocationsTable)
      .where(eq(yardLocationsTable.id, insp.locationId))
      .limit(1);
    locationName = loc?.name ?? null;
  }

  res.status(201).json({
    id: insp.id,
    inspectionNumber: insp.inspectionNumber,
    vehicleId: insp.vehicleId,
    stockVin: `Stock inventory # ${vehicle.stockNumber} · VIN: ${vehicle.vin}`,
    vehicleName: `${vehicle.make} ${vehicle.model}`,
    type: insp.type,
    status: insp.status,
    locationId: insp.locationId ?? null,
    locationName,
    notes: insp.notes ?? null,
    bodyDamage: insp.bodyDamage ?? null,
    fuelPercentage: insp.fuelPercentage ?? null,
    createdAt: insp.createdAt.toISOString(),
    completedAt: null,
  });
});

router.patch("/yard/inspections/:inspectionId", async (req, res) => {
  const inspectionId = Number(req.params.inspectionId);
  const { status, notes, bodyDamage, fuelPercentage, completedAt } = req.body;

  const updates: Record<string, unknown> = {};
  if (status !== undefined) updates.status = status;
  if (notes !== undefined) updates.notes = notes;
  if (bodyDamage !== undefined) updates.bodyDamage = bodyDamage;
  if (fuelPercentage !== undefined) updates.fuelPercentage = Number(fuelPercentage);
  if (completedAt !== undefined) updates.completedAt = new Date(completedAt);
  if (status === "finished" && !completedAt) updates.completedAt = new Date();

  const [updated] = await db
    .update(yardInspectionsTable)
    .set(updates)
    .where(eq(yardInspectionsTable.id, inspectionId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Inspection not found" });
    return;
  }

  const [vehicle] = await db
    .select()
    .from(yardVehiclesTable)
    .where(eq(yardVehiclesTable.id, updated.vehicleId))
    .limit(1);

  if (updated.status === "finished" && vehicle) {
    await db
      .update(yardVehiclesTable)
      .set({ status: "available" })
      .where(eq(yardVehiclesTable.id, vehicle.id));
  }

  let locationName: string | null = null;
  if (updated.locationId) {
    const [loc] = await db
      .select()
      .from(yardLocationsTable)
      .where(eq(yardLocationsTable.id, updated.locationId))
      .limit(1);
    locationName = loc?.name ?? null;
  }

  res.json({
    id: updated.id,
    inspectionNumber: updated.inspectionNumber,
    vehicleId: updated.vehicleId,
    stockVin: vehicle
      ? `Stock inventory # ${vehicle.stockNumber} · VIN: ${vehicle.vin}`
      : "",
    vehicleName: vehicle ? `${vehicle.make} ${vehicle.model}` : "Unknown",
    type: updated.type,
    status: updated.status,
    locationId: updated.locationId ?? null,
    locationName,
    notes: updated.notes ?? null,
    bodyDamage: updated.bodyDamage ?? null,
    fuelPercentage: updated.fuelPercentage ?? null,
    createdAt: updated.createdAt.toISOString(),
    completedAt: updated.completedAt?.toISOString() ?? null,
  });
});

export default router;
