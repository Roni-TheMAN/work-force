import { Router } from "express";

import { handleDocusealWebhookController } from "../../modules/documents/document.controller";

export const publicDocusealWebhookRouter = Router();

publicDocusealWebhookRouter.post("/webhooks/docuseal", handleDocusealWebhookController);
