import { Router, type IRouter } from "express";
import estimatesRouter from "./estimates";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);
router.use(estimatesRouter);

export default router;
