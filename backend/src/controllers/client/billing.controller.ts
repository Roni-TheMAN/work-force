import type { RequestHandler } from "express";

import { HttpError } from "../../lib/http-error";
import { getAuthenticatedUser } from "../../middleware/authenticate-client";
import {
  addOrganizationSubscriptionAddon,
  createEmbeddedCheckoutSession,
  getOrganizationBillingSummary,
  removeOrganizationSubscriptionAddon,
  syncCheckoutSessionToDatabase,
  updateOrganizationSubscriptionAddonQuantity,
} from "../../services/stripe-billing.service";

type CheckoutSessionRequestBody = {
  addons?: Array<{
    code?: string;
    quantity?: number;
  }>;
  organizationId?: string;
  planId?: string;
};

type BillingSummaryQuery = {
  organizationId?: string;
};

type BillingSubscriptionItemMutationBody = {
  code?: string;
  organizationId?: string;
  quantity?: number;
};

type SyncCheckoutSessionBody = {
  organizationId?: string;
  sessionId?: string;
};

type PaidPlanId = "pro" | "enterprise";

function isPaidPlanId(value: string | undefined): value is PaidPlanId {
  return value === "pro" || value === "enterprise";
}

export const createClientCheckoutSessionController: RequestHandler = async (req, res, next) => {
  try {
    const { planId, organizationId, addons } = (req.body ?? {}) as CheckoutSessionRequestBody;

    if (!isPaidPlanId(planId)) {
      throw new HttpError(400, "A paid planId of 'pro' or 'enterprise' is required.");
    }

    if (!organizationId?.trim()) {
      throw new HttpError(400, "organizationId is required.");
    }

    const authUser = getAuthenticatedUser(req);
    const normalizedAddons = Array.isArray(addons)
      ? addons.map((addon) => ({
          code: typeof addon?.code === "string" ? addon.code : "",
          quantity: typeof addon?.quantity === "number" ? addon.quantity : 1,
        }))
      : [];
    const session = await createEmbeddedCheckoutSession(planId, organizationId, authUser, normalizedAddons);

    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
};

export const getClientBillingSummaryController: RequestHandler = async (req, res, next) => {
  try {
    const { organizationId } = req.query as BillingSummaryQuery;

    if (!organizationId?.trim()) {
      throw new HttpError(400, "organizationId is required.");
    }

    const summary = await getOrganizationBillingSummary(organizationId);
    res.json(summary);
  } catch (error) {
    next(error);
  }
};

export const addClientBillingSubscriptionItemController: RequestHandler = async (req, res, next) => {
  try {
    const { organizationId, code, quantity } = (req.body ?? {}) as BillingSubscriptionItemMutationBody;

    if (!organizationId?.trim()) {
      throw new HttpError(400, "organizationId is required.");
    }

    if (!code?.trim()) {
      throw new HttpError(400, "code is required.");
    }

    if (typeof quantity !== "number") {
      throw new HttpError(400, "quantity is required.");
    }

    const summary = await addOrganizationSubscriptionAddon(organizationId, code.trim(), quantity);
    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
};

export const syncClientCheckoutSessionController: RequestHandler = async (req, res, next) => {
  try {
    const { organizationId, sessionId } = (req.body ?? {}) as SyncCheckoutSessionBody;

    if (!organizationId?.trim()) {
      throw new HttpError(400, "organizationId is required.");
    }

    if (!sessionId?.trim()) {
      throw new HttpError(400, "sessionId is required.");
    }

    const summary = await syncCheckoutSessionToDatabase(sessionId.trim(), organizationId.trim());
    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
};

export const updateClientBillingSubscriptionItemController: RequestHandler = async (req, res, next) => {
  try {
    const { organizationId, quantity } = (req.body ?? {}) as BillingSubscriptionItemMutationBody;
    const code = typeof req.params.code === "string" ? req.params.code : "";

    if (!organizationId?.trim()) {
      throw new HttpError(400, "organizationId is required.");
    }

    if (!code.trim()) {
      throw new HttpError(400, "code is required.");
    }

    if (typeof quantity !== "number") {
      throw new HttpError(400, "quantity is required.");
    }

    const summary = await updateOrganizationSubscriptionAddonQuantity(organizationId, code.trim(), quantity);
    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
};

export const removeClientBillingSubscriptionItemController: RequestHandler = async (req, res, next) => {
  try {
    const { organizationId } = (req.body ?? {}) as BillingSubscriptionItemMutationBody;
    const code = typeof req.params.code === "string" ? req.params.code : "";

    if (!organizationId?.trim()) {
      throw new HttpError(400, "organizationId is required.");
    }

    if (!code.trim()) {
      throw new HttpError(400, "code is required.");
    }

    const summary = await removeOrganizationSubscriptionAddon(organizationId, code.trim());
    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
};
