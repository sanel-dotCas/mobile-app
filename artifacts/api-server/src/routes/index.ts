import { Router, type IRouter } from "express";
import estimatesRouter from "./estimates";
import healthRouter from "./health";
import yardAuthRouter from "./yard-auth";
import yardLocationsRouter from "./yard-locations";
import yardSpotsRouter from "./yard-spots";
import yardVehiclesRouter from "./yard-vehicles";
import yardInspectionsRouter from "./yard-inspections";
import yardDashboardRouter from "./yard-dashboard";
import yardRecommendationsRouter from "./yard-recommendations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(estimatesRouter);
router.use(yardAuthRouter);
router.use(yardLocationsRouter);
router.use(yardSpotsRouter);
router.use(yardVehiclesRouter);
router.use(yardInspectionsRouter);
router.use(yardDashboardRouter);
router.use(yardRecommendationsRouter);

export default router;
