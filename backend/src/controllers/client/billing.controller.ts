import type { RequestHandler } from "express";

import { HttpError } from "../../lib/http-error";
import { getAuthenticatedUser } from "../../middleware/authenticate-client";
import { createEmbeddedCheckoutSession, type PaidPlanId } from "../../services/stripe-checkout.service";

type CheckoutSessionRequestBody = {
  planId?: string;
};

function isPaidPlanId(value: string | undefined): value is PaidPlanId {
  return value === "pro" || value === "enterprise";
}

export const createClientCheckoutSessionController: RequestHandler = async (req, res, next) => {
  try {
    const { planId } = (req.body ?? {}) as CheckoutSessionRequestBody;

    if (!isPaidPlanId(planId)) {
      throw new HttpError(400, "A paid planId of 'pro' or 'enterprise' is required.");
    }

    const authUser = getAuthenticatedUser(req);
    const session = await createEmbeddedCheckoutSession(planId, authUser);

    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
};
