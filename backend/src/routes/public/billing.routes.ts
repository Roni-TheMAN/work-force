import express, { Router } from "express";

import { handleStripeWebhookController } from "../../controllers/public/billing.controller";

export const publicStripeWebhookRouter = Router();

publicStripeWebhookRouter.post(
  "/billing/stripe/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhookController
);
