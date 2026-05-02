import { Router } from "express";

import { publicAuthRouter } from "./auth.routes";
import { publicDocusealWebhookRouter } from "./docuseal.routes";
import { publicHealthRouter } from "./health.routes";
import { publicTimeTrackingRouter } from "./time-tracking.routes";

export const publicRouter = Router();

publicRouter.use(publicAuthRouter);
publicRouter.use(publicDocusealWebhookRouter);
publicRouter.use(publicHealthRouter);
publicRouter.use(publicTimeTrackingRouter);
