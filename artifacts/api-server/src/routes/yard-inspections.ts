import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  yardInspectionsTable,
  yardVehiclesTable,
  yardLocationsTable,
  yardUsersTable,
} from "@workspace/db";
import { eq, and, SQL, desc, or, inArray, isNull } from "drizzle-orm";
import { formatVehicleName } from "../lib/formatVehicleName";

const router: IRouter = Router();

type InspType =
  | "pre-inspection"
  | "secondary"
  | "final-quality"
  | "new-arrival"
  | "used-arrival"
  | "periodic-fluid"
  | "periodic-damage"
  | "start-and-run";

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

// ── List inspections ──────────────────────────────────────────────────────────
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
    // Support comma-separated statuses e.g. "queued,in-progress"
    const statuses = status.split(",").map((s) => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      conditions.push(
        eq(
          yardInspectionsTable.status,
          statuses[0] as "finished" | "in-progress" | "queued",
        ),
      );
    } else if (statuses.length > 1) {
      conditions.push(
        or(
          ...statuses.map((s) =>
            eq(
              yardInspectionsTable.status,
              s as "finished" | "in-progress" | "queued",
            ),
          ),
        ) as SQL,
      );
    }
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

// ── Get single inspection ─────────────────────────────────────────────────────
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

// ── Create single inspection ──────────────────────────────────────────────────
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

// ── Batch generate periodic inspections ───────────────────────────────────────
router.post("/yard/inspections/generate", async (req, res) => {
  const {
    intervalDays,
    autoAssign,
    inspectionType = "periodic-fluid",
    technicianIds,
  } = req.body as {
    intervalDays: number;
    autoAssign: boolean;
    inspectionType?: InspType;
    technicianIds?: string[];
  };

  if (!intervalDays || intervalDays < 1) {
    res.status(400).json({ error: "intervalDays must be at least 1" });
    return;
  }

  const now = new Date();

  // Fetch all non-sold vehicles
  const vehicles = await db
    .select()
    .from(yardVehiclesTable)
    .where(
      or(
        eq(yardVehiclesTable.status, "available"),
        eq(yardVehiclesTable.status, "pdi_pending"),
        eq(yardVehiclesTable.status, "in_transit"),
      ) as SQL,
    );

  // For each vehicle, check if it's due within intervalDays and has no active inspection
  const vehiclesToInspect: typeof yardVehiclesTable.$inferSelect[] = [];
  const skipped: number[] = [];

  for (const v of vehicles) {
    // Check for existing active (queued or in-progress) inspection
    const [activeInsp] = await db
      .select()
      .from(yardInspectionsTable)
      .where(
        and(
          eq(yardInspectionsTable.vehicleId, v.id),
          or(
            eq(yardInspectionsTable.status, "queued"),
            eq(yardInspectionsTable.status, "in-progress"),
          ) as SQL,
        ),
      )
      .limit(1);

    if (activeInsp) {
      skipped.push(v.id);
      continue;
    }

    // Find last finished inspection
    const [lastInsp] = await db
      .select()
      .from(yardInspectionsTable)
      .where(
        and(
          eq(yardInspectionsTable.vehicleId, v.id),
          eq(yardInspectionsTable.status, "finished"),
        ),
      )
      .orderBy(desc(yardInspectionsTable.completedAt))
      .limit(1);

    const arrivedAt = v.arrivedAt ?? v.createdAt;
    let nextDueDate: Date;
    if (lastInsp?.completedAt) {
      nextDueDate = new Date(
        lastInsp.completedAt.getTime() + (v.inspectionIntervalDays ?? 30) * 86400000,
      );
    } else {
      nextDueDate = new Date(
        arrivedAt.getTime() + (v.inspectionIntervalDays ?? 30) * 86400000,
      );
    }

    const daysRemaining = Math.floor(
      (nextDueDate.getTime() - now.getTime()) / 86400000,
    );

    // Include if overdue or due within intervalDays
    if (daysRemaining <= intervalDays) {
      vehiclesToInspect.push(v);
    }
  }

  // Get the last inspection number to continue sequencing
  const [lastInspRecord] = await db
    .select()
    .from(yardInspectionsTable)
    .orderBy(desc(yardInspectionsTable.id))
    .limit(1);
  let nextNum = lastInspRecord
    ? Number(lastInspRecord.inspectionNumber) + 1
    : 1;

  // Determine technicians for auto-assign
  let techList: string[] = [];
  if (autoAssign) {
    if (technicianIds && technicianIds.length > 0) {
      techList = technicianIds;
    } else {
      // Fetch yard_operator users only — managers and admins are not assigned inspections
      const users = await db
        .select()
        .from(yardUsersTable)
        .where(eq(yardUsersTable.role, "yard_operator"));
      techList = users.map((u) => u.name);
    }
  }

  // Create inspections
  const createdInspections: typeof yardInspectionsTable.$inferSelect[] = [];
  let assignedCount = 0;

  for (let i = 0; i < vehiclesToInspect.length; i++) {
    const v = vehiclesToInspect[i];
    const inspNum = String(nextNum++).padStart(5, "0");

    let assignedTo: string | null = null;
    let assignedAt: Date | null = null;

    if (autoAssign && techList.length > 0) {
      // Round-robin across yard_operator technicians only
      assignedTo = techList[i % techList.length];
      assignedAt = new Date();
      assignedCount++;
    }

    const [insp] = await db
      .insert(yardInspectionsTable)
      .values({
        inspectionNumber: inspNum,
        vehicleId: v.id,
        locationId: v.locationId,
        type: inspectionType,
        status: "queued",
        notes: null,
        bodyDamage: null,
        fuelPercentage: null,
        assignedTo,
        assignedAt,
      })
      .returning();

    createdInspections.push(insp);
  }

  // Resolve details for all created inspections
  const withDetails = await Promise.all(createdInspections.map(resolveDetails));

  res.json({
    created: createdInspections.length,
    assigned: assignedCount,
    skipped: skipped.length,
    inspections: withDetails,
  });
});

// ── Auto-assign unassigned queued inspections ─────────────────────────────────
router.post("/yard/inspections/auto-assign", async (req, res) => {
  const { inspectionIds } = (req.body ?? {}) as { inspectionIds?: number[] };

  // Fetch unassigned queued inspections
  let conditions: SQL[] = [
    eq(yardInspectionsTable.status, "queued"),
    isNull(yardInspectionsTable.assignedTo),
  ];

  if (inspectionIds && inspectionIds.length > 0) {
    conditions.push(inArray(yardInspectionsTable.id, inspectionIds));
  }

  const unassigned = await db
    .select()
    .from(yardInspectionsTable)
    .where(and(...conditions));

  if (unassigned.length === 0) {
    res.json({ assigned: 0, total: 0 });
    return;
  }

  // Get technician-capable users only (yard_operator role)
  const users = await db
    .select()
    .from(yardUsersTable)
    .where(eq(yardUsersTable.role, "yard_operator"));
  const techList = users.map((u) => u.name);

  if (techList.length === 0) {
    res.json({ assigned: 0, total: unassigned.length });
    return;
  }

  // Round-robin assign
  let assignedCount = 0;
  for (let i = 0; i < unassigned.length; i++) {
    const insp = unassigned[i];
    const techName = techList[i % techList.length];
    await db
      .update(yardInspectionsTable)
      .set({ assignedTo: techName, assignedAt: new Date() })
      .where(eq(yardInspectionsTable.id, insp.id));
    assignedCount++;
  }

  res.json({ assigned: assignedCount, total: unassigned.length });
});

// ── Update inspection ─────────────────────────────────────────────────────────
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
