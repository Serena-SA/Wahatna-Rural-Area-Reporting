import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import reportRouter from "./report";
import dashboardRouter from "./dashboard";
import fleetRouter from "./fleet";
import workerRouter from "./worker";
import supervisorRouter from "./supervisor";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(reportRouter);
router.use(dashboardRouter);
router.use(fleetRouter);
router.use(workerRouter);
router.use(supervisorRouter);

export default router;
