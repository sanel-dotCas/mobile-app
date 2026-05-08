import { Router } from "express";
import { db } from "@workspace/db";
import {
  servicePlansTable,
  servicePlanSlotsTable,
} from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { buildPlanCardHtml } from "../lib/planCardHtml";

const router = Router();

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
    // Kept separately so the print-card route can include it in rendered HTML
    // without exposing it in the public JSON lookup response.
    _customerName: plan.customerName ?? null,
  };
}

// ── Public plan lookup — GET /service-plans/lookup?vin=XXX or ?planNumber=YYY ──
//
// No authentication required. Returns non-PII plan info so service advisors
// can check remaining slots at the counter without a yard/mobile login.
// Accepts only exact VIN or plan number — no wildcard or list queries.
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

    // Strip the internal _customerName field — PII stays out of the JSON response.
    const publicResults = results.map((p) => {
      if (!p) return p;
      const { _customerName: _cn, ...rest } = p;
      void _cn;
      return rest;
    });

    res.json({
      plans: publicResults,
      summary: {
        total: publicResults.length,
        active: publicResults.filter((p) => p!.status === "active").length,
        exhausted: publicResults.filter((p) => p!.status === "exhausted").length,
        cancelled: publicResults.filter((p) => p!.status === "cancelled").length,
        totalRemainingSlots: publicResults.reduce((sum, p) => sum + (p!.remainingSlots ?? 0), 0),
      },
    });
  } catch (err) {
    req.log.error(err, "Failed to look up service plans");
    res.status(500).json({ error: "Failed to look up service plans" });
  }
});

// ── Print-card route — GET /service-plans/print-card?planNumber=XXXX ──────────
//
// No authentication required (same access level as the lookup endpoint above).
// Uses planNumber (a non-guessable opaque string like "SP-2026-VIXP8") rather
// than a sequential planId, so there is no IDOR/enumeration risk. Requires
// knowing the exact plan number to access any card.
//
// Returns a fully server-rendered, print-ready HTML page. All dynamic values
// are HTML-escaped server-side. customerName is included in the rendered HTML
// (the card is designed to be handed to the customer at the counter) but is
// not exposed in the public JSON lookup endpoint.
//
// On web the mobile hook opens this URL in a new tab so the browser handles
// printing; on native the hook fetches the HTML and passes it to expo-print.
router.get("/service-plans/print-card", async (req, res) => {
  const { planNumber } = req.query as Record<string, string | undefined>;
  const pn = planNumber?.trim().toUpperCase();

  if (!pn) {
    res.status(400).send("<p>planNumber is required</p>");
    return;
  }

  try {
    const [planRow] = await db
      .select()
      .from(servicePlansTable)
      .where(eq(servicePlansTable.planNumber, pn));

    if (!planRow) {
      res.status(404).send("<p>Plan not found</p>");
      return;
    }

    const full = await buildPublicPlan(planRow.id);
    if (!full) {
      res.status(404).send("<p>Plan not found</p>");
      return;
    }

    const html = buildPlanCardHtml({ ...full, customerName: full._customerName });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(html);
  } catch (err) {
    req.log.error(err, "Failed to render plan card");
    res.status(500).send("<p>Failed to generate plan card</p>");
  }
});

export default router;
