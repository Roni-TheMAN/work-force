import { Router } from "express";

import { publicHealthRouter } from "./health.routes";

export const publicRouter = Router();

publicRouter.use(publicHealthRouter);
