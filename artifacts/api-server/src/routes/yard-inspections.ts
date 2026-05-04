import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  yardInspectionsTable,
  yardVehiclesTable,
  yardLocationsTable,
} from "@workspace/db";
import { eq, and, SQL, desc } from "drizzle-orm";
import { formatVehicleName } from "../lib/formatVehicleName";

const router: IRouter = Router();

function formatInspection(
  insp: typeof yardInspectionsTable.$inferSelect,
  vehicle: typeof yardVehiclesTable.$inferSelect | undefined,
  locationName: string | null,
) {
  return {
    id: insp.id,
    inspectionNumber: insp.inspectionNumber,
    vehicleId: insp.vehicleId,
    stockVin: vehicle
      ? `Stock inventory # ${vehicle.stockNumber} · VIN: ${vehicle.vin}`
      : "",
    vehicleName: formatVehicleName(vehicle),
    vehicleYear: vehicle?.year ?? null,
    stockNumber: vehicle?.stockNumber ?? null,
    type: insp.type,
    status: insp.status,
    locationId: insp.locationId ?? null,
    locationName,
    notes: insp.notes ?? null,
    bodyDamage: insp.bodyDamage ?? null,
    fuelPercentage: insp.fuelPercentage ?? null,
    vehicleMileage: vehicle?.mileage ?? null,
    assignedTo: insp.assignedTo ?? null,
    assignedAt: insp.assignedAt?.toISOString() ?? null,
    createdAt: insp.createdAt.toISOString(),
    completedAt: insp.completedAt?.toISOString() ?? null,
  };
}

async function resolveDetails(insp: typeof yardInspectionsTable.$inferSelect) {
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
  return formatInspection(insp, vehicle, locationName);
}

router.get("/yard/inspections", async (req, res) => {
  const {
    locationId,
    status,
    assignedTo,
    page = "1",
    limit = "15",
  } = req.query as Record<string, string>;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(50, Math.max(1, Number(limit)));
  const offset = (pageNum - 1) * limitNum;

  const conditions: SQL[] = [];
  if (locationId)
    conditions.push(eq(yardInspectionsTable.locationId, Number(locationId)));
  if (status && status !== "all") {
    conditions.push(
      eq(
        yardInspectionsTable.status,
        status as "finished" | "in-progress" | "queued",
      ),
    );
  }
  if (assignedTo) {
    conditions.push(eq(yardInspectionsTable.assignedTo, assignedTo));
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

  const withDetails = await Promise.all(inspections.map(resolveDetails));

  const total = Number(count);
  res.json({
    inspections: withDetails,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

router.get("/yard/inspections/:inspectionId", async (req, res) => {
  const inspectionId = Number(req.params.inspectionId);
  const [insp] = await db
    .select()
    .from(yardInspectionsTable)
    .where(eq(yardInspectionsTable.id, inspectionId))
    .limit(1);

  if (!insp) {
    res.status(404).json({ error: "Inspection not found" });
    return;
  }

  res.json(await resolveDetails(insp));
});

router.post("/yard/inspections", async (req, res) => {
  const { vehicleId, type, locationId, notes, bodyDamage, fuelPercentage, assignedTo } =
    req.body;

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
      assignedTo: assignedTo ?? null,
      assignedAt: assignedTo ? new Date() : null,
    })
    .returning();

  res.status(201).json(await resolveDetails(insp));
});

router.patch("/yard/inspections/:inspectionId", async (req, res) => {
  const inspectionId = Number(req.params.inspectionId);
  const { status, notes, bodyDamage, fuelPercentage, completedAt, assignedTo } =
    req.body;

  const updates: Record<string, unknown> = {};
  if (status !== undefined) updates.status = status;
  if (notes !== undefined) updates.notes = notes;
  if (bodyDamage !== undefined) updates.bodyDamage = bodyDamage;
  if (fuelPercentage !== undefined) updates.fuelPercentage = Number(fuelPercentage);
  if (completedAt !== undefined) updates.completedAt = new Date(completedAt);
  if (status === "finished" && !completedAt) updates.completedAt = new Date();
  if (assignedTo !== undefined) {
    updates.assignedTo = assignedTo || null;
    updates.assignedAt = assignedTo ? new Date() : null;
  }

  const [updated] = await db
    .update(yardInspectionsTable)
    .set(updates)
    .where(eq(yardInspectionsTable.id, inspectionId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Inspection not found" });
    return;
  }

  if (updated.status === "finished") {
    const [vehicle] = await db
      .select()
      .from(yardVehiclesTable)
      .where(eq(yardVehiclesTable.id, updated.vehicleId))
      .limit(1);
    if (vehicle) {
      await db
        .update(yardVehiclesTable)
        .set({ status: "available" })
        .where(eq(yardVehiclesTable.id, vehicle.id));
    }
  }

  res.json(await resolveDetails(updated));
});

export default router;
