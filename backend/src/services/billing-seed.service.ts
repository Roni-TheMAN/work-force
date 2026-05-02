import { prisma } from "../lib/prisma";
import { ensureBillingCatalogSeeded, getBillingCatalogItemByCode, getBillingPriceForCatalogCode } from "./billing-catalog.service";
import {
  seedFreePlanEntitlementsForOrganization,
  syncOrganizationEntitlementsFromSubscription,
} from "./billing-entitlements.service";

type RawDbClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
};

function sanitizeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

export async function seedBillingCatalog(db: RawDbClient = prisma): Promise<void> {
  await ensureBillingCatalogSeeded(db);
}

export async function seedOrganizationBillingSubscription(
  organizationId: string,
  planCode: "enterprise" | "free" | "pro",
  db: RawDbClient = prisma
): Promise<void> {
  if (planCode === "free") {
    await seedFreePlanEntitlementsForOrganization(organizationId, db);
    return;
  }

  const [catalogItem, billingPrice] = await Promise.all([
    getBillingCatalogItemByCode(planCode, db),
    getBillingPriceForCatalogCode(planCode, db),
  ]);

  if (!catalogItem || !billingPrice) {
    throw new Error(`Billing catalog for plan ${planCode} is not configured.`);
  }

  const suffix = sanitizeIdPart(organizationId);
  const stripeCustomerId = `seed_cus_${suffix}`;
  const stripeSubscriptionId = `seed_sub_${planCode}_${suffix}`;
  const stripeSubscriptionItemId = `seed_si_${planCode}_${suffix}`;

  await db.$executeRawUnsafe(
    `
      UPDATE "organizations"
      SET
        "stripe_customer_id" = $2,
        "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = CAST($1 AS UUID)
    `,
    organizationId,
    stripeCustomerId
  );

  await db.$executeRawUnsafe(
    `
      INSERT INTO "organization_subscriptions" (
        "id",
        "organization_id",
        "stripe_customer_id",
        "stripe_subscription_id",
        "status",
        "collection_method",
        "cancel_at_period_end",
        "current_period_start",
        "current_period_end",
        "created_at",
        "updated_at"
      )
      VALUES (
        gen_random_uuid(),
        CAST($1 AS UUID),
        $2,
        $3,
        'active',
        'charge_automatically',
        false,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP + INTERVAL '1 month',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("stripe_subscription_id") DO UPDATE
      SET
        "organization_id" = EXCLUDED."organization_id",
        "stripe_customer_id" = EXCLUDED."stripe_customer_id",
        "status" = 'active',
        "collection_method" = EXCLUDED."collection_method",
        "cancel_at_period_end" = false,
        "current_period_start" = CURRENT_TIMESTAMP,
        "current_period_end" = CURRENT_TIMESTAMP + INTERVAL '1 month',
        "ended_at" = NULL,
        "updated_at" = CURRENT_TIMESTAMP
    `,
    organizationId,
    stripeCustomerId,
    stripeSubscriptionId
  );

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
      SELECT
        gen_random_uuid(),
        "organization_subscriptions"."id",
        CAST($2 AS UUID),
        $3,
        $4,
        1,
        '{}'::jsonb,
        CURRENT_TIMESTAMP,
        NULL
      FROM "organization_subscriptions"
      WHERE "stripe_subscription_id" = $1
      ON CONFLICT ("stripe_subscription_item_id") DO UPDATE
      SET
        "organization_subscription_id" = EXCLUDED."organization_subscription_id",
        "catalog_item_id" = EXCLUDED."catalog_item_id",
        "stripe_price_id" = EXCLUDED."stripe_price_id",
        "quantity" = 1,
        "metadata" = '{}'::jsonb,
        "ended_at" = NULL
    `,
    stripeSubscriptionId,
    catalogItem.id,
    stripeSubscriptionItemId,
    billingPrice.stripePriceId
  );

  await syncOrganizationEntitlementsFromSubscription(organizationId, "active", db);
}
