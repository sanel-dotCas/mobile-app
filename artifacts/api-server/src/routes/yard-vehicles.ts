import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  yardVehiclesTable,
  yardLocationsTable,
  yardSpotsTable,
  yardZonesTable,
  yardInspectionsTable,
  yardMovementsTable,
} from "@workspace/db";
import { eq, ilike, and, or, SQL, desc, inArray } from "drizzle-orm";
import { formatVehicleName } from "../lib/formatVehicleName";

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

  // Batch-fetch last finished inspection for all vehicles on this page
  const vehicleIds = vehicles.map((v) => v.id);
  const lastInspections = vehicleIds.length > 0
    ? await db.select().from(yardInspectionsTable)
        .where(and(
          inArray(yardInspectionsTable.vehicleId, vehicleIds),
          eq(yardInspectionsTable.status, "finished"),
        ))
        .orderBy(desc(yardInspectionsTable.completedAt))
    : [];
  const lastInspMap = new Map<number, typeof yardInspectionsTable.$inferSelect>();
  for (const insp of lastInspections) {
    if (!lastInspMap.has(insp.vehicleId)) lastInspMap.set(insp.vehicleId, insp);
  }

  const vehiclesWithDetails = await Promise.all(
    vehicles.map(async (v) => {
      let locationName: string | null = null;
      let spotCode: string | null = null;
      let zoneName: string | null = null;

      if (v.locationId) {
        const [loc] = await db.select().from(yardLocationsTable).where(eq(yardLocationsTable.id, v.locationId)).limit(1);
        locationName = loc?.name ?? null;
      }
      if (v.spotId) {
        const [spot] = await db.select().from(yardSpotsTable).where(eq(yardSpotsTable.id, v.spotId)).limit(1);
        spotCode = spot?.code ?? null;
        if (spot) {
          const [zone] = await db.select().from(yardZonesTable).where(eq(yardZonesTable.id, spot.zoneId)).limit(1);
          zoneName = zone?.name ?? null;
        }
      }

      // Compute inspection urgency inline
      const lastInsp = lastInspMap.get(v.id) ?? null;
      const intervalDays = v.inspectionIntervalDays ?? 30;
      const arrivedAt = v.arrivedAt ?? v.createdAt;
      const now = new Date();
      let nextDueDate: Date;
      if (lastInsp?.completedAt) {
        nextDueDate = new Date(lastInsp.completedAt.getTime() + intervalDays * 86400000);
      } else {
        nextDueDate = new Date(arrivedAt.getTime() + intervalDays * 86400000);
      }
      const daysUntilInspectionDue = Math.floor((nextDueDate.getTime() - now.getTime()) / 86400000);
      const inspectionUrgency: "overdue" | "due-soon" | "ok" =
        daysUntilInspectionDue < 0 ? "overdue" : daysUntilInspectionDue <= 7 ? "due-soon" : "ok";

      return {
        id: v.id, vin: v.vin, stockNumber: v.stockNumber, make: v.make, model: v.model,
        year: v.year, color: v.color ?? null, mileage: v.mileage ?? null,
        condition: v.condition ?? null, status: v.status,
        locationId: v.locationId ?? null, locationName,
        spotId: v.spotId ?? null, spotCode, zoneName,
        price: v.price ? Number(v.price) : null,
        imageUrl: v.imageUrl ?? null,
        arrivedAt: v.arrivedAt?.toISOString() ?? null,
        inspectionIntervalDays: v.inspectionIntervalDays ?? 30,
        inspectionUrgency,
        daysUntilInspectionDue,
      };
    })
  );

  const total = Number(count);
  res.json({ vehicles: vehiclesWithDetails, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
});

router.post("/yard/vehicles", async (req, res) => {
  const { vin, stockNumber, make, model, year, color, mileage, condition, status, locationId, price } = req.body;

  const [vehicle] = await db.insert(yardVehiclesTable).values({
    vin, stockNumber, make, model,
    year: Number(year), color,
    mileage: mileage ? Number(mileage) : null,
    condition, status: status || "available",
    locationId: locationId ? Number(locationId) : null,
    price: price ? String(price) : null,
    arrivedAt: new Date(),
  }).returning();

  // Record arrival movement
  if (vehicle.locationId) {
    const [loc] = await db.select().from(yardLocationsTable).where(eq(yardLocationsTable.id, vehicle.locationId)).limit(1);
    if (loc) {
      const arrivedVehicleName = formatVehicleName(vehicle);
      await db.insert(yardMovementsTable).values({
        locationId: loc.id,
        vehicleId: vehicle.id,
        vehicleName: arrivedVehicleName,
        action: `New vehicle arrived: ${arrivedVehicleName} (Stock #${vehicle.stockNumber})`,
        actor: "DMS",
      });
    }
  }

  res.status(201).json({
    id: vehicle.id, vin: vehicle.vin, stockNumber: vehicle.stockNumber,
    make: vehicle.make, model: vehicle.model, year: vehicle.year,
    color: vehicle.color ?? null, mileage: vehicle.mileage ?? null,
    condition: vehicle.condition ?? null, status: vehicle.status,
    locationId: vehicle.locationId ?? null, locationName: null,
    spotId: null, spotCode: null, zoneName: null,
    price: vehicle.price ? Number(vehicle.price) : null,
    imageUrl: vehicle.imageUrl ?? null,
    arrivedAt: vehicle.arrivedAt?.toISOString() ?? null,
    inspectionIntervalDays: vehicle.inspectionIntervalDays ?? 30,
  });
});

router.get("/yard/vehicles/:vehicleId", async (req, res) => {
  const vehicleId = Number(req.params.vehicleId);
  const [v] = await db.select().from(yardVehiclesTable).where(eq(yardVehiclesTable.id, vehicleId)).limit(1);

  if (!v) { res.status(404).json({ error: "Vehicle not found" }); return; }

  let locationName: string | null = null;
  let spotCode: string | null = null;
  let zoneName: string | null = null;

  if (v.locationId) {
    const [loc] = await db.select().from(yardLocationsTable).where(eq(yardLocationsTable.id, v.locationId)).limit(1);
    locationName = loc?.name ?? null;
  }
  if (v.spotId) {
    const [spot] = await db.select().from(yardSpotsTable).where(eq(yardSpotsTable.id, v.spotId)).limit(1);
    spotCode = spot?.code ?? null;
    if (spot) {
      const [zone] = await db.select().from(yardZonesTable).where(eq(yardZonesTable.id, spot.zoneId)).limit(1);
      zoneName = zone?.name ?? null;
    }
  }

  res.json({
    id: v.id, vin: v.vin, stockNumber: v.stockNumber, make: v.make, model: v.model,
    year: v.year, color: v.color ?? null, mileage: v.mileage ?? null,
    condition: v.condition ?? null, status: v.status,
    locationId: v.locationId ?? null, locationName,
    spotId: v.spotId ?? null, spotCode, zoneName,
    price: v.price ? Number(v.price) : null,
    imageUrl: v.imageUrl ?? null,
    arrivedAt: v.arrivedAt?.toISOString() ?? null,
    inspectionIntervalDays: v.inspectionIntervalDays ?? 30,
  });
});

router.get("/yard/vehicles/:vehicleId/inspection-history", async (req, res) => {
  const vehicleId = Number(req.params.vehicleId);
  const [v] = await db.select().from(yardVehiclesTable).where(eq(yardVehiclesTable.id, vehicleId)).limit(1);
  if (!v) { res.status(404).json({ error: "Vehicle not found" }); return; }

  const inspections = await db
    .select()
    .from(yardInspectionsTable)
    .where(and(
      eq(yardInspectionsTable.vehicleId, vehicleId),
      eq(yardInspectionsTable.status, "finished"),
    ))
    .orderBy(desc(yardInspectionsTable.completedAt))
    .limit(5);

  const now = new Date();
  const intervalDays = v.inspectionIntervalDays ?? 30;
  const arrivedAt = v.arrivedAt ?? v.createdAt;

  const lastInsp = inspections[0] ?? null;
  let nextDueDate: Date;
  if (lastInsp?.completedAt) {
    nextDueDate = new Date(lastInsp.completedAt.getTime() + intervalDays * 86400000);
  } else {
    nextDueDate = new Date(arrivedAt.getTime() + intervalDays * 86400000);
  }
  const daysRemaining = Math.floor((nextDueDate.getTime() - now.getTime()) / 86400000);
  let urgency: "overdue" | "due-soon" | "ok";
  if (daysRemaining < 0) urgency = "overdue";
  else if (daysRemaining <= 7) urgency = "due-soon";
  else urgency = "ok";

  res.json({
    vehicleId,
    inspectionIntervalDays: intervalDays,
    lastInspectedAt: lastInsp?.completedAt?.toISOString() ?? null,
    lastInspectionType: lastInsp?.type ?? null,
    lastInspectionTechnician: lastInsp?.assignedTo ?? null,
    nextDueDate: nextDueDate.toISOString(),
    daysRemaining,
    urgency,
    history: inspections.map((i, idx) => {
      // Compute on-time vs. late for each inspection
      const prevInsp = inspections[idx + 1] ?? null;
      let dueDateForThisInsp: Date;
      if (prevInsp?.completedAt) {
        dueDateForThisInsp = new Date(prevInsp.completedAt.getTime() + intervalDays * 86400000);
      } else {
        dueDateForThisInsp = new Date(arrivedAt.getTime() + intervalDays * 86400000);
      }
      const onTime = i.completedAt ? i.completedAt <= dueDateForThisInsp : null;

      return {
        id: i.id,
        inspectionNumber: i.inspectionNumber,
        type: i.type,
        completedAt: i.completedAt?.toISOString() ?? null,
        assignedTo: i.assignedTo ?? null,
        notes: i.notes ?? null,
        bodyDamage: i.bodyDamage ?? null,
        checklist: i.checklist ?? null,
        attachments: Array.isArray(i.attachments) ? i.attachments : [],
        fuelPercentage: i.fuelPercentage ?? null,
        onTime,
      };
    }),
  });
});

router.patch("/yard/vehicles/:vehicleId", async (req, res) => {
  const vehicleId = Number(req.params.vehicleId);
  const { status, locationId, spotId, color, price, actor } = req.body;

  // Fetch current vehicle before update
  const [current] = await db.select().from(yardVehiclesTable).where(eq(yardVehiclesTable.id, vehicleId)).limit(1);
  if (!current) { res.status(404).json({ error: "Vehicle not found" }); return; }

  const updates: Record<string, unknown> = {};
  if (status !== undefined) updates.status = status;
  if (locationId !== undefined) updates.locationId = locationId;
  if (spotId !== undefined) updates.spotId = spotId;
  if (color !== undefined) updates.color = color;
  if (price !== undefined) updates.price = String(price);

  const [updated] = await db.update(yardVehiclesTable).set(updates).where(eq(yardVehiclesTable.id, vehicleId)).returning();

  // Resolve location for movement recording
  const effectiveLocationId = updated.locationId ?? current.locationId;
  let locationName: string | null = null;
  if (effectiveLocationId) {
    const [loc] = await db.select().from(yardLocationsTable).where(eq(yardLocationsTable.id, effectiveLocationId)).limit(1);
    locationName = loc?.name ?? null;
  }

  const vehicleName = formatVehicleName(updated);
  const actorName = actor ?? "DMS";

  // Record movement on status change
  if (status && status !== current.status && effectiveLocationId) {
    const statusLabels: Record<string, string> = {
      available: "marked Available",
      in_transit: "moved In Transit",
      pdi_pending: "queued for PDI",
      sold: "marked as Sold",
    };
    await db.insert(yardMovementsTable).values({
      locationId: effectiveLocationId,
      vehicleId: updated.id,
      vehicleName,
      action: `${vehicleName} ${statusLabels[status] ?? `status → ${status}`}`,
      actor: actorName,
    });
  }

  // Record movement on location change
  if (locationId && locationId !== current.locationId && locationId) {
    const [newLoc] = await db.select().from(yardLocationsTable).where(eq(yardLocationsTable.id, Number(locationId))).limit(1);
    if (newLoc) {
      await db.insert(yardMovementsTable).values({
        locationId: Number(locationId),
        vehicleId: updated.id,
        vehicleName,
        action: `${vehicleName} transferred to ${newLoc.name}`,
        actor: actorName,
      });
    }
  }

  // Auto-create final PDI inspection when vehicle is sold
  let autoPdiInspection: { id: number; inspectionNumber: string } | null = null;
  if (status === "sold" && current.status !== "sold") {
    const [lastInsp] = await db
      .select()
      .from(yardInspectionsTable)
      .orderBy(desc(yardInspectionsTable.id))
      .limit(1);
    const nextNum = lastInsp
      ? String(Number(lastInsp.inspectionNumber) + 1).padStart(5, "0")
      : "00001";

    const [pdi] = await db.insert(yardInspectionsTable).values({
      inspectionNumber: nextNum,
      vehicleId: updated.id,
      locationId: effectiveLocationId ?? null,
      type: "final-quality",
      status: "queued",
      notes: `Auto-created: Final quality PDI for ${vehicleName} (Stock #${updated.stockNumber}) — marked sold by ${actorName}`,
    }).returning();
    autoPdiInspection = { id: pdi.id, inspectionNumber: pdi.inspectionNumber };

    // Record the auto-PDI creation in movement feed
    if (effectiveLocationId) {
      await db.insert(yardMovementsTable).values({
        locationId: effectiveLocationId,
        vehicleId: updated.id,
        vehicleName,
        action: `Auto-PDI created: Final quality inspection #${nextNum} queued for ${vehicleName}`,
        actor: "System",
      });
    }
  }

  res.json({
    id: updated.id, vin: updated.vin, stockNumber: updated.stockNumber,
    make: updated.make, model: updated.model, year: updated.year,
    color: updated.color ?? null, mileage: updated.mileage ?? null,
    condition: updated.condition ?? null, status: updated.status,
    locationId: updated.locationId ?? null, locationName,
    spotId: updated.spotId ?? null, spotCode: null, zoneName: null,
    price: updated.price ? Number(updated.price) : null,
    imageUrl: updated.imageUrl ?? null,
    arrivedAt: updated.arrivedAt?.toISOString() ?? null,
    inspectionIntervalDays: updated.inspectionIntervalDays ?? 30,
    autoPdiInspection,
  });
});

export default router;
