import { Router } from "express";

import { createClientCheckoutSessionController } from "../../controllers/client/billing.controller";
import { requireClientAuth } from "../../middleware/authenticate-client";

export const clientBillingRouter = Router();

clientBillingRouter.post("/billing/checkout-session", requireClientAuth, createClientCheckoutSessionController);
