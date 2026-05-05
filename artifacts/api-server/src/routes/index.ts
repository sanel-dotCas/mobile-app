import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import estimatesRouter from "./estimates";
import storageRouter from "./storage";
import healthRouter from "./health";
import { yardAuthPublicRouter, yardAuthProtectedRouter } from "./yard-auth";
import yardLocationsRouter from "./yard-locations";
import yardSpotsRouter from "./yard-spots";
import yardVehiclesRouter from "./yard-vehicles";
import yardInspectionsRouter from "./yard-inspections";
import yardDashboardRouter from "./yard-dashboard";
import yardRecommendationsRouter from "./yard-recommendations";
import yardUsersRouter from "./yard-users";
import yardTransfersRouter from "./yard-transfers";
import partsRouter from "./parts";
import jobsRouter from "./jobs";
import techniciansRouter from "./technicians";
import servicePackagesRouter from "./service-packages";
import adminRouter from "./admin";
import { requireAuth, requireYardPrincipal, requireAdminRole, requireMobileRoles } from "../middlewares/requireAuth";

const router: IRouter = Router();

// ── Public routes (no authentication required) ────────────────────────────────
router.use(healthRouter);
router.use(yardAuthPublicRouter);

// ── Authentication enforcement ────────────────────────────────────────────────
// All routes below require a valid Bearer session token (yard or mobile).
router.use(requireAuth);

// ── Protected routes — authenticated push-token / notifications endpoints ─────
// These are reached by mobile principals and require auth but not a yard role.
router.use(yardAuthProtectedRouter);

// ── Mobile-accessible DMS routes with per-path RBAC ───────────────────────────
// Path-prefixed guards run only for the matching path tree.
// Using router.use('/path', middleware) ensures the guard does NOT bleed into
// other routers (unlike subrouter-internal router.use() which runs for all traffic).

// Job mutations: technician / supervisor / admin mobile role (or any yard principal).
// POST /jobs and DELETE /jobs/:id additionally enforce requireYardPrincipal per-route.
const requireJobWrite = requireMobileRoles("technician", "supervisor", "admin");
router.use("/jobs", (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "GET" || req.method === "HEAD") { next(); return; }
  requireJobWrite(req, res, next);
});
router.use(jobsRouter);

router.use(techniciansRouter);

// Parts mutations: parts / supervisor / admin mobile role (or any yard principal).
const requirePartsWrite = requireMobileRoles("parts", "supervisor", "admin");
router.use("/parts", (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "GET" || req.method === "HEAD") { next(); return; }
  requirePartsWrite(req, res, next);
});
router.use(partsRouter);

router.use(estimatesRouter);

// ── Admin-only routes (admin role — yard OR mobile admin) ─────────────────────
// Path-scoped guards: requireAdminRole only fires for /admin/* and
// /service-packages/* paths, so it does NOT bleed into yard routes below.
// Mobile admins (role="admin") pass through these guards too.
router.use("/admin", requireAdminRole);
router.use("/service-packages", requireAdminRole);
router.use(adminRouter);
router.use(servicePackagesRouter);

// ── Supervisor/Admin mobile access to yard inventory & inspections ─────────────
// Supervisors need to view vehicle inventory, manage inspections, and see
// inspection recommendations — all without a full yard-web session.
//
// Access rules per resource:
//   yard/vehicles        → GET: supervisor|admin mobile; POST/PATCH/DELETE: yard only
//   yard/inspections     → GET/POST/PATCH: supervisor|admin mobile; DELETE: yard only
//   yard/inspection-*    → GET: supervisor|admin mobile
//
// Yard principals always pass through (handled by the yard-only block below).
const requireSupervisorOrAdmin = requireMobileRoles("supervisor", "admin");

router.use("/yard/vehicles", (req: Request, res: Response, next: NextFunction) => {
  const p = res.locals.principal;
  if (p?.type !== "mobile") { next(); return; }
  // Mobile: reads allowed for supervisor/admin; writes blocked (yard only)
  if (req.method === "GET" || req.method === "HEAD") {
    requireSupervisorOrAdmin(req, res, next);
  } else {
    res.status(403).json({ error: "Yard web session required for vehicle mutations" });
  }
});

router.use("/yard/inspections", (req: Request, res: Response, next: NextFunction) => {
  const p = res.locals.principal;
  if (p?.type !== "mobile") { next(); return; }
  // Mobile supervisors/admins: full read + create + update; delete blocked
  if (req.method === "DELETE") {
    res.status(403).json({ error: "Yard web session required to delete inspections" });
    return;
  }
  requireSupervisorOrAdmin(req, res, next);
});

router.use("/yard/inspection-recommendations", (req: Request, res: Response, next: NextFunction) => {
  const p = res.locals.principal;
  if (p?.type !== "mobile") { next(); return; }
  requireSupervisorOrAdmin(req, res, next);
});

// Mount the yard routers — these serve both mobile (guarded above) and yard principals.
router.use(yardVehiclesRouter);
router.use(yardInspectionsRouter);
router.use(yardRecommendationsRouter);

// ── Yard-web-only routes (mobile principals rejected with 403) ────────────────
// Yard management data and file storage are not consumed by the mobile app and
// must not be reachable via mobile session tokens.
router.use(requireYardPrincipal);
router.use(storageRouter);
router.use(yardLocationsRouter);
router.use(yardSpotsRouter);
router.use(yardDashboardRouter);
router.use(yardUsersRouter);
router.use(yardTransfersRouter);

export default router;
