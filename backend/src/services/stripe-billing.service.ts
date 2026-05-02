import Stripe from "stripe";

import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import { HttpError } from "../lib/http-error";
import type { AuthenticatedSupabaseUser } from "../lib/supabase-auth";
import {
  getBillingCatalogItemByCode,
  getBillingPriceForCatalogCode,
  getBillingQuantityModeByCode,
  listBillingAddons,
  listBillingPlans,
  type BillingCatalogSummary,
} from "./billing-catalog.service";
import { getOrganizationEntitlementsSnapshot, syncOrganizationEntitlementsFromSubscription } from "./billing-entitlements.service";

type RawDbClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
};

type StripeEventRecord = {
  id: string;
  processingStatus: string;
};

type OrganizationSubscriptionRecord = {
  id: string;
  organizationId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  collectionMethod: string | null;
  defaultPaymentMethodId: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  trialStart: Date | null;
  trialEnd: Date | null;
  canceledAt: Date | null;
  endedAt: Date | null;
  latestInvoiceId: string | null;
  checkoutSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type OrganizationSubscriptionItemRecord = {
  id: string;
  catalogCode: string;
  catalogKind: "addon" | "plan";
  catalogName: string;
  currency: string | null;
  billingType: string | null;
  intervalCount: number | null;
  recurringInterval: string | null;
  stripePriceId: string;
  quantity: number;
  unitAmountCents: bigint | number | null;
  endedAt: Date | null;
};

type RequestedAddonInput = {
  code: string;
  quantity: number;
};

type ValidatedBillingSelection = {
  billingPriceId: string;
  catalogItemId: string;
  code: string;
  kind: "addon" | "plan";
  quantity: number;
  quantityMode: "single" | "stackable";
};

type ActiveOrganizationSubscriptionRecord = {
  id: string;
  stripeSubscriptionId: string;
};

type ActiveOrganizationSubscriptionItemRecord = {
  quantity: number;
  stripeSubscriptionItemId: string;
};

const LIVE_SUBSCRIPTION_STATUSES = ["incomplete", "trialing", "active", "past_due", "unpaid", "paused"] as const;
type LiveSubscriptionStatus = (typeof LIVE_SUBSCRIPTION_STATUSES)[number];

function getStripeClient(): Stripe {
  if (!env.stripeSecretKey) {
    throw new HttpError(500, "Missing STRIPE_SECRET_KEY environment variable.");
  }

  return new Stripe(env.stripeSecretKey);
}

function getStripeWebhookSecret(): string {
  if (!env.stripeWebhookSecret) {
    throw new HttpError(500, "Missing STRIPE_WEBHOOK_SECRET environment variable.");
  }

  return env.stripeWebhookSecret;
}

function coerceNullableString(
  value: string | { id?: string | null } | null | undefined
): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && typeof value.id === "string") {
    return value.id;
  }

  return null;
}

function toDate(value: number | null | undefined): Date | null {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subscription = invoice.parent?.subscription_details?.subscription;

  if (typeof subscription === "string") {
    return subscription;
  }

  if (subscription && typeof subscription === "object") {
    return subscription.id;
  }

  return null;
}

async function ensureOrganizationStripeCustomer(
  organizationId: string,
  authUser: AuthenticatedSupabaseUser
): Promise<{ customerId: string; organizationName: string }> {
  const organization = await prisma.organization.findUnique({
    where: {
      id: organizationId,
    },
    select: {
      id: true,
      name: true,
      legalName: true,
      stripeCustomerId: true,
    },
  });

  if (!organization) {
    throw new HttpError(404, "Organization not found.");
  }

  // Seeded/local customer ids are placeholders and must not be reused for live Stripe operations.
  if (organization.stripeCustomerId && isStripeManagedCustomerId(organization.stripeCustomerId)) {
    return {
      customerId: organization.stripeCustomerId,
      organizationName: organization.name,
    };
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: authUser.email,
    name: organization.legalName ?? organization.name,
    metadata: {
      organizationId,
      ownerUserId: authUser.id,
    },
  });

  await prisma.organization.update({
    where: {
      id: organization.id,
    },
    data: {
      stripeCustomerId: customer.id,
    },
  });

  return {
    customerId: customer.id,
    organizationName: organization.name,
  };
}

async function resolveCheckoutPrice(priceReferenceId: string): Promise<Stripe.Price> {
  const stripe = getStripeClient();

  if (priceReferenceId.startsWith("price_")) {
    return stripe.prices.retrieve(priceReferenceId);
  }

  if (priceReferenceId.startsWith("prod_")) {
    const product = await stripe.products.retrieve(priceReferenceId, {
      expand: ["default_price"],
    });

    if (product.default_price && typeof product.default_price !== "string") {
      return product.default_price;
    }

    if (typeof product.default_price === "string") {
      return stripe.prices.retrieve(product.default_price);
    }
  }

  throw new HttpError(500, `Billing price reference ${priceReferenceId} is not usable for checkout.`);
}

function sanitizeAddonCode(code: string): string {
  return code.trim();
}

function isStripeManagedSubscriptionId(value: string): boolean {
  return value.startsWith("sub_");
}

function isStripeManagedSubscriptionItemId(value: string): boolean {
  return value.startsWith("si_");
}

function isStripeManagedCustomerId(value: string): boolean {
  return value.startsWith("cus_");
}

function isLiveSubscriptionStatus(status: Stripe.Subscription.Status): status is LiveSubscriptionStatus {
  return LIVE_SUBSCRIPTION_STATUSES.includes(status as LiveSubscriptionStatus);
}

function assertStripeManagedSubscription(subscriptionId: string) {
  if (!isStripeManagedSubscriptionId(subscriptionId)) {
    throw new HttpError(
      409,
      "This organization is using a locally seeded subscription. Start a real Stripe checkout before managing subscription add-ons."
    );
  }
}

function assertStripeManagedSubscriptionItem(subscriptionItemId: string) {
  if (!isStripeManagedSubscriptionItemId(subscriptionItemId)) {
    throw new HttpError(
      409,
      "This add-on belongs to a locally seeded subscription item and cannot be changed through Stripe."
    );
  }
}

function assertPositiveInteger(value: number, fieldName: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new HttpError(400, `${fieldName} must be a positive integer.`);
  }
}

async function loadValidatedBillingSelection(
  code: string,
  kind: "addon" | "plan",
  quantity: number
): Promise<ValidatedBillingSelection> {
  const [catalogItem, billingPrice] = await Promise.all([
    getBillingCatalogItemByCode(code),
    getBillingPriceForCatalogCode(code),
  ]);

  if (!catalogItem || catalogItem.kind !== kind) {
    throw new HttpError(400, `${code} is not a valid ${kind}.`);
  }

  if (!billingPrice) {
    throw new HttpError(404, `Billing price not found for ${code}.`);
  }

  const quantityMode = getBillingQuantityModeByCode(code);

  if (!quantityMode) {
    throw new HttpError(500, `Billing quantity mode is not configured for ${code}.`);
  }

  if (quantityMode === "single" && quantity !== 1) {
    throw new HttpError(400, `${code} only supports quantity 1.`);
  }

  return {
    code,
    kind,
    quantity,
    quantityMode,
    catalogItemId: catalogItem.id,
    billingPriceId: billingPrice.stripePriceId,
  };
}

async function validateAddonSelections(addons: RequestedAddonInput[]): Promise<ValidatedBillingSelection[]> {
  const seenCodes = new Set<string>();
  const normalizedAddons: RequestedAddonInput[] = [];

  for (const addon of addons) {
    const code = sanitizeAddonCode(addon.code);

    if (!code) {
      throw new HttpError(400, "Addon code is required.");
    }

    if (seenCodes.has(code)) {
      throw new HttpError(400, `Duplicate addon code ${code} is not allowed.`);
    }

    assertPositiveInteger(addon.quantity, `Addon quantity for ${code}`);
    seenCodes.add(code);
    normalizedAddons.push({ code, quantity: addon.quantity });
  }

  return Promise.all(normalizedAddons.map((addon) => loadValidatedBillingSelection(addon.code, "addon", addon.quantity)));
}

async function getActiveOrganizationSubscription(organizationId: string): Promise<ActiveOrganizationSubscriptionRecord> {
  const rows = await prisma.$queryRawUnsafe<ActiveOrganizationSubscriptionRecord[]>(
    `
      SELECT
        "id",
        "stripe_subscription_id" AS "stripeSubscriptionId"
      FROM "organization_subscriptions"
      WHERE "organization_id" = CAST($1 AS UUID)
        AND "ended_at" IS NULL
        AND "status" IN ('trialing', 'active', 'past_due', 'unpaid', 'paused')
      ORDER BY "updated_at" DESC
      LIMIT 1
    `,
    organizationId
  );

  const subscription = rows[0] ?? null;

  if (!subscription) {
    throw new HttpError(409, "Organization does not have an active paid subscription.");
  }

  return subscription;
}

async function getActiveOrganizationAddonSubscriptionItem(
  organizationId: string,
  code: string
): Promise<ActiveOrganizationSubscriptionItemRecord | null> {
  const rows = await prisma.$queryRawUnsafe<ActiveOrganizationSubscriptionItemRecord[]>(
    `
      SELECT
        organization_subscription_items."stripe_subscription_item_id" AS "stripeSubscriptionItemId",
        organization_subscription_items."quantity"
      FROM "organization_subscription_items"
      INNER JOIN "organization_subscriptions"
        ON "organization_subscriptions"."id" = "organization_subscription_items"."organization_subscription_id"
      INNER JOIN "billing_catalog_items"
        ON "billing_catalog_items"."id" = "organization_subscription_items"."catalog_item_id"
      WHERE "organization_subscriptions"."organization_id" = CAST($1 AS UUID)
        AND "organization_subscriptions"."ended_at" IS NULL
        AND "organization_subscriptions"."status" IN ('trialing', 'active', 'past_due', 'unpaid', 'paused')
        AND "organization_subscription_items"."ended_at" IS NULL
        AND "billing_catalog_items"."kind" = 'addon'
        AND "billing_catalog_items"."code" = $2
      ORDER BY "organization_subscription_items"."created_at" DESC
      LIMIT 1
    `,
    organizationId,
    code
  );

  return rows[0] ?? null;
}

function toBillingCatalogResponseItem(item: BillingCatalogSummary) {
  return {
    code: item.code,
    kind: item.kind,
    name: item.name,
    description: item.description,
    stripeProductId: item.stripeProductId,
    stripePriceId: item.stripePriceId,
    unitAmountCents: item.unitAmountCents,
    currency: item.currency,
    billingType: item.billingType,
    recurringInterval: item.recurringInterval,
    intervalCount: item.intervalCount,
    quantityMode: item.quantityMode,
    entitlements: item.entitlements,
  };
}

function toBillingSubscriptionItemResponse(item: OrganizationSubscriptionItemRecord) {
  return {
    id: item.id,
    catalogCode: item.catalogCode,
    catalogKind: item.catalogKind,
    catalogName: item.catalogName,
    stripePriceId: item.stripePriceId,
    quantity: item.quantity,
    unitAmountCents: typeof item.unitAmountCents === "bigint" ? Number(item.unitAmountCents) : item.unitAmountCents,
    currency: item.currency,
    billingType: item.billingType,
    recurringInterval: item.recurringInterval,
    intervalCount: item.intervalCount,
    endedAt: item.endedAt?.toISOString() ?? null,
  };
}

export async function createEmbeddedCheckoutSession(
  planCode: string,
  organizationId: string,
  authUser: AuthenticatedSupabaseUser,
  requestedAddons: RequestedAddonInput[] = []
) {
  const planSelection = await loadValidatedBillingSelection(planCode, "plan", 1);
  const addonSelections = await validateAddonSelections(requestedAddons);

  const { customerId } = await ensureOrganizationStripeCustomer(organizationId, authUser);
  const stripe = getStripeClient();
  const checkoutItems = await Promise.all([
    resolveCheckoutPrice(planSelection.billingPriceId).then((price) => ({
      priceId: price.id,
      quantity: 1,
    })),
    ...addonSelections.map((addon) =>
      resolveCheckoutPrice(addon.billingPriceId).then((price) => ({
        priceId: price.id,
        quantity: addon.quantity,
      }))
    ),
  ]);

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    mode: "subscription",
    customer: customerId,
    client_reference_id: organizationId,
    metadata: {
      organizationId,
      planCode,
      addonCodes: JSON.stringify(addonSelections.map((addon) => ({ code: addon.code, quantity: addon.quantity }))),
      requestedByUserId: authUser.id,
      requestedByEmail: authUser.email,
    },
    subscription_data: {
      metadata: {
        organizationId,
        planCode,
        addonCodes: JSON.stringify(addonSelections.map((addon) => ({ code: addon.code, quantity: addon.quantity }))),
      },
    },
    line_items: checkoutItems.map((item) => ({
      price: item.priceId,
      quantity: item.quantity,
    })),
    return_url: `${env.appDomain}/quick-dash?checkout=success&organization=${organizationId}&session_id={CHECKOUT_SESSION_ID}`,
  });

  if (!session.client_secret) {
    throw new HttpError(500, "Stripe checkout session did not return a client secret.");
  }

  return {
    clientSecret: session.client_secret,
    sessionId: session.id,
  };
}

async function insertStripeEvent(event: Stripe.Event, db: RawDbClient = prisma): Promise<StripeEventRecord | null> {
  const rows = await db.$queryRawUnsafe<StripeEventRecord[]>(
    `
      INSERT INTO "stripe_webhook_events" (
        "id",
        "stripe_event_id",
        "event_type",
        "api_version",
        "payload",
        "received_at",
        "processing_status"
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        CAST($4 AS JSONB),
        CURRENT_TIMESTAMP,
        'pending'
      )
      ON CONFLICT ("stripe_event_id") DO NOTHING
      RETURNING "id", "processing_status" AS "processingStatus"
    `,
    event.id,
    event.type,
    event.api_version ?? null,
    JSON.stringify(event)
  );

  return rows[0] ?? null;
}

async function markStripeEventStatus(
  stripeEventId: string,
  status: "failed" | "ignored" | "processed",
  errorMessage?: string | null,
  db: RawDbClient = prisma
) {
  await db.$executeRawUnsafe(
    `
      UPDATE "stripe_webhook_events"
      SET
        "processing_status" = $2,
        "processed_at" = CASE WHEN $2 IN ('processed', 'ignored') THEN CURRENT_TIMESTAMP ELSE "processed_at" END,
        "error_message" = $3
      WHERE "stripe_event_id" = $1
    `,
    stripeEventId,
    status,
    errorMessage ?? null
  );
}

async function resolveOrganizationIdByCustomerId(customerId: string | null): Promise<string | null> {
  if (!customerId) {
    return null;
  }

  const organization = await prisma.organization.findFirst({
    where: {
      stripeCustomerId: customerId,
    },
    select: {
      id: true,
    },
  });

  return organization?.id ?? null;
}

async function findCatalogItemIdForStripePrice(price: Stripe.Price, db: RawDbClient = prisma): Promise<string> {
  const priceId = price.id;
  const productId = typeof price.product === "string" ? price.product : price.product.id;

  const rows = await db.$queryRawUnsafe<Array<{ catalogItemId: string }>>(
    `
      SELECT DISTINCT
        "billing_catalog_items"."id" AS "catalogItemId"
      FROM "billing_catalog_items"
      LEFT JOIN "billing_prices"
        ON "billing_prices"."catalog_item_id" = "billing_catalog_items"."id"
      WHERE "billing_prices"."stripe_price_id" = $1
         OR "billing_catalog_items"."stripe_product_id" = $2
      LIMIT 1
    `,
    priceId,
    productId
  );

  const row = rows[0];

  if (!row?.catalogItemId) {
    throw new HttpError(500, `No billing catalog mapping found for Stripe price ${priceId}.`);
  }

  return row.catalogItemId;
}

async function retireConflictingActiveSubscriptions(
  organizationId: string,
  stripeSubscriptionId: string,
  db: RawDbClient = prisma
) {
  await db.$executeRawUnsafe(
    `
      UPDATE "organization_subscription_items"
      SET "ended_at" = CURRENT_TIMESTAMP
      WHERE "organization_subscription_id" IN (
        SELECT "id"
        FROM "organization_subscriptions"
        WHERE "organization_id" = CAST($1 AS UUID)
          AND "stripe_subscription_id" <> $2
          AND "status" IN ('incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'paused')
          AND "ended_at" IS NULL
      )
        AND "ended_at" IS NULL
    `,
    organizationId,
    stripeSubscriptionId
  );

  await db.$executeRawUnsafe(
    `
      UPDATE "organization_subscriptions"
      SET
        "ended_at" = CURRENT_TIMESTAMP,
        "updated_at" = CURRENT_TIMESTAMP
      WHERE "organization_id" = CAST($1 AS UUID)
        AND "stripe_subscription_id" <> $2
        AND "status" IN ('incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'paused')
        AND "ended_at" IS NULL
    `,
    organizationId,
    stripeSubscriptionId
  );
}

async function upsertOrganizationSubscription(
  organizationId: string,
  stripeSubscription: Stripe.Subscription,
  checkoutSessionId?: string | null,
  db: RawDbClient = prisma
): Promise<string> {
  const customerId = typeof stripeSubscription.customer === "string" ? stripeSubscription.customer : stripeSubscription.customer.id;

  await retireConflictingActiveSubscriptions(organizationId, stripeSubscription.id, db);

  await db.$executeRawUnsafe(
    `
      UPDATE "organizations"
      SET
        "stripe_customer_id" = $2,
        "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = CAST($1 AS UUID)
    `,
    organizationId,
    customerId
  );

  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `
      INSERT INTO "organization_subscriptions" (
        "id",
        "organization_id",
        "stripe_customer_id",
        "stripe_subscription_id",
        "status",
        "collection_method",
        "default_payment_method_id",
        "cancel_at_period_end",
        "current_period_start",
        "current_period_end",
        "trial_start",
        "trial_end",
        "canceled_at",
        "ended_at",
        "latest_invoice_id",
        "checkout_session_id",
        "created_at",
        "updated_at"
      )
      VALUES (
        gen_random_uuid(),
        CAST($1 AS UUID),
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("stripe_subscription_id") DO UPDATE
      SET
        "organization_id" = EXCLUDED."organization_id",
        "stripe_customer_id" = EXCLUDED."stripe_customer_id",
        "status" = EXCLUDED."status",
        "collection_method" = EXCLUDED."collection_method",
        "default_payment_method_id" = EXCLUDED."default_payment_method_id",
        "cancel_at_period_end" = EXCLUDED."cancel_at_period_end",
        "current_period_start" = EXCLUDED."current_period_start",
        "current_period_end" = EXCLUDED."current_period_end",
        "trial_start" = EXCLUDED."trial_start",
        "trial_end" = EXCLUDED."trial_end",
        "canceled_at" = EXCLUDED."canceled_at",
        "ended_at" = EXCLUDED."ended_at",
        "latest_invoice_id" = EXCLUDED."latest_invoice_id",
        "checkout_session_id" = COALESCE(EXCLUDED."checkout_session_id", "organization_subscriptions"."checkout_session_id"),
        "updated_at" = CURRENT_TIMESTAMP
      RETURNING "id"
    `,
    organizationId,
    customerId,
    stripeSubscription.id,
    stripeSubscription.status,
    stripeSubscription.collection_method ?? null,
    coerceNullableString(stripeSubscription.default_payment_method as Stripe.PaymentMethod | string | null | undefined),
    stripeSubscription.cancel_at_period_end,
    null,
    null,
    toDate(stripeSubscription.trial_start),
    toDate(stripeSubscription.trial_end),
    toDate(stripeSubscription.canceled_at),
    stripeSubscription.ended_at ? toDate(stripeSubscription.ended_at) : null,
    coerceNullableString(stripeSubscription.latest_invoice as Stripe.Invoice | string | null | undefined),
    checkoutSessionId ?? null
  );

  const row = rows[0];

  if (!row?.id) {
    throw new HttpError(500, `Unable to upsert local subscription snapshot for ${stripeSubscription.id}.`);
  }

  return row.id;
}

async function syncOrganizationSubscriptionItems(
  organizationSubscriptionId: string,
  stripeSubscription: Stripe.Subscription,
  db: RawDbClient = prisma
) {
  const activeStripeItemIds: string[] = [];

  for (const item of stripeSubscription.items.data) {
    activeStripeItemIds.push(item.id);

    const catalogItemId = await findCatalogItemIdForStripePrice(item.price, db);

    await db.$executeRawUnsafe(
      `
        INSERT INTO "organization_subscription_items" (
          "id",
          "organization_subscription_id",
          "catalog_item_id",
          "stripe_subscription_item_id",
          "stripe_price_id",
          "quantity",
          "metadata",
          "created_at",
          "ended_at"
        )
        VALUES (
          gen_random_uuid(),
          CAST($1 AS UUID),
          CAST($2 AS UUID),
          $3,
          $4,
          $5,
          CAST($6 AS JSONB),
          CURRENT_TIMESTAMP,
          NULL
        )
        ON CONFLICT ("stripe_subscription_item_id") DO UPDATE
        SET
          "organization_subscription_id" = EXCLUDED."organization_subscription_id",
          "catalog_item_id" = EXCLUDED."catalog_item_id",
          "stripe_price_id" = EXCLUDED."stripe_price_id",
          "quantity" = EXCLUDED."quantity",
          "metadata" = EXCLUDED."metadata",
          "ended_at" = NULL
      `,
      organizationSubscriptionId,
      catalogItemId,
      item.id,
      item.price.id,
      item.quantity ?? 1,
      JSON.stringify(item.metadata ?? {})
    );
  }

  await db.$executeRawUnsafe(
    `
      UPDATE "organization_subscription_items"
      SET "ended_at" = CURRENT_TIMESTAMP
      WHERE "organization_subscription_id" = CAST($1 AS UUID)
        AND (
          CASE
            WHEN cardinality($2::text[]) = 0 THEN true
            ELSE NOT ("stripe_subscription_item_id" = ANY($2::text[]))
          END
        )
        AND "ended_at" IS NULL
    `,
    organizationSubscriptionId,
    activeStripeItemIds
  );
}

async function syncStripeSubscriptionToDatabase(
  organizationId: string,
  stripeSubscriptionId: string,
  checkoutSessionId?: string | null
) {
  if (!isStripeManagedSubscriptionId(stripeSubscriptionId)) {
    return;
  }

  const stripe = getStripeClient();
  const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ["items.data.price.product", "default_payment_method", "latest_invoice"],
  });

  await prisma.$transaction(async (tx) => {
    const organizationSubscriptionId = await upsertOrganizationSubscription(
      organizationId,
      stripeSubscription,
      checkoutSessionId ?? null,
      tx
    );
    await syncOrganizationSubscriptionItems(organizationSubscriptionId, stripeSubscription, tx);
    await syncOrganizationEntitlementsFromSubscription(organizationId, stripeSubscription.status, tx);
  });
}

export async function ensureOrganizationBillingState(organizationId: string): Promise<void> {
  const activeSubscriptions = await prisma.$queryRawUnsafe<Array<{ stripeSubscriptionId: string }>>(
    `
      SELECT "stripe_subscription_id" AS "stripeSubscriptionId"
      FROM "organization_subscriptions"
      WHERE "organization_id" = CAST($1 AS UUID)
        AND "ended_at" IS NULL
        AND "status" IN ('incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'paused')
      ORDER BY "updated_at" DESC
      LIMIT 1
    `,
    organizationId
  );
  const activeSubscriptionId = activeSubscriptions[0]?.stripeSubscriptionId ?? null;

  if (activeSubscriptionId && isStripeManagedSubscriptionId(activeSubscriptionId)) {
    return;
  }

  const organization = await prisma.organization.findUnique({
    where: {
      id: organizationId,
    },
    select: {
      stripeCustomerId: true,
    },
  });
  const stripeCustomerId = organization?.stripeCustomerId ?? null;

  if (!stripeCustomerId || !isStripeManagedCustomerId(stripeCustomerId)) {
    return;
  }

  const stripe = getStripeClient();
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 10,
  });
  const liveSubscription = subscriptions.data.find((subscription) => {
    if (!isLiveSubscriptionStatus(subscription.status)) {
      return false;
    }

    return typeof subscription.metadata.organizationId !== "string" || subscription.metadata.organizationId === organizationId;
  });

  if (!liveSubscription) {
    return;
  }

  await syncStripeSubscriptionToDatabase(organizationId, liveSubscription.id);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const organizationId =
    typeof session.metadata?.organizationId === "string"
      ? session.metadata.organizationId
      : typeof session.client_reference_id === "string"
        ? session.client_reference_id
        : null;

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

  if (!organizationId) {
    throw new HttpError(400, "Stripe checkout session is missing organizationId metadata.");
  }

  if (customerId) {
    await prisma.organization.update({
      where: {
        id: organizationId,
      },
      data: {
        stripeCustomerId: customerId,
      },
    });
  }

  if (typeof session.subscription === "string") {
    await syncStripeSubscriptionToDatabase(organizationId, session.subscription, session.id);
  }
}

export async function syncCheckoutSessionToDatabase(sessionId: string, expectedOrganizationId?: string | null) {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });
  const organizationId =
    typeof session.metadata?.organizationId === "string"
      ? session.metadata.organizationId
      : typeof session.client_reference_id === "string"
        ? session.client_reference_id
        : null;

  if (!organizationId) {
    throw new HttpError(400, "Stripe checkout session is missing organizationId metadata.");
  }

  if (expectedOrganizationId && expectedOrganizationId !== organizationId) {
    throw new HttpError(403, "Stripe checkout session does not belong to that organization.");
  }

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

  if (customerId) {
    await prisma.organization.update({
      where: {
        id: organizationId,
      },
      data: {
        stripeCustomerId: customerId,
      },
    });
  }

  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;

  if (!subscriptionId) {
    throw new HttpError(409, "Stripe checkout session does not have a subscription to sync yet.");
  }

  await syncStripeSubscriptionToDatabase(organizationId, subscriptionId, session.id);
  return getOrganizationBillingSummary(organizationId);
}

async function handleSubscriptionEvent(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const organizationId =
    typeof subscription.metadata.organizationId === "string"
      ? subscription.metadata.organizationId
      : await resolveOrganizationIdByCustomerId(customerId);

  if (!organizationId) {
    throw new HttpError(404, `Unable to resolve organization for Stripe customer ${customerId}.`);
  }

  await syncStripeSubscriptionToDatabase(organizationId, subscription.id);
}

async function handleInvoiceEvent(invoice: Stripe.Invoice) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);

  if (!subscriptionId) {
    return;
  }

  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
  const organizationId = await resolveOrganizationIdByCustomerId(customerId);

  if (!organizationId) {
    return;
  }

  await syncStripeSubscriptionToDatabase(organizationId, subscriptionId);
}

export async function addOrganizationSubscriptionAddon(
  organizationId: string,
  code: string,
  quantity: number
) {
  assertPositiveInteger(quantity, "quantity");

  const addonSelection = await loadValidatedBillingSelection(code, "addon", quantity);
  const subscription = await getActiveOrganizationSubscription(organizationId);
  assertStripeManagedSubscription(subscription.stripeSubscriptionId);
  const existingItem = await getActiveOrganizationAddonSubscriptionItem(organizationId, addonSelection.code);
  const stripe = getStripeClient();

  if (existingItem) {
    assertStripeManagedSubscriptionItem(existingItem.stripeSubscriptionItemId);
    await stripe.subscriptionItems.update(existingItem.stripeSubscriptionItemId, {
      quantity: existingItem.quantity + addonSelection.quantity,
      proration_behavior: "create_prorations",
    });
  } else {
    const stripePrice = await resolveCheckoutPrice(addonSelection.billingPriceId);

    await stripe.subscriptionItems.create({
      subscription: subscription.stripeSubscriptionId,
      price: stripePrice.id,
      quantity: addonSelection.quantity,
      proration_behavior: "create_prorations",
    });
  }

  await syncStripeSubscriptionToDatabase(organizationId, subscription.stripeSubscriptionId);
  return getOrganizationBillingSummary(organizationId);
}

export async function updateOrganizationSubscriptionAddonQuantity(
  organizationId: string,
  code: string,
  quantity: number
) {
  assertPositiveInteger(quantity, "quantity");

  const addonSelection = await loadValidatedBillingSelection(code, "addon", quantity);
  const subscription = await getActiveOrganizationSubscription(organizationId);
  assertStripeManagedSubscription(subscription.stripeSubscriptionId);
  const existingItem = await getActiveOrganizationAddonSubscriptionItem(organizationId, addonSelection.code);

  if (!existingItem) {
    throw new HttpError(404, `Addon ${addonSelection.code} is not active on this subscription.`);
  }

  assertStripeManagedSubscriptionItem(existingItem.stripeSubscriptionItemId);
  const stripe = getStripeClient();

  await stripe.subscriptionItems.update(existingItem.stripeSubscriptionItemId, {
    quantity: addonSelection.quantity,
    proration_behavior: "create_prorations",
  });

  await syncStripeSubscriptionToDatabase(organizationId, subscription.stripeSubscriptionId);
  return getOrganizationBillingSummary(organizationId);
}

export async function removeOrganizationSubscriptionAddon(organizationId: string, code: string) {
  await loadValidatedBillingSelection(code, "addon", 1);

  const subscription = await getActiveOrganizationSubscription(organizationId);
  assertStripeManagedSubscription(subscription.stripeSubscriptionId);
  const existingItem = await getActiveOrganizationAddonSubscriptionItem(organizationId, code);

  if (!existingItem) {
    throw new HttpError(404, `Addon ${code} is not active on this subscription.`);
  }

  assertStripeManagedSubscriptionItem(existingItem.stripeSubscriptionItemId);
  const stripe = getStripeClient();

  await stripe.subscriptionItems.del(existingItem.stripeSubscriptionItemId, {
    proration_behavior: "create_prorations",
  });

  await syncStripeSubscriptionToDatabase(organizationId, subscription.stripeSubscriptionId);
  return getOrganizationBillingSummary(organizationId);
}

export async function processStripeWebhook(body: Buffer, signature: string | string[] | undefined) {
  const stripe = getStripeClient();
  const header = Array.isArray(signature) ? signature[0] : signature;

  if (!header) {
    throw new HttpError(400, "Missing Stripe-Signature header.");
  }

  const event = stripe.webhooks.constructEvent(body, header, getStripeWebhookSecret());
  const insertedEvent = await insertStripeEvent(event);

  if (!insertedEvent) {
    return {
      duplicate: true,
      eventId: event.id,
      received: true,
    };
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        await markStripeEventStatus(event.id, "processed");
        return { duplicate: false, eventId: event.id, received: true };
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
        await markStripeEventStatus(event.id, "processed");
        return { duplicate: false, eventId: event.id, received: true };
      case "invoice.paid":
      case "invoice.payment_failed":
        await handleInvoiceEvent(event.data.object as Stripe.Invoice);
        await markStripeEventStatus(event.id, "processed");
        return { duplicate: false, eventId: event.id, received: true };
      default:
        await markStripeEventStatus(event.id, "ignored");
        return { duplicate: false, eventId: event.id, received: true };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown Stripe webhook processing error.";
    await markStripeEventStatus(event.id, "failed", errorMessage);
    throw error;
  }
}

export async function getOrganizationBillingSummary(organizationId: string) {
  await ensureOrganizationBillingState(organizationId);

  const [subscriptionRows, itemRows, entitlementRows, plans, availableAddons] = await Promise.all([
    prisma.$queryRawUnsafe<OrganizationSubscriptionRecord[]>(
      `
        SELECT
          "id",
          "organization_id" AS "organizationId",
          "stripe_customer_id" AS "stripeCustomerId",
          "stripe_subscription_id" AS "stripeSubscriptionId",
          "status",
          "collection_method" AS "collectionMethod",
          "default_payment_method_id" AS "defaultPaymentMethodId",
          "cancel_at_period_end" AS "cancelAtPeriodEnd",
          "current_period_start" AS "currentPeriodStart",
          "current_period_end" AS "currentPeriodEnd",
          "trial_start" AS "trialStart",
          "trial_end" AS "trialEnd",
          "canceled_at" AS "canceledAt",
          "ended_at" AS "endedAt",
          "latest_invoice_id" AS "latestInvoiceId",
          "checkout_session_id" AS "checkoutSessionId",
          "created_at" AS "createdAt",
          "updated_at" AS "updatedAt"
        FROM "organization_subscriptions"
        WHERE "organization_id" = CAST($1 AS UUID)
        ORDER BY "updated_at" DESC
        LIMIT 1
      `,
      organizationId
    ),
    prisma.$queryRawUnsafe<OrganizationSubscriptionItemRecord[]>(
      `
        SELECT
          organization_subscription_items."id",
          billing_catalog_items."code" AS "catalogCode",
          billing_catalog_items."kind" AS "catalogKind",
          billing_catalog_items."name" AS "catalogName",
          organization_subscription_items."stripe_price_id" AS "stripePriceId",
          organization_subscription_items."quantity",
          organization_subscription_items."ended_at" AS "endedAt",
          billing_prices."unit_amount_cents" AS "unitAmountCents",
          billing_prices."currency",
          billing_prices."billing_type" AS "billingType",
          billing_prices."recurring_interval" AS "recurringInterval",
          billing_prices."interval_count" AS "intervalCount"
        FROM "organization_subscription_items"
        INNER JOIN "organization_subscriptions"
          ON "organization_subscriptions"."id" = "organization_subscription_items"."organization_subscription_id"
        INNER JOIN "billing_catalog_items"
          ON "billing_catalog_items"."id" = "organization_subscription_items"."catalog_item_id"
        LEFT JOIN "billing_prices"
          ON "billing_prices"."stripe_price_id" = "organization_subscription_items"."stripe_price_id"
        WHERE "organization_subscriptions"."organization_id" = CAST($1 AS UUID)
        ORDER BY organization_subscription_items."created_at" ASC
      `,
      organizationId
    ),
    getOrganizationEntitlementsSnapshot(organizationId),
    listBillingPlans(),
    listBillingAddons(),
  ]);

  const subscription = subscriptionRows[0] ?? null;
  const activeItemRows = itemRows.filter((item) => item.endedAt === null);
  const currentPlanItem = activeItemRows.find((item) => item.catalogKind === "plan") ?? null;
  const currentAddonItems = activeItemRows.filter((item) => item.catalogKind === "addon");
  const monthlySubtotalCents = activeItemRows.reduce((sum, item) => {
    const unitAmountCents = typeof item.unitAmountCents === "bigint" ? Number(item.unitAmountCents) : item.unitAmountCents ?? 0;
    return sum + unitAmountCents * item.quantity;
  }, 0);

  return {
    organizationId,
    plans: plans.map(toBillingCatalogResponseItem),
    availableAddons: availableAddons.map(toBillingCatalogResponseItem),
    subscription: subscription
      ? {
          ...subscription,
          currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
          trialStart: subscription.trialStart?.toISOString() ?? null,
          trialEnd: subscription.trialEnd?.toISOString() ?? null,
          canceledAt: subscription.canceledAt?.toISOString() ?? null,
          endedAt: subscription.endedAt?.toISOString() ?? null,
          createdAt: subscription.createdAt.toISOString(),
          updatedAt: subscription.updatedAt.toISOString(),
          monthlySubtotalCents,
          plan: currentPlanItem ? toBillingSubscriptionItemResponse(currentPlanItem) : null,
          addons: currentAddonItems.map(toBillingSubscriptionItemResponse),
        }
      : null,
    items: itemRows.map(toBillingSubscriptionItemResponse),
    entitlements: entitlementRows,
  };
}
