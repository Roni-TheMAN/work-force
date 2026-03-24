import { Router } from "express";

import { getPublicHealthController } from "../../controllers/public/health.controller";

export const publicHealthRouter = Router();

publicHealthRouter.get("/health", getPublicHealthController);
