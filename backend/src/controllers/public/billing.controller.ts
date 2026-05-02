import type { RequestHandler } from "express";

import { processStripeWebhook } from "../../services/stripe-billing.service";

export const handleStripeWebhookController: RequestHandler = async (req, res, next) => {
  try {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? "");
    await processStripeWebhook(body, req.headers["stripe-signature"]);

    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
};
