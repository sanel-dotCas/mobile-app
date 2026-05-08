import { Router } from "express";
import { db } from "@workspace/db";
import {
  servicePlansTable,
  servicePlanSlotsTable,
  servicePackagesTable,
  servicePackageLinesTable,
} from "@workspace/db";
import { eq, and, isNull, asc, desc } from "drizzle-orm";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function generatePlanNumber(): string {
  const yr = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `SP-${yr}-${rand}`;
}

async function buildPlanResponse(planId: number) {
  const [plan] = await db.select().from(servicePlansTable).where(eq(servicePlansTable.id, planId));
  if (!plan) return null;
  const slots = await db
    .select()
    .from(servicePlanSlotsTable)
    .where(eq(servicePlanSlotsTable.planId, planId))
    .orderBy(asc(servicePlanSlotsTable.slotOrder));
  const usedSlots = slots.filter((s) => s.redeemedAt !== null).length;
  return {
    ...plan,
    slots,
    totalSlots: slots.length,
    usedSlots,
    remainingSlots: slots.length - usedSlots,
  };
}

// ── List plans (optionally filtered by VIN) ───────────────────────────────────
router.get("/service-plans", async (req, res) => {
  try {
    const { vin, status } = req.query as Record<string, string>;
    let plans = await db
      .select()
      .from(servicePlansTable)
      .orderBy(desc(servicePlansTable.createdAt));

    if (vin) {
      const upperVin = vin.toUpperCase().trim();
      plans = plans.filter((p) => p.vin.toUpperCase() === upperVin);
    }
    if (status) {
      plans = plans.filter((p) => p.status === status);
    }

    const withSlots = await Promise.all(plans.map((p) => buildPlanResponse(p.id)));
    res.json({ plans: withSlots.filter(Boolean) });
  } catch (err) {
    req.log.error(err, "Failed to list service plans");
    res.status(500).json({ error: "Failed to list service plans" });
  }
});

// ── VIN lookup — returns active plans for a VIN ───────────────────────────────
// MUST be registered before /service-plans/:id so "by-vin" is not captured as an id
router.get("/service-plans/by-vin/:vin", async (req, res) => {
  const vin = req.params.vin.toUpperCase().trim();
  if (!vin || vin.length < 5) { res.status(400).json({ error: "VIN required" }); return; }
  try {
    const plans = await db
      .select()
      .from(servicePlansTable)
      .where(and(
        eq(servicePlansTable.vin, vin),
        eq(servicePlansTable.status, "active")
      ));

    const withSlots = await Promise.all(plans.map((p) => buildPlanResponse(p.id)));
    res.json({ plans: withSlots.filter(Boolean) });
  } catch (err) {
    req.log.error(err, "Failed to look up plans by VIN");
    res.status(500).json({ error: "Failed to look up plans by VIN" });
  }
});

// ── Get single plan ───────────────────────────────────────────────────────────
router.get("/service-plans/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const plan = await buildPlanResponse(id);
    if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
    res.json(plan);
  } catch (err) {
    req.log.error(err, "Failed to get service plan");
    res.status(500).json({ error: "Failed to get service plan" });
  }
});

// ── Create plan ───────────────────────────────────────────────────────────────
router.post("/service-plans", async (req, res) => {
  const {
    name, vin, vehicleLabel, customerName, totalPrice,
    soldBy, locationId, notes, packageIds, expiryDate, maxMileage,
  } = req.body as {
    name?: string;
    vin?: string;
    vehicleLabel?: string;
    customerName?: string;
    totalPrice?: string | number;
    soldBy?: string;
    locationId?: number;
    notes?: string;
    packageIds?: number[];
    expiryDate?: string | null;
    maxMileage?: number | null;
  };

  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  if (!vin?.trim() || vin.trim().length < 5) { res.status(400).json({ error: "vin is required (min 5 chars)" }); return; }
  if (!packageIds || packageIds.length === 0) { res.status(400).json({ error: "At least one package is required" }); return; }

  try {
    // Verify all packages exist
    const pkgs = await db
      .select({ id: servicePackagesTable.id, name: servicePackagesTable.name })
      .from(servicePackagesTable)
      .where(eq(servicePackagesTable.isActive, true));

    const pkgMap = new Map(pkgs.map((p) => [p.id, p.name]));
    const missing = packageIds.filter((id) => !pkgMap.has(id));
    if (missing.length > 0) {
      res.status(400).json({ error: `Package IDs not found: ${missing.join(", ")}` });
      return;
    }

    const planNumber = generatePlanNumber();
    const principal = res.locals.principal;
    const actor = soldBy || (principal ? (principal.type === "mobile" ? principal.userCode : principal.username) : "system");

    const [plan] = await db
      .insert(servicePlansTable)
      .values({
        planNumber,
        name: name.trim(),
        vin: vin.trim().toUpperCase(),
        vehicleLabel: vehicleLabel?.trim() || null,
        customerName: customerName?.trim() || null,
        totalPrice: String(totalPrice ?? "0"),
        soldBy: actor,
        locationId: locationId || null,
        notes: notes?.trim() || null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        maxMileage: maxMileage ? Number(maxMileage) : null,
        status: "active",
      })
      .returning();

    // Create one slot per package (allowing duplicates — you can include the same package multiple times)
    await db.insert(servicePlanSlotsTable).values(
      packageIds.map((pkgId, idx) => ({
        planId: plan.id,
        packageId: pkgId,
        packageName: pkgMap.get(pkgId) ?? "Unknown",
        slotOrder: idx,
      }))
    );

    const full = await buildPlanResponse(plan.id);
    res.status(201).json(full);
  } catch (err) {
    req.log.error(err, "Failed to create service plan");
    res.status(500).json({ error: "Failed to create service plan" });
  }
});

// ── Update plan header (name, notes, status) ──────────────────────────────────
router.patch("/service-plans/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, notes, status, customerName, vehicleLabel, totalPrice, expiryDate, maxMileage } = req.body as {
    name?: string;
    notes?: string;
    status?: "active" | "exhausted" | "cancelled";
    customerName?: string;
    vehicleLabel?: string;
    totalPrice?: string | number;
    expiryDate?: string | null;
    maxMileage?: number | null;
  };
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name.trim();
    if (notes !== undefined) updates.notes = notes;
    if (status !== undefined) updates.status = status;
    if (customerName !== undefined) updates.customerName = customerName;
    if (vehicleLabel !== undefined) updates.vehicleLabel = vehicleLabel;
    if (totalPrice !== undefined) updates.totalPrice = String(totalPrice);
    if (expiryDate !== undefined) updates.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (maxMileage !== undefined) updates.maxMileage = maxMileage ? Number(maxMileage) : null;

    const [updated] = await db
      .update(servicePlansTable)
      .set(updates)
      .where(eq(servicePlansTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Plan not found" }); return; }
    const full = await buildPlanResponse(id);
    res.json(full);
  } catch (err) {
    req.log.error(err, "Failed to update service plan");
    res.status(500).json({ error: "Failed to update service plan" });
  }
});

// ── Redeem a slot ─────────────────────────────────────────────────────────────
// POST /service-plans/:id/redeem  { slotId, estimateRef }
router.post("/service-plans/:id/redeem", async (req, res) => {
  const planId = Number(req.params.id);
  if (!planId) { res.status(400).json({ error: "Invalid plan id" }); return; }
  const { slotId, estimateRef } = req.body as { slotId?: number; estimateRef?: string };
  if (!slotId) { res.status(400).json({ error: "slotId is required" }); return; }

  try {
    const [slot] = await db
      .select()
      .from(servicePlanSlotsTable)
      .where(and(
        eq(servicePlanSlotsTable.id, slotId),
        eq(servicePlanSlotsTable.planId, planId)
      ));

    if (!slot) { res.status(404).json({ error: "Slot not found on this plan" }); return; }
    if (slot.redeemedAt) { res.status(409).json({ error: "This service slot has already been redeemed" }); return; }

    // Fetch the plan to check expiry and mileage
    const [plan] = await db.select().from(servicePlansTable).where(eq(servicePlansTable.id, planId));
    if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
    if (plan.status !== "active") { res.status(409).json({ error: "This plan is no longer active" }); return; }
    if (plan.expiryDate && plan.expiryDate < new Date()) {
      res.status(409).json({ error: `This plan expired on ${plan.expiryDate.toLocaleDateString()}` });
      return;
    }

    const { currentMileage } = req.body as { slotId?: number; estimateRef?: string; currentMileage?: number };
    if (plan.maxMileage && currentMileage != null && currentMileage > plan.maxMileage) {
      res.status(409).json({
        error: `This plan's mileage limit is ${plan.maxMileage.toLocaleString()} km. Current odometer (${currentMileage.toLocaleString()} km) exceeds the limit.`,
      });
      return;
    }

    const principal = res.locals.principal;
    const actor = principal ? (principal.type === "mobile" ? principal.userCode : principal.username) : "system";

    await db
      .update(servicePlanSlotsTable)
      .set({
        redeemedAt: new Date(),
        redeemedOnEstimate: estimateRef ?? null,
        redeemedBy: actor,
      })
      .where(eq(servicePlanSlotsTable.id, slotId));

    // Check if all slots are now redeemed → auto-exhaust the plan
    const allSlots = await db
      .select()
      .from(servicePlanSlotsTable)
      .where(eq(servicePlanSlotsTable.planId, planId));

    const allUsed = allSlots.every((s) => s.redeemedAt !== null);
    if (allUsed) {
      await db
        .update(servicePlansTable)
        .set({ status: "exhausted", updatedAt: new Date() })
        .where(eq(servicePlansTable.id, planId));
    }

    // Return the package lines so the estimate screen can add them
    const [updatedSlot] = await db
      .select()
      .from(servicePlanSlotsTable)
      .where(eq(servicePlanSlotsTable.id, slotId));

    const packageLines = await db
      .select()
      .from(servicePackageLinesTable)
      .where(eq(servicePackageLinesTable.packageId, slot.packageId))
      .orderBy(asc(servicePackageLinesTable.displayOrder));

    const full = await buildPlanResponse(planId);
    res.json({ plan: full, slot: updatedSlot, packageLines });
  } catch (err) {
    req.log.error(err, "Failed to redeem service plan slot");
    res.status(500).json({ error: "Failed to redeem slot" });
  }
});

// ── Delete plan ───────────────────────────────────────────────────────────────
router.delete("/service-plans/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [deleted] = await db
      .delete(servicePlansTable)
      .where(eq(servicePlansTable.id, id))
      .returning({ id: servicePlansTable.id });
    if (!deleted) { res.status(404).json({ error: "Plan not found" }); return; }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Failed to delete service plan");
    res.status(500).json({ error: "Failed to delete service plan" });
  }
});

export default router;
