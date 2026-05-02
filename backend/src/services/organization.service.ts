import { Prisma } from "../../generated/prisma-rbac";

import { prisma } from "../lib/prisma";
import type { AuthenticatedSupabaseUser } from "../lib/supabase-auth";
import { assertBillingCatalogReady } from "./billing-catalog.service";
import { seedFreePlanEntitlementsForOrganization } from "./billing-entitlements.service";
import { seedOrganizationBillingSubscription } from "./billing-seed.service";
import { bootstrapDefaultRolesForNewOrganization } from "./seedRoles";
import { syncAuthenticatedUser, type ClientUserProfile } from "./user-sync.service";

export type OrganizationPlanId = "free" | "pro" | "enterprise";

export type CreateOrganizationInput = {
  legalName: string | null;
  name: string;
  planId: OrganizationPlanId;
  slug: string;
  timezone: string;
};

export type ClientOrganization = {
  id: string;
  slug: string;
  name: string;
  legalName: string | null;
  timezone: string;
  status: string;
  role: string;
  joinedAt: string | null;
  createdAt: string;
  updatedAt: string;
  properties: ClientProperty[];
};

export type ClientProperty = {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  timezone: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  countryCode: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type OrganizationProvisioningDbClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
};

type OrganizationCleanupDbClient = {
  organization: {
    delete(args: {
      where: {
        id: string;
      };
    }): Promise<unknown>;
  };
  user: {
    update(args: {
      where: {
        id: string;
      };
      data: {
        lastActiveOrganizationId: string | null;
      };
    }): Promise<unknown>;
  };
};

type OrganizationProvisioningDependencies = {
  seedFreePlanEntitlementsForOrganization: typeof seedFreePlanEntitlementsForOrganization;
  seedOrganizationBillingSubscription: typeof seedOrganizationBillingSubscription;
};

type OrganizationPrismaClient = {
  $transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
};

type CreateOrganizationServiceDependencies = {
  prisma: OrganizationPrismaClient;
  ensureUserExists: (authUser: AuthenticatedSupabaseUser) => Promise<ClientUserProfile>;
  assertBillingCatalogReady: () => Promise<void>;
  bootstrapDefaultRolesForNewOrganization: (
    organizationId: string,
    db: Prisma.TransactionClient
  ) => Promise<Record<string, string>>;
  provisionOrganizationPlanState: (
    organizationId: string,
    planId: OrganizationPlanId,
    db: Prisma.TransactionClient
  ) => Promise<void>;
  cleanupFailedOrganizationProvisioning: (
    input: {
      organizationId: string;
      previousLastActiveOrganizationId: string | null;
      userId: string;
    },
    db: Prisma.TransactionClient
  ) => Promise<void>;
};

const defaultCreateOrganizationServiceDependencies: CreateOrganizationServiceDependencies = {
  prisma,
  ensureUserExists,
  assertBillingCatalogReady,
  bootstrapDefaultRolesForNewOrganization,
  provisionOrganizationPlanState,
  cleanupFailedOrganizationProvisioning,
};

const defaultOrganizationProvisioningDependencies: OrganizationProvisioningDependencies = {
  seedFreePlanEntitlementsForOrganization,
  seedOrganizationBillingSubscription,
};

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getOrganizationStatus(planId: OrganizationPlanId): string {
  return planId === "free" ? "active" : "trialing";
}

function toClientOrganization(
  organization: {
    id: string;
    slug: string;
    name: string;
    legalName: string | null;
    timezone: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    properties?: Array<{
      id: string;
      organizationId: string;
      name: string;
      code: string | null;
      timezone: string;
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      stateRegion: string | null;
      postalCode: string | null;
      countryCode: string | null;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
  },
  membership: {
    role: {
      id: string;
      name: string;
    };
    joinedAt: Date | null;
  }
): ClientOrganization {
  return {
    id: organization.id,
    slug: organization.slug,
    name: organization.name,
    legalName: organization.legalName,
    timezone: organization.timezone,
    status: organization.status,
    role: membership.role.name,
    joinedAt: membership.joinedAt?.toISOString() ?? null,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
    properties: organization.properties?.map(toClientProperty) ?? [],
  };
}

export function toClientProperty(property: {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  timezone: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  countryCode: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): ClientProperty {
  return {
    id: property.id,
    organizationId: property.organizationId,
    name: property.name,
    code: property.code,
    timezone: property.timezone,
    addressLine1: property.addressLine1,
    addressLine2: property.addressLine2,
    city: property.city,
    stateRegion: property.stateRegion,
    postalCode: property.postalCode,
    countryCode: property.countryCode,
    status: property.status,
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
  };
}

async function ensureUserExists(authUser: AuthenticatedSupabaseUser): Promise<ClientUserProfile> {
  return syncAuthenticatedUser(authUser);
}

function roundDurationMs(durationMs: number): number {
  return Math.round(durationMs * 100) / 100;
}

function getErrorLogFields(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
    };
  }

  return {
    errorName: typeof error,
    errorMessage: String(error),
  };
}

function logOrganizationCreateEvent(event: string, payload: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      scope: "organization.create",
      event,
      ...payload,
    })
  );
}

function logOrganizationCreateError(event: string, payload: Record<string, unknown>, error: unknown) {
  console.error(
    JSON.stringify({
      scope: "organization.create",
      event,
      ...payload,
      ...getErrorLogFields(error),
    })
  );
}

export async function provisionOrganizationPlanState(
  organizationId: string,
  planId: OrganizationPlanId,
  db: OrganizationProvisioningDbClient = prisma,
  dependencies: OrganizationProvisioningDependencies = defaultOrganizationProvisioningDependencies
): Promise<void> {
  if (planId === "free") {
    await dependencies.seedFreePlanEntitlementsForOrganization(organizationId, db);
    return;
  }

  await dependencies.seedOrganizationBillingSubscription(organizationId, planId, db);
}

export async function cleanupFailedOrganizationProvisioning(
  input: {
    organizationId: string;
    previousLastActiveOrganizationId: string | null;
    userId: string;
  },
  db: OrganizationCleanupDbClient = prisma
): Promise<void> {
  await db.user.update({
    where: { id: input.userId },
    data: {
      lastActiveOrganizationId: input.previousLastActiveOrganizationId,
    },
  });

  await db.organization.delete({
    where: { id: input.organizationId },
  });
}

export async function createOrganizationForAuthenticatedUserWithDependencies(
  authUser: AuthenticatedSupabaseUser,
  input: CreateOrganizationInput,
  dependencies: CreateOrganizationServiceDependencies = defaultCreateOrganizationServiceDependencies
): Promise<ClientOrganization> {
  const userSyncStartedAt = performance.now();
  const currentUser = await dependencies.ensureUserExists(authUser);

  logOrganizationCreateEvent("user_sync_completed", {
    durationMs: roundDurationMs(performance.now() - userSyncStartedAt),
    userId: currentUser.id,
  });

  if (input.planId !== "free") {
    await dependencies.assertBillingCatalogReady();
  }

  const previousLastActiveOrganizationId = currentUser.lastActiveOrganizationId;

  const slug = normalizeSlug(input.slug);

  const normalizedInput = {
    name: input.name.trim(),
    slug,
    legalName: normalizeOptionalText(input.legalName),
    timezone: input.timezone.trim(),
    status: getOrganizationStatus(input.planId),
  };

  const now = new Date();

  try {
    const coreBootstrapStartedAt = performance.now();

    const coreBootstrapResult = await dependencies.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          slug: normalizedInput.slug,
          name: normalizedInput.name,
          legalName: normalizedInput.legalName,
          timezone: normalizedInput.timezone,
          status: normalizedInput.status,
          ownerUserId: currentUser.id,
        },
      });

      const roleIdsByName = await dependencies.bootstrapDefaultRolesForNewOrganization(organization.id, tx);
      const ownerRoleId = roleIdsByName.Owner;

      if (!ownerRoleId) {
        throw new Error("The default owner role could not be created.");
      }

      const membership = await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: currentUser.id,
          roleId: ownerRoleId,
          status: "active",
          joinedAt: now,
        },
        include: {
          role: true,
        },
      });

      await tx.user.update({
        where: { id: currentUser.id },
        data: {
          lastActiveOrganizationId: organization.id,
        },
      });

      return {
        membership,
        organization,
      };
    });

    logOrganizationCreateEvent("core_bootstrap_completed", {
      durationMs: roundDurationMs(performance.now() - coreBootstrapStartedAt),
      organizationId: coreBootstrapResult.organization.id,
      planId: input.planId,
      userId: currentUser.id,
    });

    const provisioningStartedAt = performance.now();

    try {
      await dependencies.prisma.$transaction(async (tx) => {
        await dependencies.provisionOrganizationPlanState(coreBootstrapResult.organization.id, input.planId, tx);
      });

      logOrganizationCreateEvent("provisioning_completed", {
        durationMs: roundDurationMs(performance.now() - provisioningStartedAt),
        organizationId: coreBootstrapResult.organization.id,
        planId: input.planId,
        provisioningMode: input.planId === "free" ? "free_plan" : "paid_plan",
        userId: currentUser.id,
      });

      return toClientOrganization(coreBootstrapResult.organization, coreBootstrapResult.membership);
    } catch (provisioningError) {
      logOrganizationCreateError(
        "provisioning_failed_after_core_bootstrap",
        {
          classification: "organization_provisioning_failed_after_core_bootstrap",
          durationMs: roundDurationMs(performance.now() - provisioningStartedAt),
          organizationId: coreBootstrapResult.organization.id,
          planId: input.planId,
          provisioningMode: input.planId === "free" ? "free_plan" : "paid_plan",
          userId: currentUser.id,
        },
        provisioningError
      );

      const cleanupStartedAt = performance.now();

      try {
        await dependencies.prisma.$transaction(async (tx) => {
          await dependencies.cleanupFailedOrganizationProvisioning(
            {
              organizationId: coreBootstrapResult.organization.id,
              previousLastActiveOrganizationId,
              userId: currentUser.id,
            },
            tx
          );
        });

        logOrganizationCreateEvent("cleanup_completed", {
          durationMs: roundDurationMs(performance.now() - cleanupStartedAt),
          organizationId: coreBootstrapResult.organization.id,
          planId: input.planId,
          userId: currentUser.id,
        });
      } catch (cleanupError) {
        logOrganizationCreateError(
          "cleanup_failed_after_provisioning_error",
          {
            classification: "organization_provisioning_cleanup_failed",
            cleanupDurationMs: roundDurationMs(performance.now() - cleanupStartedAt),
            organizationId: coreBootstrapResult.organization.id,
            planId: input.planId,
            provisioningErrorMessage:
              provisioningError instanceof Error ? provisioningError.message : String(provisioningError),
            userId: currentUser.id,
          },
          cleanupError
        );
      }

      throw new Error("Organization provisioning failed after core bootstrap.", {
        cause: provisioningError instanceof Error ? provisioningError : undefined,
      });
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("An organization with that slug already exists.");
    }

    throw error;
  }
}

export async function createOrganizationForAuthenticatedUser(
  authUser: AuthenticatedSupabaseUser,
  input: CreateOrganizationInput
): Promise<ClientOrganization> {
  return createOrganizationForAuthenticatedUserWithDependencies(authUser, input);
}

export async function listOrganizationsForAuthenticatedUser(
  authUser: AuthenticatedSupabaseUser
): Promise<ClientOrganization[]> {
  await ensureUserExists(authUser);

  const memberships = await prisma.organizationMember.findMany({
    where: {
      userId: authUser.id,
      status: "active",
    },
    include: {
      organization: {
        include: {
          properties: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      },
      role: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return memberships.map((membership) => toClientOrganization(membership.organization, membership));
}
