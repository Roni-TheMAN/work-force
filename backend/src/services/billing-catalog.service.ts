import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";
import {
  BILLING_CATALOG_FIXTURES,
  type BillingCatalogItemFixture,
  type BillingEntitlementFixture,
  type BillingQuantityMode,
} from "../billing/billing-catalog.fixture";

type RawDbClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
};

type BillingCatalogItemRow = {
  id: string;
  code: string;
  kind: string;
  name: string;
  description: string | null;
  stripeProductId: string;
  active: boolean;
};

type BillingPriceRow = {
  id: string;
  catalogItemId: string;
  stripePriceId: string;
  currency: string;
  unitAmountCents: bigint | number;
  billingType: string;
  recurringInterval: string | null;
  intervalCount: number | null;
  active: boolean;
};

type BillingCatalogListRow = {
  code: string;
  kind: string;
  name: string;
  description: string | null;
  stripeProductId: string;
  stripePriceId: string | null;
  unitAmountCents: bigint | null;
  currency: string | null;
  billingType: string | null;
  recurringInterval: string | null;
  intervalCount: number | null;
};

export type BillingCatalogKind = "addon" | "plan";

export type BillingCatalogSummary = {
  billingType: string | null;
  code: string;
  currency: string | null;
  description: string | null;
  entitlements: BillingEntitlementFixture[];
  intervalCount: number | null;
  kind: BillingCatalogKind;
  name: string;
  quantityMode: BillingQuantityMode;
  recurringInterval: string | null;
  stripePriceId: string | null;
  stripeProductId: string;
  unitAmountCents: number | null;
};

const BILLING_CATALOG_NOT_READY_MESSAGE = 'Billing catalog is not seeded. Run "npm run seed:essentials".';

function getDbClient(db: RawDbClient = prisma): RawDbClient {
  return db;
}

export function getBillingCatalogFixtureByCode(code: string): BillingCatalogItemFixture | null {
  return BILLING_CATALOG_FIXTURES.find((item) => item.code === code) ?? null;
}

export function getBillingEntitlementFixturesByCode(code: string): BillingEntitlementFixture[] {
  return getBillingCatalogFixtureByCode(code)?.entitlements ?? [];
}

export function getBillingQuantityModeByCode(code: string): BillingQuantityMode | null {
  return getBillingCatalogFixtureByCode(code)?.quantityMode ?? null;
}

export function getBillingCatalogKindByCode(code: string): BillingCatalogKind | null {
  const kind = getBillingCatalogFixtureByCode(code)?.kind;
  return kind === "plan" || kind === "addon" ? kind : null;
}

function isKnownBillingCatalogCode(code: string): boolean {
  return BILLING_CATALOG_FIXTURES.some((item) => item.code === code);
}

function isCatalogPriceExpectedForCode(code: string): boolean {
  return (getBillingCatalogFixtureByCode(code)?.prices.length ?? 0) > 0;
}

async function upsertCatalogItem(db: RawDbClient, item: BillingCatalogItemFixture): Promise<string> {
  const existingRows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `
      SELECT "id"
      FROM "billing_catalog_items"
      WHERE "code" = $1
         OR "stripe_product_id" = $2
      LIMIT 1
    `,
    item.code,
    item.stripeProductId
  );

  const existingRow = existingRows[0];

  if (existingRow?.id) {
    await db.$executeRawUnsafe(
      `
        UPDATE "billing_catalog_items"
        SET
          "code" = $2,
          "kind" = $3,
          "name" = $4,
          "description" = $5,
          "stripe_product_id" = $6,
          "active" = $7,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = CAST($1 AS UUID)
      `,
      existingRow.id,
      item.code,
      item.kind,
      item.name,
      item.description ?? null,
      item.stripeProductId,
      item.active ?? true
    );

    return existingRow.id;
  }

  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `
      INSERT INTO "billing_catalog_items" (
        "id",
        "code",
        "kind",
        "name",
        "description",
        "stripe_product_id",
        "active",
        "created_at",
        "updated_at"
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      RETURNING "id"
    `,
    item.code,
    item.kind,
    item.name,
    item.description ?? null,
    item.stripeProductId,
    item.active ?? true
  );

  const row = rows[0];

  if (!row?.id) {
    throw new Error(`Unable to upsert billing catalog item ${item.code}.`);
  }

  return row.id;
}

async function upsertBillingPrice(db: RawDbClient, catalogItemId: string, itemPrice: BillingCatalogItemFixture["prices"][number]) {
  await db.$executeRawUnsafe(
    `
      INSERT INTO "billing_prices" (
        "id",
        "catalog_item_id",
        "stripe_price_id",
        "currency",
        "unit_amount_cents",
        "billing_type",
        "recurring_interval",
        "interval_count",
        "active",
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
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("stripe_price_id") DO UPDATE
      SET
        "catalog_item_id" = EXCLUDED."catalog_item_id",
        "currency" = EXCLUDED."currency",
        "unit_amount_cents" = EXCLUDED."unit_amount_cents",
        "billing_type" = EXCLUDED."billing_type",
        "recurring_interval" = EXCLUDED."recurring_interval",
        "interval_count" = EXCLUDED."interval_count",
        "active" = EXCLUDED."active",
        "updated_at" = CURRENT_TIMESTAMP
    `,
    catalogItemId,
    itemPrice.stripePriceId,
    itemPrice.currency,
    BigInt(itemPrice.unitAmountCents),
    itemPrice.billingType,
    itemPrice.recurringInterval ?? null,
    itemPrice.intervalCount ?? null,
    itemPrice.active ?? true
  );
}

export async function ensureBillingCatalogSeeded(db: RawDbClient = prisma): Promise<void> {
  const client = getDbClient(db);

  for (const item of BILLING_CATALOG_FIXTURES) {
    const catalogItemId = await upsertCatalogItem(client, item);

    for (const itemPrice of item.prices) {
      await upsertBillingPrice(client, catalogItemId, itemPrice);
    }
  }
}

export async function assertBillingCatalogReady(db: RawDbClient = prisma): Promise<void> {
  const client = getDbClient(db);
  const requiredCodes = BILLING_CATALOG_FIXTURES.map((item) => item.code);
  const requiredPriceIds = BILLING_CATALOG_FIXTURES.flatMap((item) => item.prices.map((price) => price.stripePriceId));

  const [catalogRows, priceRows] = await Promise.all([
    client.$queryRawUnsafe<Array<{ code: string }>>(
      `
        SELECT "code"
        FROM "billing_catalog_items"
        WHERE "code" = ANY($1::text[])
      `,
      requiredCodes
    ),
    requiredPriceIds.length > 0
      ? client.$queryRawUnsafe<Array<{ stripePriceId: string }>>(
          `
            SELECT "stripe_price_id" AS "stripePriceId"
            FROM "billing_prices"
            WHERE "stripe_price_id" = ANY($1::text[])
          `,
          requiredPriceIds
        )
      : Promise.resolve([]),
  ]);

  const existingCodes = new Set(catalogRows.map((row) => row.code));
  const existingPriceIds = new Set(priceRows.map((row) => row.stripePriceId));
  const missingCodes = requiredCodes.filter((code) => !existingCodes.has(code));
  const missingPriceIds = requiredPriceIds.filter((priceId) => !existingPriceIds.has(priceId));

  if (missingCodes.length > 0 || missingPriceIds.length > 0) {
    const details = [
      missingCodes.length > 0 ? `missing items: ${missingCodes.join(", ")}` : null,
      missingPriceIds.length > 0 ? `missing prices: ${missingPriceIds.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("; ");

    throw new Error(`${BILLING_CATALOG_NOT_READY_MESSAGE}${details ? ` ${details}.` : ""}`);
  }
}

export async function getBillingCatalogItemByCode(
  code: string,
  db: RawDbClient = prisma
): Promise<BillingCatalogItemRow | null> {
  const client = getDbClient(db);

  const rows = await client.$queryRawUnsafe<BillingCatalogItemRow[]>(
    `
      SELECT
        "id",
        "code",
        "kind",
        "name",
        "description",
        "stripe_product_id" AS "stripeProductId",
        "active"
      FROM "billing_catalog_items"
      WHERE "code" = $1
      LIMIT 1
    `,
    code
  );

  const row = rows[0] ?? null;

  if (!row && isKnownBillingCatalogCode(code)) {
    throw new HttpError(500, BILLING_CATALOG_NOT_READY_MESSAGE);
  }

  return row;
}

export async function getBillingPriceForCatalogCode(
  code: string,
  db: RawDbClient = prisma
): Promise<BillingPriceRow | null> {
  const client = getDbClient(db);

  const rows = await client.$queryRawUnsafe<BillingPriceRow[]>(
    `
      SELECT
        billing_prices."id",
        billing_prices."catalog_item_id" AS "catalogItemId",
        billing_prices."stripe_price_id" AS "stripePriceId",
        billing_prices."currency",
        billing_prices."unit_amount_cents" AS "unitAmountCents",
        billing_prices."billing_type" AS "billingType",
        billing_prices."recurring_interval" AS "recurringInterval",
        billing_prices."interval_count" AS "intervalCount",
        billing_prices."active"
      FROM "billing_prices"
      INNER JOIN "billing_catalog_items"
        ON "billing_catalog_items"."id" = billing_prices."catalog_item_id"
      WHERE "billing_catalog_items"."code" = $1
        AND "billing_catalog_items"."active" = true
        AND billing_prices."active" = true
      ORDER BY billing_prices."created_at" DESC
      LIMIT 1
    `,
    code
  );

  const row = rows[0] ?? null;

  if (!row && isKnownBillingCatalogCode(code) && isCatalogPriceExpectedForCode(code)) {
    throw new HttpError(500, BILLING_CATALOG_NOT_READY_MESSAGE);
  }

  return row;
}

function toBillingCatalogSummary(row: BillingCatalogListRow): BillingCatalogSummary {
  const fixture = getBillingCatalogFixtureByCode(row.code);

  return {
    code: row.code,
    kind: row.kind === "addon" ? "addon" : "plan",
    name: row.name,
    description: row.description,
    stripeProductId: row.stripeProductId,
    stripePriceId: row.stripePriceId,
    unitAmountCents: typeof row.unitAmountCents === "bigint" ? Number(row.unitAmountCents) : row.unitAmountCents,
    currency: row.currency,
    billingType: row.billingType,
    recurringInterval: row.recurringInterval,
    intervalCount: row.intervalCount,
    quantityMode: fixture?.quantityMode ?? "single",
    entitlements: fixture?.entitlements ?? [],
  };
}

async function listBillingCatalogItems(kind: BillingCatalogKind, db: RawDbClient = prisma): Promise<BillingCatalogSummary[]> {
  const client = getDbClient(db);

  const rows = await client.$queryRawUnsafe<BillingCatalogListRow[]>(
    `
      SELECT
        billing_catalog_items."code",
        billing_catalog_items."kind",
        billing_catalog_items."name",
        billing_catalog_items."description",
        billing_catalog_items."stripe_product_id" AS "stripeProductId",
        billing_prices."stripe_price_id" AS "stripePriceId",
        billing_prices."unit_amount_cents" AS "unitAmountCents",
        billing_prices."currency",
        billing_prices."billing_type" AS "billingType",
        billing_prices."recurring_interval" AS "recurringInterval",
        billing_prices."interval_count" AS "intervalCount"
      FROM "billing_catalog_items"
      LEFT JOIN "billing_prices"
        ON "billing_prices"."catalog_item_id" = "billing_catalog_items"."id"
        AND "billing_prices"."active" = true
      WHERE "billing_catalog_items"."kind" = $1
        AND "billing_catalog_items"."active" = true
      ORDER BY "billing_catalog_items"."created_at" ASC, billing_prices."created_at" DESC
    `,
    kind
  );

  const expectedCodes = BILLING_CATALOG_FIXTURES.filter((item) => item.kind === kind).map((item) => item.code);
  const existingCodes = new Set(rows.map((row) => row.code));
  const missingCodes = expectedCodes.filter((code) => !existingCodes.has(code));

  if (missingCodes.length > 0) {
    throw new HttpError(
      500,
      `${BILLING_CATALOG_NOT_READY_MESSAGE} Missing ${kind === "plan" ? "plans" : "addons"}: ${missingCodes.join(", ")}.`
    );
  }

  return rows.map(toBillingCatalogSummary);
}

export async function listBillingPlans(db: RawDbClient = prisma) {
  return listBillingCatalogItems("plan", db);
}

export async function listBillingAddons(db: RawDbClient = prisma) {
  return listBillingCatalogItems("addon", db);
}
