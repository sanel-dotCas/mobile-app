import { Router } from "express";
import { db } from "@workspace/db";
import {
  servicePlansTable,
  servicePlanSlotsTable,
} from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router();

// Minimum fields returned by the public lookup — no PII, no internal tracking data.
// Full plan data (customerName, soldBy, redeemedBy, estimate refs) is only available
// via authenticated routes.
async function buildPublicPlan(planId: number) {
  const [plan] = await db
    .select()
    .from(servicePlansTable)
    .where(eq(servicePlansTable.id, planId));
  if (!plan) return null;

  const slots = await db
    .select()
    .from(servicePlanSlotsTable)
    .where(eq(servicePlanSlotsTable.planId, planId))
    .orderBy(asc(servicePlanSlotsTable.slotOrder));

  const usedSlots = slots.filter((s) => s.redeemedAt !== null).length;
  return {
    id: plan.id,
    planNumber: plan.planNumber,
    name: plan.name,
    vin: plan.vin,
    vehicleLabel: plan.vehicleLabel,
    status: plan.status,
    expiryDate: plan.expiryDate,
    maxMileage: plan.maxMileage,
    slots: slots.map((s) => ({
      id: s.id,
      packageName: s.packageName,
      slotOrder: s.slotOrder,
      redeemed: s.redeemedAt !== null,
    })),
    totalSlots: slots.length,
    usedSlots,
    remainingSlots: slots.length - usedSlots,
  };
}

// ── Public plan lookup — GET /service-plans/lookup?vin=XXX or ?planNumber=YYY ──
//
// No authentication required. Returns minimal, non-PII plan info (no customerName,
// soldBy, redeemedBy, estimate refs) so service advisors can check remaining slots
// at the counter without a yard/mobile login. Accepts only exact VIN or plan
// number — no wildcard or list queries. Filtering is pushed to the database layer
// to avoid full-table reads.
router.get("/service-plans/lookup", async (req, res) => {
  const { vin, planNumber } = req.query as Record<string, string | undefined>;

  if (!vin?.trim() && !planNumber?.trim()) {
    res.status(400).json({ error: "Provide vin or planNumber to look up a plan" });
    return;
  }

  try {
    let plans;

    if (planNumber?.trim()) {
      const upper = planNumber.trim().toUpperCase();
      plans = await db
        .select()
        .from(servicePlansTable)
        .where(eq(servicePlansTable.planNumber, upper));
    } else {
      const upper = vin!.trim().toUpperCase();
      plans = await db
        .select()
        .from(servicePlansTable)
        .where(eq(servicePlansTable.vin, upper));
    }

    const withSlots = await Promise.all(plans.map((p) => buildPublicPlan(p.id)));
    const results = withSlots.filter(Boolean);

    res.json({
      plans: results,
      summary: {
        total: results.length,
        active: results.filter((p) => p!.status === "active").length,
        exhausted: results.filter((p) => p!.status === "exhausted").length,
        cancelled: results.filter((p) => p!.status === "cancelled").length,
        totalRemainingSlots: results.reduce((sum, p) => sum + (p!.remainingSlots ?? 0), 0),
      },
    });
  } catch (err) {
    req.log.error(err, "Failed to look up service plans");
    res.status(500).json({ error: "Failed to look up service plans" });
  }
});

export default router;
