import { prisma } from "../lib/prisma";
import {
  getBillingCatalogItemByCode,
  getBillingEntitlementFixturesByCode,
  type BillingCatalogKind,
} from "./billing-catalog.service";

type RawDbClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
};

type EntitlementValue = boolean | number | string | Record<string, unknown>;

type OrganizationSubscriptionItemEntitlementRow = {
  catalogCode: string;
  catalogItemId: string;
  catalogKind: BillingCatalogKind;
  quantity: number;
  sourceSubscriptionItemId: string;
};

type OrganizationEntitlementRow = {
  id: string;
  organizationId: string;
  sourceCatalogItemId: string | null;
  sourceSubscriptionItemId: string | null;
  key: string;
  value: unknown;
  grantedBy: string;
  createdAt: Date;
  updatedAt: Date;
};

type AggregatedEntitlement = {
  grantedBy: "addon" | "manual" | "plan";
  key: string;
  sourceCatalogItemId: string | null;
  sourceSubscriptionItemId: string | null;
  value: EntitlementValue;
};

export type OrganizationEntitlementMap = Record<string, EntitlementValue>;

const SUBSCRIPTION_GRANTED_BY = ["plan", "addon"] as const;
const SUBSCRIPTION_ENTITLEMENT_STATUSES = new Set(["trialing", "active", "past_due", "unpaid", "paused"]);
const ENTITLEMENT_MERGE_RULES: Record<string, "any_true" | "sum"> = {
  advanced_scheduling: "any_true",
  analytics: "any_true",
  api_access: "any_true",
  max_employees: "sum",
  max_properties: "sum",
  sms_notifications: "any_true",
  time_clock: "any_true",
};

function normalizeEntitlementValue(value: EntitlementValue): EntitlementValue {
  if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }

  return { ...value };
}

function scaleEntitlementValue(value: EntitlementValue, quantity: number): EntitlementValue {
  if (typeof value === "number") {
    return value * quantity;
  }

  return normalizeEntitlementValue(value);
}

function mergeEntitlementValue(key: string, currentValue: EntitlementValue | undefined, nextValue: EntitlementValue): EntitlementValue {
  if (currentValue === undefined) {
    return normalizeEntitlementValue(nextValue);
  }

  const mergeRule = ENTITLEMENT_MERGE_RULES[key];

  if (mergeRule === "any_true" && typeof currentValue === "boolean" && typeof nextValue === "boolean") {
    return currentValue || nextValue;
  }

  if (mergeRule === "sum" && typeof currentValue === "number" && typeof nextValue === "number") {
    return currentValue + nextValue;
  }

  if (
    currentValue &&
    typeof currentValue === "object" &&
    !Array.isArray(currentValue) &&
    nextValue &&
    typeof nextValue === "object" &&
    !Array.isArray(nextValue)
  ) {
    return {
      ...currentValue,
      ...nextValue,
    };
  }

  return normalizeEntitlementValue(nextValue);
}

function toJson(value: EntitlementValue): string {
  return JSON.stringify(value);
}

async function replaceGrantedEntitlements(
  db: RawDbClient,
  organizationId: string,
  grantedByValues: readonly string[],
  entitlements: AggregatedEntitlement[]
) {
  if (grantedByValues.length === 2 && grantedByValues.includes("plan") && grantedByValues.includes("addon")) {
    await db.$executeRawUnsafe(
      `
        DELETE FROM "organization_entitlements"
        WHERE "organization_id" = CAST($1 AS UUID)
          AND "granted_by" IN ('plan', 'addon')
      `,
      organizationId
    );
  } else {
    await db.$executeRawUnsafe(
      `
        DELETE FROM "organization_entitlements"
        WHERE "organization_id" = CAST($1 AS UUID)
          AND "granted_by" = ANY($2::text[])
      `,
      organizationId,
      grantedByValues
    );
  }

  for (const entitlement of entitlements) {
    await db.$executeRawUnsafe(
      `
        INSERT INTO "organization_entitlements" (
          "id",
          "organization_id",
          "source_catalog_item_id",
          "source_subscription_item_id",
          "key",
          "value",
          "granted_by",
          "created_at",
          "updated_at"
        )
        VALUES (
          gen_random_uuid(),
          CAST($1 AS UUID),
          CAST($2 AS UUID),
          CAST($3 AS UUID),
          $4,
          CAST($5 AS JSONB),
          $6,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT ("organization_id", "key") DO UPDATE
        SET
          "source_catalog_item_id" = EXCLUDED."source_catalog_item_id",
          "source_subscription_item_id" = EXCLUDED."source_subscription_item_id",
          "value" = EXCLUDED."value",
          "granted_by" = EXCLUDED."granted_by",
          "updated_at" = CURRENT_TIMESTAMP
      `,
      organizationId,
      entitlement.sourceCatalogItemId,
      entitlement.sourceSubscriptionItemId,
      entitlement.key,
      toJson(entitlement.value),
      entitlement.grantedBy
    );
  }
}

export async function seedFreePlanEntitlementsForOrganization(organizationId: string, db: RawDbClient = prisma) {
  const freeCatalogItem = await getBillingCatalogItemByCode("free", db);

  if (!freeCatalogItem) {
    throw new Error("Free billing catalog item is missing.");
  }

  const entitlements: AggregatedEntitlement[] = getBillingEntitlementFixturesByCode("free").map((entitlement) => ({
    key: entitlement.key,
    value: entitlement.value,
    grantedBy: "plan",
    sourceCatalogItemId: freeCatalogItem.id,
    sourceSubscriptionItemId: null,
  }));

  await replaceGrantedEntitlements(db, organizationId, SUBSCRIPTION_GRANTED_BY, entitlements);
}

function buildAggregatedEntitlements(
  subscriptionItems: OrganizationSubscriptionItemEntitlementRow[]
): AggregatedEntitlement[] {
  const entitlementMap = new Map<string, AggregatedEntitlement>();

  for (const item of subscriptionItems) {
    const fixtures = getBillingEntitlementFixturesByCode(item.catalogCode);
    const grantedBy = item.catalogKind === "plan" ? "plan" : "addon";
    const quantity = Math.max(item.quantity, 1);

    for (const fixture of fixtures) {
      const existing = entitlementMap.get(fixture.key);
      const mergedValue = mergeEntitlementValue(fixture.key, existing?.value, scaleEntitlementValue(fixture.value, quantity));
      const isSameSource =
        existing &&
        existing.sourceCatalogItemId === item.catalogItemId &&
        existing.sourceSubscriptionItemId === item.sourceSubscriptionItemId;

      entitlementMap.set(fixture.key, {
        key: fixture.key,
        value: mergedValue,
        grantedBy,
        sourceCatalogItemId: isSameSource ? item.catalogItemId : existing ? null : item.catalogItemId,
        sourceSubscriptionItemId: isSameSource ? item.sourceSubscriptionItemId : existing ? null : item.sourceSubscriptionItemId,
      });
    }
  }

  return Array.from(entitlementMap.values()).sort((left, right) => left.key.localeCompare(right.key));
}

export async function syncOrganizationEntitlementsFromSubscription(
  organizationId: string,
  status: string,
  db: RawDbClient = prisma
) {
  if (!SUBSCRIPTION_ENTITLEMENT_STATUSES.has(status)) {
    await replaceGrantedEntitlements(db, organizationId, SUBSCRIPTION_GRANTED_BY, []);
    return;
  }

  const rows = await db.$queryRawUnsafe<OrganizationSubscriptionItemEntitlementRow[]>(
    `
      SELECT
        billing_catalog_items."code" AS "catalogCode",
        billing_catalog_items."id" AS "catalogItemId",
        billing_catalog_items."kind" AS "catalogKind",
        organization_subscription_items."quantity" AS "quantity",
        organization_subscription_items."id" AS "sourceSubscriptionItemId"
      FROM "organization_subscription_items"
      INNER JOIN "organization_subscriptions"
        ON "organization_subscriptions"."id" = "organization_subscription_items"."organization_subscription_id"
      INNER JOIN "billing_catalog_items"
        ON "billing_catalog_items"."id" = "organization_subscription_items"."catalog_item_id"
      WHERE "organization_subscriptions"."organization_id" = CAST($1 AS UUID)
        AND "organization_subscriptions"."ended_at" IS NULL
        AND "organization_subscriptions"."status" = $2
        AND "organization_subscription_items"."ended_at" IS NULL
    `,
    organizationId,
    status
  );

  await replaceGrantedEntitlements(db, organizationId, SUBSCRIPTION_GRANTED_BY, buildAggregatedEntitlements(rows));
}

export async function listOrganizationEntitlements(organizationId: string): Promise<OrganizationEntitlementRow[]> {
  return prisma.$queryRawUnsafe<OrganizationEntitlementRow[]>(
    `
      SELECT
        "id",
        "organization_id" AS "organizationId",
        "source_catalog_item_id" AS "sourceCatalogItemId",
        "source_subscription_item_id" AS "sourceSubscriptionItemId",
        "key",
        "value",
        "granted_by" AS "grantedBy",
        "created_at" AS "createdAt",
        "updated_at" AS "updatedAt"
      FROM "organization_entitlements"
      WHERE "organization_id" = CAST($1 AS UUID)
      ORDER BY "key" ASC
    `,
    organizationId
  );
}

export async function getOrganizationEntitlementsSnapshot(organizationId: string) {
  const rows = await listOrganizationEntitlements(organizationId);

  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    sourceCatalogItemId: row.sourceCatalogItemId,
    sourceSubscriptionItemId: row.sourceSubscriptionItemId,
    key: row.key,
    value: row.value,
    grantedBy: row.grantedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function getOrganizationEntitlementMap(organizationId: string): Promise<OrganizationEntitlementMap> {
  const rows = await listOrganizationEntitlements(organizationId);

  return rows.reduce<OrganizationEntitlementMap>((map, row) => {
    map[row.key] = row.value as EntitlementValue;
    return map;
  }, {});
}

export async function getNumericOrganizationEntitlement(
  organizationId: string,
  key: string
): Promise<number | null> {
  const entitlementMap = await getOrganizationEntitlementMap(organizationId);
  const value = entitlementMap[key];

  return typeof value === "number" ? value : null;
}

export async function getBooleanOrganizationEntitlement(
  organizationId: string,
  key: string
): Promise<boolean> {
  const entitlementMap = await getOrganizationEntitlementMap(organizationId);
  return valueToBoolean(entitlementMap[key]);
}

export function valueToBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value > 0;
  }

  if (typeof value === "string") {
    return value === "true";
  }

  return false;
}
