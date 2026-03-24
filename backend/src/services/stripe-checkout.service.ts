import Stripe from "stripe";

import { env } from "../lib/env";
import { HttpError } from "../lib/http-error";
import type { AuthenticatedSupabaseUser } from "../lib/supabase-auth";

export type PaidPlanId = "pro" | "enterprise";

const stripePlanCatalog: Record<PaidPlanId, string> = {
  pro: "prod_UBC7a2DJV1TDmz",
  enterprise: "price_1TCpjI2M9pFpo1972DCWAewH",
};

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!env.stripeSecretKey) {
    throw new HttpError(500, "Missing STRIPE_SECRET_KEY environment variable.");
  }

  stripeClient ??= new Stripe(env.stripeSecretKey);
  return stripeClient;
}

async function resolvePrice(referenceId: string): Promise<Stripe.Price> {
  const stripe = getStripeClient();

  if (referenceId.startsWith("price_")) {
    return stripe.prices.retrieve(referenceId);
  }

  if (!referenceId.startsWith("prod_")) {
    throw new HttpError(500, `Unsupported Stripe catalog reference: ${referenceId}`);
  }

  const product = await stripe.products.retrieve(referenceId, {
    expand: ["default_price"],
  });

  if (product.default_price && typeof product.default_price !== "string") {
    return product.default_price;
  }

  if (typeof product.default_price === "string") {
    return stripe.prices.retrieve(product.default_price);
  }

  const prices = await stripe.prices.list({
    product: referenceId,
    active: true,
    limit: 1,
  });

  const fallbackPrice = prices.data[0];

  if (!fallbackPrice) {
    throw new HttpError(500, `No active Stripe prices were found for product ${referenceId}.`);
  }

  return fallbackPrice;
}

function getCheckoutMode(price: Stripe.Price): Stripe.Checkout.SessionCreateParams.Mode {
  return price.type === "recurring" ? "subscription" : "payment";
}

export async function createEmbeddedCheckoutSession(planId: PaidPlanId, authUser: AuthenticatedSupabaseUser) {
  const stripe = getStripeClient();
  const price = await resolvePrice(stripePlanCatalog[planId]);

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    mode: getCheckoutMode(price),
    customer_email: authUser.email,
    client_reference_id: authUser.id,
    line_items: [
      {
        price: price.id,
        quantity: 1,
      },
    ],
    return_url: `${env.appDomain}/quick-dash?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
  });

  if (!session.client_secret) {
    throw new HttpError(500, "Stripe checkout session did not return a client secret.");
  }

  return {
    clientSecret: session.client_secret,
    sessionId: session.id,
  };
}
