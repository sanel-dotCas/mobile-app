import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { yardVehiclesTable, yardInspectionsTable, yardLocationsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { formatVehicleName } from "../lib/formatVehicleName";

const router: IRouter = Router();

// ── Permission maps ──────────────────────────────────────────────────────────
const YARD_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ["view_pricing", "move_vehicles", "create_inspections", "manage_users", "view_reports", "configure_settings", "view_all_locations"],
  yard_manager: ["view_pricing", "move_vehicles", "create_inspections", "view_reports", "view_all_locations"],
  yard_operator: ["move_vehicles", "create_inspections"],
};

// Mobile DMS role permissions for yard features
const DMS_ROLE_PERMISSIONS: Record<string, string[]> = {
  supervisor: ["view_pricing", "view_yard", "create_inspections", "view_reports"],
  technician: ["view_yard", "create_inspections"],
  estimator: ["view_yard"],
};

// GET /api/yard/permissions?role=yard_manager   (yard web app)
// GET /api/yard/permissions?dmsRole=supervisor  (mobile app)
router.get("/yard/permissions", (req, res) => {
  const { role, dmsRole } = req.query as Record<string, string>;
  if (role) {
    const perms = YARD_ROLE_PERMISSIONS[role] ?? [];
    res.json({ role, permissions: perms });
    return;
  }
  if (dmsRole) {
    const perms = DMS_ROLE_PERMISSIONS[dmsRole] ?? [];
    res.json({ dmsRole, permissions: perms });
    return;
  }
  res.status(400).json({ error: "role or dmsRole query param required" });
});

// ── Inspection Recommendations ───────────────────────────────────────────────

function buildAIRecommendation(
  daysOverdue: number,
  daysSinceArrival: number,
  intervalDays: number,
  hasEverBeenInspected: boolean
): string {
  const absOverdue = Math.abs(daysOverdue);

  if (daysOverdue < -30) {
    return `Critical: This vehicle has been in the yard for ${daysSinceArrival} days and is ${absOverdue} days overdue for inspection. Prolonged storage without checking can cause tyre flat-spots, battery discharge, and brake corrosion. Schedule immediately.`;
  }
  if (daysOverdue < 0) {
    return `Overdue: PDI inspection is ${absOverdue} day${absOverdue !== 1 ? "s" : ""} past due. Recommend scheduling within the next 48 hours to maintain vehicle condition standards.`;
  }
  if (daysOverdue <= 7) {
    return `Due Soon: Inspection due in ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}. Plan PDI check to stay within the ${intervalDays}-day inspection cycle.`;
  }
  if (!hasEverBeenInspected && daysSinceArrival > 7) {
    return `Pending First Inspection: Vehicle arrived ${daysSinceArrival} days ago and has not yet had an initial PDI. Recommend completing the first inspection within ${daysOverdue} days.`;
  }
  return `On Schedule: Next inspection due in ${daysOverdue} days. Vehicle is within the ${intervalDays}-day inspection cycle.`;
}

// GET /api/yard/inspection-recommendations?locationId=1
router.get("/yard/inspection-recommendations", async (req, res) => {
  const { locationId, status } = req.query as Record<string, string>;

  const vehicles = await db
    .select()
    .from(yardVehiclesTable)
    .where(
      locationId
        ? eq(yardVehiclesTable.locationId, Number(locationId))
        : undefined
    )
    .orderBy(desc(yardVehiclesTable.arrivedAt));

  const now = new Date();

  const results = await Promise.all(
    vehicles
      .filter((v) => v.status !== "sold") // skip sold vehicles
      .map(async (v) => {
        // Find latest finished inspection
        const [lastInsp] = await db
          .select()
          .from(yardInspectionsTable)
          .where(
            and(
              eq(yardInspectionsTable.vehicleId, v.id),
              eq(yardInspectionsTable.status, "finished")
            )
          )
          .orderBy(desc(yardInspectionsTable.completedAt))
          .limit(1);

        const intervalDays = v.inspectionIntervalDays ?? 30;
        const arrivedAt = v.arrivedAt ?? v.createdAt;
        const daysSinceArrival = Math.floor(
          (now.getTime() - arrivedAt.getTime()) / 86400000
        );

        let nextDueDate: Date;
        let hasEverBeenInspected = false;

        if (lastInsp?.completedAt) {
          hasEverBeenInspected = true;
          nextDueDate = new Date(
            lastInsp.completedAt.getTime() + intervalDays * 86400000
          );
        } else {
          nextDueDate = new Date(
            arrivedAt.getTime() + intervalDays * 86400000
          );
        }

        const daysRemaining = Math.floor(
          (nextDueDate.getTime() - now.getTime()) / 86400000
        );

        let urgency: "overdue" | "due-soon" | "ok";
        if (daysRemaining < 0) urgency = "overdue";
        else if (daysRemaining <= 7) urgency = "due-soon";
        else urgency = "ok";

        // Fetch location name
        let locationName: string | null = null;
        if (v.locationId) {
          const [loc] = await db
            .select()
            .from(yardLocationsTable)
            .where(eq(yardLocationsTable.id, v.locationId))
            .limit(1);
          locationName = loc?.name ?? null;
        }

        return {
          vehicleId: v.id,
          stockNumber: v.stockNumber,
          vehicleName: formatVehicleName(v),
          vin: v.vin,
          status: v.status,
          locationName,
          inspectionIntervalDays: intervalDays,
          daysSinceArrival,
          lastInspectedAt: lastInsp?.completedAt?.toISOString() ?? null,
          lastInspectionType: lastInsp?.type ?? null,
          lastInspectionTechnician: lastInsp?.assignedTo ?? null,
          nextDueDate: nextDueDate.toISOString(),
          daysRemaining,
          urgency,
          hasEverBeenInspected,
          aiRecommendation: buildAIRecommendation(
            daysRemaining,
            daysSinceArrival,
            intervalDays,
            hasEverBeenInspected
          ),
        };
      })
  );

  // Filter by urgency if requested
  const filtered = status
    ? results.filter((r) => r.urgency === status)
    : results;

  // Sort: overdue first, then due-soon, then ok; within each group by daysRemaining asc
  filtered.sort((a, b) => {
    const order = { overdue: 0, "due-soon": 1, ok: 2 };
    const diff = order[a.urgency] - order[b.urgency];
    return diff !== 0 ? diff : a.daysRemaining - b.daysRemaining;
  });

  const overdue = filtered.filter((r) => r.urgency === "overdue").length;
  const dueSoon = filtered.filter((r) => r.urgency === "due-soon").length;
  const ok = filtered.filter((r) => r.urgency === "ok").length;

  res.json({ recommendations: filtered, summary: { overdue, dueSoon, ok, total: filtered.length } });
});

// PATCH /api/yard/vehicles/:vehicleId/inspection-interval
router.patch("/yard/vehicles/:vehicleId/inspection-interval", async (req, res) => {
  const vehicleId = Number(req.params.vehicleId);
  const { intervalDays } = req.body;
  if (!intervalDays || intervalDays < 1 || intervalDays > 365) {
    res.status(400).json({ error: "intervalDays must be between 1 and 365" });
    return;
  }
  const [updated] = await db
    .update(yardVehiclesTable)
    .set({ inspectionIntervalDays: Number(intervalDays) })
    .where(eq(yardVehiclesTable.id, vehicleId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }
  res.json({ vehicleId: updated.id, inspectionIntervalDays: updated.inspectionIntervalDays });
});

export default router;
