import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import salesRouter from "./sales";
import productsRouter from "./products";
import usersRouter from "./users";
import backupRouter from "./backup";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(requireAuth);
router.use(salesRouter);
router.use(productsRouter);
router.use(usersRouter);
router.use(backupRouter);

export default router;
