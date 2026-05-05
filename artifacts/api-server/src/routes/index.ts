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

// Job mutations:
//   PATCH: technician / supervisor / admin / parts — parts role needs PATCH to update task part statuses.
//   All other writes (PUT / POST / DELETE): technician / supervisor / admin only.
//   POST /jobs and DELETE /jobs/:id additionally enforce requireYardPrincipal per-route.
const requireJobPatch = requireMobileRoles("technician", "supervisor", "admin", "parts");
const requireJobWrite = requireMobileRoles("technician", "supervisor", "admin");
router.use("/jobs", (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "GET" || req.method === "HEAD") { next(); return; }
  if (req.method === "PATCH") { requireJobPatch(req, res, next); return; }
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
router.use("/admin", requireAdminRole);
router.use("/service-packages", requireAdminRole);
router.use(adminRouter);
router.use(servicePackagesRouter);

// ── Yard inventory & inspection routes — accessible by all mobile roles ────────
//
// All authenticated mobile roles (technician, supervisor, admin, parts, estimator)
// can read yard vehicles and inspections. Write permissions are role-scoped:
//
//   yard/vehicles   GET:          all mobile roles
//                   PATCH:        supervisor | admin  (status updates from monitor)
//                   POST/DELETE:  yard-web only
//
//   yard/inspections GET:         all mobile roles  (techs read their assigned queue)
//                    PATCH:       technician | supervisor | admin  (checklist results + assignment)
//                    POST:        supervisor | admin  (create / generate inspections)
//                    DELETE:      yard-web only
//
//   yard/inspection-recommendations  GET: all mobile roles
//
// Yard principals always bypass these guards and go straight through to the routers.
const requireAnyMobile = requireMobileRoles("technician", "supervisor", "admin", "parts", "estimator");
const requireSupervisorOrAdmin = requireMobileRoles("supervisor", "admin");
const requireTechOrAbove = requireMobileRoles("technician", "supervisor", "admin");

router.use("/yard/vehicles", (req: Request, res: Response, next: NextFunction) => {
  const p = res.locals.principal;
  if (p?.type !== "mobile") { next(); return; }
  if (req.method === "GET" || req.method === "HEAD") {
    requireAnyMobile(req, res, next);
  } else if (req.method === "PATCH") {
    requireSupervisorOrAdmin(req, res, next);
  } else {
    res.status(403).json({ error: "Yard web session required for vehicle mutations" });
  }
});

router.use("/yard/inspections", (req: Request, res: Response, next: NextFunction) => {
  const p = res.locals.principal;
  if (p?.type !== "mobile") { next(); return; }
  if (req.method === "GET" || req.method === "HEAD") {
    requireAnyMobile(req, res, next);
  } else if (req.method === "PATCH") {
    requireTechOrAbove(req, res, next);
  } else if (req.method === "POST") {
    requireSupervisorOrAdmin(req, res, next);
  } else {
    res.status(403).json({ error: "Yard web session required to delete inspections" });
  }
});

router.use("/yard/inspection-recommendations", (req: Request, res: Response, next: NextFunction) => {
  const p = res.locals.principal;
  if (p?.type !== "mobile") { next(); return; }
  requireAnyMobile(req, res, next);
});

// Mount yard routers — serve both mobile (guarded above) and yard-web principals.
router.use(yardVehiclesRouter);
router.use(yardInspectionsRouter);
router.use(yardRecommendationsRouter);

// ── Yard-web-only routes (mobile principals rejected with 403) ────────────────
router.use(requireYardPrincipal);
router.use(storageRouter);
router.use(yardLocationsRouter);
router.use(yardSpotsRouter);
router.use(yardDashboardRouter);
router.use(yardUsersRouter);
router.use(yardTransfersRouter);

export default router;
