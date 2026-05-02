import { Router } from "express";

import {
  addClientBillingSubscriptionItemController,
  createClientCheckoutSessionController,
  getClientBillingSummaryController,
  removeClientBillingSubscriptionItemController,
  syncClientCheckoutSessionController,
  updateClientBillingSubscriptionItemController,
} from "../../controllers/client/billing.controller";
import { PERMISSIONS } from "../../lib/permissions";
import { requirePermission } from "../../middleware/auth";
import { requireClientAuth } from "../../middleware/authenticate-client";

export const clientBillingRouter = Router();

clientBillingRouter.get(
  "/billing/summary",
  requireClientAuth,
  requirePermission(PERMISSIONS.BILLING_MANAGE),
  getClientBillingSummaryController
);
clientBillingRouter.post(
  "/billing/checkout-session",
  requireClientAuth,
  requirePermission(PERMISSIONS.BILLING_MANAGE),
  createClientCheckoutSessionController
);
clientBillingRouter.post(
  "/billing/checkout-sync",
  requireClientAuth,
  requirePermission(PERMISSIONS.BILLING_MANAGE),
  syncClientCheckoutSessionController
);
clientBillingRouter.post(
  "/billing/subscription-items",
  requireClientAuth,
  requirePermission(PERMISSIONS.BILLING_MANAGE),
  addClientBillingSubscriptionItemController
);
clientBillingRouter.patch(
  "/billing/subscription-items/:code",
  requireClientAuth,
  requirePermission(PERMISSIONS.BILLING_MANAGE),
  updateClientBillingSubscriptionItemController
);
clientBillingRouter.delete(
  "/billing/subscription-items/:code",
  requireClientAuth,
  requirePermission(PERMISSIONS.BILLING_MANAGE),
  removeClientBillingSubscriptionItemController
);
