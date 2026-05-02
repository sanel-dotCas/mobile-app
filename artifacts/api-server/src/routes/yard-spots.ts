import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  yardSpotsTable,
  yardVehiclesTable,
  yardZonesTable,
  yardLocationsTable,
  yardMovementsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.patch("/yard/spots/:spotId", async (req, res) => {
  const spotId = Number(req.params.spotId);
  const { status, vehicleId, reservedUntil, notes } = req.body;

  const [existing] = await db
    .select()
    .from(yardSpotsTable)
    .where(eq(yardSpotsTable.id, spotId))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Spot not found" });
    return;
  }

  const updates: Partial<typeof existing> = {};
  if (status !== undefined) updates.status = status;
  if (notes !== undefined) updates.notes = notes;
  if (reservedUntil !== undefined) updates.reservedUntil = reservedUntil;

  // Handle vehicle assignment/release
  if (vehicleId !== undefined) {
    if (vehicleId === null) {
      // Release spot
      updates.vehicleId = null;
      updates.assignedAt = null;
      // Update vehicle status if it was assigned
      if (existing.vehicleId) {
        await db
          .update(yardVehiclesTable)
          .set({ spotId: null })
          .where(eq(yardVehiclesTable.id, existing.vehicleId));
      }
    } else {
      // Assign vehicle
      updates.vehicleId = vehicleId;
      updates.assignedAt = new Date();
      await db
        .update(yardVehiclesTable)
        .set({ spotId })
        .where(eq(yardVehiclesTable.id, vehicleId));
    }
  }

  const [updated] = await db
    .update(yardSpotsTable)
    .set(updates)
    .where(eq(yardSpotsTable.id, spotId))
    .returning();

  // Log movement
  const zone = await db
    .select()
    .from(yardZonesTable)
    .where(eq(yardZonesTable.id, existing.zoneId))
    .limit(1);
  const loc = zone[0]
    ? await db
        .select()
        .from(yardLocationsTable)
        .where(eq(yardLocationsTable.id, zone[0].locationId))
        .limit(1)
    : [];

  if (loc[0]) {
    let action = `Spot ${existing.code} updated`;
    let vehicleName: string | null = null;
    if (vehicleId !== undefined) {
      if (vehicleId === null) {
        action = `Vehicle released from Spot ${existing.code}`;
      } else {
        const [v] = await db
          .select()
          .from(yardVehiclesTable)
          .where(eq(yardVehiclesTable.id, vehicleId))
          .limit(1);
        vehicleName = v ? `${v.year} ${v.make} ${v.model}` : null;
        action = vehicleName
          ? `${vehicleName} added to ${zone[0]?.name} - ${existing.code}`
          : `Vehicle added to Spot ${existing.code}`;
      }
    }
    await db.insert(yardMovementsTable).values({
      locationId: loc[0].id,
      vehicleId: vehicleId ?? existing.vehicleId ?? null,
      vehicleName,
      action,
      actor: "Yard Manager",
    });
  }

  res.json({
    id: updated.id,
    zoneId: updated.zoneId,
    code: updated.code,
    status: updated.status,
    vehicleId: updated.vehicleId ?? null,
    vehicle: null,
    reservedUntil: updated.reservedUntil ?? null,
    dimensions: updated.dimensions ?? null,
    notes: updated.notes ?? null,
    spotType: updated.spotType ?? null,
    timeInSpot: null,
  });
});

export default router;
