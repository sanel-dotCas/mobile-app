import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  yardInspectionsTable,
  yardVehiclesTable,
  yardLocationsTable,
  yardUsersTable,
  techniciansTable,
} from "@workspace/db";
import { eq, and, SQL, desc, or, inArray, isNull } from "drizzle-orm";
import { formatVehicleName } from "../lib/formatVehicleName";
import { notifyTechnicianAssigned, notifyMultipleTechnicians, notifyTechnicianReassigned, notifyTechnicianUnassigned } from "../lib/pushNotifications";

const router: IRouter = Router();

/**
 * Returns the list of technician names that are currently available for
 * assignment (status = active or idle). Cross-references yard_operator users
 * against the technicians table by name. Falls back to all yard_operators if
 * none have a matching row in the technicians table.
 */
async function getAvailableTechs(): Promise<{ name: string; status: string }[]> {
  const operators = await db
    .select()
    .from(yardUsersTable)
    .where(eq(yardUsersTable.role, "yard_operator"));

  const techRows = await db
    .select({ name: techniciansTable.name, status: techniciansTable.status })
    .from(techniciansTable);

  const statusByName = new Map(techRows.map((t) => [t.name, t.status]));

  const available = operators
    .map((u) => ({ name: u.name, status: statusByName.get(u.name) ?? "idle" }))
    .filter((t) => t.status === "active" || t.status === "idle");

  // Fallback: if no tech has a matching row, return all operators as idle
  if (available.length === 0) {
    return operators.map((u) => ({ name: u.name, status: "idle" }));
  }

  return available;
}

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

// ── Available technicians for assignment ──────────────────────────────────────
router.get("/yard/inspections/available-techs", async (_req, res) => {
  const available = await getAvailableTechs();
  res.json({ techs: available, count: available.length });
});

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

  const resolved = await resolveDetails(insp);

  if (assignedTo) {
    notifyTechnicianAssigned(
      assignedTo,
      insp.id,
      resolved.vehicleName,
      insp.type,
      resolved.locationName
    ).catch(() => {});
  }

  res.status(201).json(resolved);
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

  // Determine technicians for auto-assign — only available (active/idle) techs
  let techList: string[] = [];
  if (autoAssign) {
    if (technicianIds && technicianIds.length > 0) {
      techList = technicianIds;
    } else {
      const available = await getAvailableTechs();
      techList = available.map((t) => t.name);
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

  // Fire push notifications for all auto-assigned inspections (non-blocking)
  if (autoAssign && assignedCount > 0) {
    const assignments = withDetails
      .filter((d) => d.assignedTo)
      .map((d) => ({
        technicianName: d.assignedTo!,
        inspectionId: d.id,
        vehicleName: d.vehicleName,
        inspectionType: d.type,
        locationName: d.locationName,
      }));
    notifyMultipleTechnicians(assignments).catch(() => {});
  }

  res.json({
    created: createdInspections.length,
    assigned: assignedCount,
    skipped: skipped.length,
    availableTechCount: techList.length,
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

  // Get only available (active/idle) technicians — skip those on break or absent
  const available = await getAvailableTechs();
  const techList = available.map((t) => t.name);

  if (techList.length === 0) {
    res.json({ assigned: 0, total: unassigned.length });
    return;
  }

  // Round-robin assign
  let assignedCount = 0;
  const notifyAssignments: Array<{
    technicianName: string;
    inspectionId: number;
    vehicleName: string;
    inspectionType: string;
    locationName: string | null;
  }> = [];

  for (let i = 0; i < unassigned.length; i++) {
    const insp = unassigned[i];
    const techName = techList[i % techList.length];
    await db
      .update(yardInspectionsTable)
      .set({ assignedTo: techName, assignedAt: new Date() })
      .where(eq(yardInspectionsTable.id, insp.id));
    assignedCount++;

    // Collect info for push notifications
    const resolved = await resolveDetails({ ...insp, assignedTo: techName, assignedAt: new Date() });
    notifyAssignments.push({
      technicianName: techName,
      inspectionId: insp.id,
      vehicleName: resolved.vehicleName,
      inspectionType: insp.type,
      locationName: resolved.locationName,
    });
  }

  // Fire push notifications (non-blocking)
  notifyMultipleTechnicians(notifyAssignments).catch(() => {});

  res.json({ assigned: assignedCount, total: unassigned.length });
});

// ── Update inspection ─────────────────────────────────────────────────────────
router.patch("/yard/inspections/:inspectionId", async (req, res) => {
  const inspectionId = Number(req.params.inspectionId);
  const { status, notes, bodyDamage, fuelPercentage, completedAt, assignedTo } =
    req.body;

  // Fetch the current inspection so we know the previous assignedTo
  const [existing] = await db
    .select()
    .from(yardInspectionsTable)
    .where(eq(yardInspectionsTable.id, inspectionId))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Inspection not found" });
    return;
  }

  const previousAssignedTo = existing.assignedTo;

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

  const resolved = await resolveDetails(updated);

  // Fire push notifications based on assignedTo changes
  if (assignedTo !== undefined) {
    const newAssignedTo = assignedTo || null;
    const hadPreviousAssignee = previousAssignedTo && previousAssignedTo.length > 0;
    const hasNewAssignee = newAssignedTo && newAssignedTo.length > 0;

    if (hadPreviousAssignee && hasNewAssignee && previousAssignedTo !== newAssignedTo) {
      // Reassigned to a different technician — notify the removed tech and the new tech
      notifyTechnicianReassigned(
        previousAssignedTo!,
        updated.id,
        resolved.vehicleName,
        updated.type,
        resolved.locationName
      ).catch(() => {});
      notifyTechnicianAssigned(
        newAssignedTo,
        updated.id,
        resolved.vehicleName,
        updated.type,
        resolved.locationName
      ).catch(() => {});
    } else if (hadPreviousAssignee && !hasNewAssignee) {
      // Unassigned — notify the removed tech
      notifyTechnicianUnassigned(
        previousAssignedTo!,
        updated.id,
        resolved.vehicleName,
        updated.type,
        resolved.locationName
      ).catch(() => {});
    } else if (!hadPreviousAssignee && hasNewAssignee) {
      // Freshly assigned — notify the new tech
      notifyTechnicianAssigned(
        newAssignedTo,
        updated.id,
        resolved.vehicleName,
        updated.type,
        resolved.locationName
      ).catch(() => {});
    }
  }

  res.json(resolved);
});

export default router;
