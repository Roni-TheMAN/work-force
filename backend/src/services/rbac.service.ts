import { prisma } from "../lib/prisma";
import { getOrganizationEntitlementMap } from "./billing-entitlements.service";
import { ensureOrganizationBillingState } from "./stripe-billing.service";

export async function getUserPermissions(userId: string, organizationId: string): Promise<Set<string>> {
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    include: {
      role: {
        include: {
          permissions: true,
        },
      },
    },
  });

  if (!membership || membership.status !== "active") {
    return new Set<string>();
  }

  return new Set(membership.role.permissions.map((permission) => permission.key));
}

export async function getPermissionSnapshot(userId: string, organizationId: string) {
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    include: {
      role: {
        include: {
          permissions: true,
        },
      },
    },
  });

  if (!membership || membership.status !== "active") {
    return {
      permissions: [] as string[],
      organizationRole: null,
      billingPlanCode: null as string | null,
      entitlements: {} as Record<string, unknown>,
    };
  }

  await ensureOrganizationBillingState(organizationId);

  const [entitlements, billingPlanRows] = await Promise.all([
    getOrganizationEntitlementMap(organizationId),
    prisma.$queryRawUnsafe<Array<{ code: string }>>(
      `
        SELECT billing_catalog_items."code"
        FROM "organization_subscription_items"
        INNER JOIN "organization_subscriptions"
          ON "organization_subscriptions"."id" = "organization_subscription_items"."organization_subscription_id"
        INNER JOIN "billing_catalog_items"
          ON "billing_catalog_items"."id" = "organization_subscription_items"."catalog_item_id"
        WHERE "organization_subscriptions"."organization_id" = CAST($1 AS UUID)
          AND "organization_subscriptions"."ended_at" IS NULL
          AND "organization_subscriptions"."status" IN ('trialing', 'active', 'past_due', 'unpaid', 'paused')
          AND "organization_subscription_items"."ended_at" IS NULL
          AND billing_catalog_items."kind" = 'plan'
        ORDER BY
          "organization_subscriptions"."created_at" DESC,
          "organization_subscription_items"."created_at" DESC
        LIMIT 1
      `,
      organizationId
    ),
  ]);

  return {
    permissions: membership.role.permissions.map((permission) => permission.key).sort(),
    organizationRole: membership.role.name,
    billingPlanCode: billingPlanRows[0]?.code ?? null,
    entitlements,
  };
}
