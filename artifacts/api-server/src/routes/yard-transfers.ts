import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  yardTransfersTable,
  yardVehiclesTable,
  yardLocationsTable,
  yardMovementsTable,
} from "@workspace/db";
import { eq, desc, and, SQL } from "drizzle-orm";
import { formatVehicleName } from "../lib/formatVehicleName";

const router: IRouter = Router();

async function resolveTransfer(transfer: typeof yardTransfersTable.$inferSelect) {
  const [vehicle] = await db
    .select()
    .from(yardVehiclesTable)
    .where(eq(yardVehiclesTable.id, transfer.vehicleId))
    .limit(1);

  const [fromLoc] = await db
    .select()
    .from(yardLocationsTable)
    .where(eq(yardLocationsTable.id, transfer.fromLocationId))
    .limit(1);

  const [toLoc] = await db
    .select()
    .from(yardLocationsTable)
    .where(eq(yardLocationsTable.id, transfer.toLocationId))
    .limit(1);

  return {
    id: transfer.id,
    transferNumber: transfer.transferNumber,
    vehicleId: transfer.vehicleId,
    vehicleName: formatVehicleName(vehicle),
    vehicleVin: vehicle?.vin ?? null,
    vehicleStockNumber: vehicle?.stockNumber ?? null,
    fromLocationId: transfer.fromLocationId,
    fromLocationName: fromLoc?.name ?? "Unknown",
    toLocationId: transfer.toLocationId,
    toLocationName: toLoc?.name ?? "Unknown",
    status: transfer.status,
    requestedBy: transfer.requestedBy,
    approvedBy: transfer.approvedBy ?? null,
    notes: transfer.notes ?? null,
    createdAt: transfer.createdAt.toISOString(),
    updatedAt: transfer.updatedAt.toISOString(),
    completedAt: transfer.completedAt?.toISOString() ?? null,
  };
}

router.get("/yard/transfers", async (req, res) => {
  const { status, page = "1", limit = "15" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(50, Math.max(1, Number(limit)));
  const offset = (pageNum - 1) * limitNum;

  const conditions: SQL[] = [];
  if (status && status !== "all") {
    conditions.push(
      eq(
        yardTransfersTable.status,
        status as "pending" | "approved" | "in_transit" | "completed" | "cancelled",
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ count }] = await db
    .select({ count: db.$count(yardTransfersTable, where) })
    .from(yardTransfersTable);

  const transfers = await db
    .select()
    .from(yardTransfersTable)
    .where(where)
    .orderBy(desc(yardTransfersTable.createdAt))
    .limit(limitNum)
    .offset(offset);

  const withDetails = await Promise.all(transfers.map(resolveTransfer));
  const total = Number(count);

  res.json({
    transfers: withDetails,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

router.post("/yard/transfers", async (req, res) => {
  const { vehicleId, fromLocationId, toLocationId, requestedBy, notes } = req.body;

  if (!vehicleId || !fromLocationId || !toLocationId || !requestedBy) {
    res.status(400).json({ error: "vehicleId, fromLocationId, toLocationId and requestedBy are required" });
    return;
  }

  const [lastT] = await db
    .select()
    .from(yardTransfersTable)
    .orderBy(desc(yardTransfersTable.id))
    .limit(1);
  const nextNum = lastT
    ? `TRF-${String(Number(lastT.transferNumber.replace("TRF-", "")) + 1).padStart(4, "0")}`
    : "TRF-0001";

  const [transfer] = await db
    .insert(yardTransfersTable)
    .values({
      transferNumber: nextNum,
      vehicleId: Number(vehicleId),
      fromLocationId: Number(fromLocationId),
      toLocationId: Number(toLocationId),
      status: "pending",
      requestedBy,
      notes: notes ?? null,
    })
    .returning();

  const resolved = await resolveTransfer(transfer);

  await db.insert(yardMovementsTable).values({
    locationId: Number(fromLocationId),
    vehicleId: Number(vehicleId),
    vehicleName: resolved.vehicleName,
    action: `Transfer request ${nextNum} created: ${resolved.vehicleName} → ${resolved.toLocationName}`,
    actor: requestedBy,
  });

  res.status(201).json(resolved);
});

router.patch("/yard/transfers/:transferId", async (req, res) => {
  const transferId = Number(req.params.transferId);
  const { status, approvedBy, notes } = req.body;

  const [existing] = await db
    .select()
    .from(yardTransfersTable)
    .where(eq(yardTransfersTable.id, transferId))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Transfer not found" });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (status !== undefined) updates.status = status;
  if (approvedBy !== undefined) updates.approvedBy = approvedBy;
  if (notes !== undefined) updates.notes = notes;
  if (status === "completed") updates.completedAt = new Date();

  const [updated] = await db
    .update(yardTransfersTable)
    .set(updates)
    .where(eq(yardTransfersTable.id, transferId))
    .returning();

  const resolved = await resolveTransfer(updated);

  if (status === "in_transit" || status === "completed") {
    const actor = approvedBy ?? "DMS";
    const actionText =
      status === "in_transit"
        ? `Transfer ${updated.transferNumber} started — ${resolved.vehicleName} in transit to ${resolved.toLocationName}`
        : `Transfer ${updated.transferNumber} completed — ${resolved.vehicleName} arrived at ${resolved.toLocationName}`;

    await db.insert(yardMovementsTable).values({
      locationId: updated.fromLocationId,
      vehicleId: updated.vehicleId,
      vehicleName: resolved.vehicleName,
      action: actionText,
      actor,
    });

    if (status === "completed") {
      await db
        .update(yardVehiclesTable)
        .set({ locationId: updated.toLocationId, status: "available" })
        .where(eq(yardVehiclesTable.id, updated.vehicleId));

      await db.insert(yardMovementsTable).values({
        locationId: updated.toLocationId,
        vehicleId: updated.vehicleId,
        vehicleName: resolved.vehicleName,
        action: `${resolved.vehicleName} received from ${resolved.fromLocationName} (Transfer ${updated.transferNumber})`,
        actor,
      });
    }
  }

  res.json(resolved);
});

export default router;
