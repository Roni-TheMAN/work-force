import assert from "node:assert/strict";
import test from "node:test";

import type { Prisma } from "../../generated/prisma-rbac";
import type { AuthenticatedSupabaseUser } from "../lib/supabase-auth";
import type { ClientUserProfile } from "./user-sync.service";
import type { CreateOrganizationInput } from "./organization.service";
import {
  cleanupFailedOrganizationProvisioning,
  createOrganizationForAuthenticatedUserWithDependencies,
  provisionOrganizationPlanState,
} from "./organization.service";

type MembershipCreateArgs = {
  data: {
    organizationId: string;
    userId: string;
    roleId: string;
    status: string;
    joinedAt: Date;
  };
};

type UserUpdateArgs = {
  where: {
    id: string;
  };
  data: {
    lastActiveOrganizationId: string | null;
  };
};

function createAuthUser(overrides: Partial<AuthenticatedSupabaseUser> = {}): AuthenticatedSupabaseUser {
  return {
    token: "token",
    id: "auth-user-id",
    email: "owner@example.com",
    fullName: "Owner Example",
    avatarUrl: null,
    phone: null,
    role: null,
    ...overrides,
  };
}

function createCurrentUser(overrides: Partial<ClientUserProfile> = {}): ClientUserProfile {
  return {
    id: "current-user-id",
    email: "owner@example.com",
    fullName: "Owner Example",
    phone: null,
    avatarUrl: null,
    lastActiveOrganizationId: "previous-org-id",
    createdAt: new Date("2026-04-20T09:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-04-20T09:00:00.000Z").toISOString(),
    ...overrides,
  };
}

function createInput(overrides: Partial<CreateOrganizationInput> = {}): CreateOrganizationInput {
  return {
    legalName: "Acme Hospitality LLC",
    name: "Acme Hospitality",
    planId: "free",
    slug: "acme-hospitality",
    timezone: "America/Indianapolis",
    ...overrides,
  };
}

async function withMutedConsole<T>(callback: () => Promise<T>): Promise<T> {
  const originalInfo = console.info;
  const originalError = console.error;

  console.info = () => undefined;
  console.error = () => undefined;

  try {
    return await callback();
  } finally {
    console.info = originalInfo;
    console.error = originalError;
  }
}

test("createOrganizationForAuthenticatedUserWithDependencies uses the synced user id and runs provisioning after the core bootstrap", async () => {
  const authUser = createAuthUser({ id: "auth-only-user-id" });
  const currentUser = createCurrentUser({ id: "current-owner-id" });
  const input = createInput();
  const organizationCreatedAt = new Date("2026-04-20T10:00:00.000Z");
  const organizationUpdatedAt = new Date("2026-04-20T10:00:00.000Z");

  let transactionCallCount = 0;
  let assertBillingCatalogReadyCallCount = 0;
  let bootstrapOrganizationId: string | null = null;
  const captured = {
    membershipCreateArgs: null as MembershipCreateArgs | null,
    userUpdateArgs: null as UserUpdateArgs | null,
  };
  let provisionArgs:
    | {
        organizationId: string;
        planId: CreateOrganizationInput["planId"];
      }
    | null = null;

  const coreTx = {
    organization: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({
        id: "org-1",
        slug: data.slug as string,
        name: data.name as string,
        legalName: data.legalName as string | null,
        timezone: data.timezone as string,
        status: data.status as string,
        createdAt: organizationCreatedAt,
        updatedAt: organizationUpdatedAt,
      }),
    },
    organizationMember: {
      create: async (args: MembershipCreateArgs) => {
        captured.membershipCreateArgs = args;

        return {
          joinedAt: args.data.joinedAt,
          role: {
            id: args.data.roleId,
            name: "Owner",
          },
        };
      },
    },
    user: {
      update: async (args: UserUpdateArgs) => {
        captured.userUpdateArgs = args;
      },
    },
  };

  const prisma = {
    $transaction: async <T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) => {
      transactionCallCount += 1;
      return callback((transactionCallCount === 1 ? coreTx : {}) as Prisma.TransactionClient);
    },
  };

  const organization = await withMutedConsole(() =>
    createOrganizationForAuthenticatedUserWithDependencies(authUser, input, {
      prisma,
      ensureUserExists: async () => currentUser,
      assertBillingCatalogReady: async () => {
        assertBillingCatalogReadyCallCount += 1;
      },
      bootstrapDefaultRolesForNewOrganization: async (organizationId) => {
        bootstrapOrganizationId = organizationId;
        return {
          Owner: "role-owner",
        };
      },
      provisionOrganizationPlanState: async (organizationId, planId) => {
        provisionArgs = {
          organizationId,
          planId,
        };
      },
      cleanupFailedOrganizationProvisioning: async () => {
        throw new Error("cleanup should not be called for a successful request");
      },
    })
  );

  assert.equal(assertBillingCatalogReadyCallCount, 0);
  assert.equal(transactionCallCount, 2);
  assert.equal(bootstrapOrganizationId, "org-1");
  assert.ok(captured.membershipCreateArgs);
  assert.equal(captured.membershipCreateArgs!.data.organizationId, "org-1");
  assert.equal(captured.membershipCreateArgs!.data.roleId, "role-owner");
  assert.equal(captured.membershipCreateArgs!.data.status, "active");
  assert.equal(captured.membershipCreateArgs!.data.userId, currentUser.id);
  assert.ok(captured.userUpdateArgs);
  assert.equal(captured.userUpdateArgs!.where.id, currentUser.id);
  assert.equal(captured.userUpdateArgs!.data.lastActiveOrganizationId, "org-1");
  assert.deepEqual(provisionArgs, {
    organizationId: "org-1",
    planId: "free",
  });
  assert.equal(organization.id, "org-1");
  assert.equal(organization.role, "Owner");
  assert.equal(organization.joinedAt, captured.membershipCreateArgs!.data.joinedAt.toISOString());
});

test("createOrganizationForAuthenticatedUserWithDependencies stops before any transaction when paid-plan catalog preflight fails", async () => {
  let transactionCallCount = 0;

  await assert.rejects(
    () =>
      withMutedConsole(() =>
        createOrganizationForAuthenticatedUserWithDependencies(createAuthUser(), createInput({ planId: "pro" }), {
          prisma: {
            $transaction: async <T>(_callback: (tx: Prisma.TransactionClient) => Promise<T>) => {
              transactionCallCount += 1;
              throw new Error("transactions should not run when billing catalog preflight fails");
            },
          },
          ensureUserExists: async () => createCurrentUser(),
          assertBillingCatalogReady: async () => {
            throw new Error("Billing catalog is not seeded.");
          },
          bootstrapDefaultRolesForNewOrganization: async () => ({ Owner: "role-owner" }),
          provisionOrganizationPlanState: async () => {},
          cleanupFailedOrganizationProvisioning: async () => {},
        })
      ),
    /Billing catalog is not seeded/
  );

  assert.equal(transactionCallCount, 0);
});

test("createOrganizationForAuthenticatedUserWithDependencies cleans up the organization when provisioning fails after the core bootstrap", async () => {
  const currentUser = createCurrentUser({ id: "current-owner-id", lastActiveOrganizationId: "previous-org-id" });
  const input = createInput({ planId: "enterprise" });
  const organizationCreatedAt = new Date("2026-04-20T10:00:00.000Z");
  const organizationUpdatedAt = new Date("2026-04-20T10:00:00.000Z");

  let transactionCallCount = 0;
  let cleanupArgs:
    | {
        organizationId: string;
        previousLastActiveOrganizationId: string | null;
        userId: string;
      }
    | null = null;

  const coreTx = {
    organization: {
      create: async () => ({
        id: "org-1",
        slug: "acme-hospitality",
        name: "Acme Hospitality",
        legalName: "Acme Hospitality LLC",
        timezone: "America/Indianapolis",
        status: "trialing",
        createdAt: organizationCreatedAt,
        updatedAt: organizationUpdatedAt,
      }),
    },
    organizationMember: {
      create: async ({ data }: { data: { joinedAt: Date; roleId: string } }) => ({
        joinedAt: data.joinedAt,
        role: {
          id: data.roleId,
          name: "Owner",
        },
      }),
    },
    user: {
      update: async () => {},
    },
  };
  const cleanupTx = {};

  await assert.rejects(
    () =>
      withMutedConsole(() =>
        createOrganizationForAuthenticatedUserWithDependencies(createAuthUser(), input, {
          prisma: {
            $transaction: async <T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) => {
              transactionCallCount += 1;

              if (transactionCallCount === 1) {
                return callback(coreTx as unknown as Prisma.TransactionClient);
              }

              if (transactionCallCount === 2) {
                return callback({} as unknown as Prisma.TransactionClient);
              }

              return callback(cleanupTx as unknown as Prisma.TransactionClient);
            },
          },
          ensureUserExists: async () => currentUser,
          assertBillingCatalogReady: async () => {},
          bootstrapDefaultRolesForNewOrganization: async () => ({ Owner: "role-owner" }),
          provisionOrganizationPlanState: async () => {
            throw new Error("seedOrganizationBillingSubscription failed");
          },
          cleanupFailedOrganizationProvisioning: async (args, tx) => {
            cleanupArgs = args;
            assert.equal(tx, cleanupTx);
          },
        })
      ),
    /Organization provisioning failed after core bootstrap/
  );

  assert.equal(transactionCallCount, 3);
  assert.deepEqual(cleanupArgs, {
    organizationId: "org-1",
    previousLastActiveOrganizationId: "previous-org-id",
    userId: "current-owner-id",
  });
});

test("provisionOrganizationPlanState routes free and paid organizations through the correct seed helper", async () => {
  const calls: string[] = [];
  const dependencies = {
    seedFreePlanEntitlementsForOrganization: async (organizationId: string) => {
      calls.push(`free:${organizationId}`);
    },
    seedOrganizationBillingSubscription: async (organizationId: string, planId: "enterprise" | "free" | "pro") => {
      calls.push(`paid:${organizationId}:${planId}`);
    },
  };

  await provisionOrganizationPlanState("org-free", "free", {} as never, dependencies);
  await provisionOrganizationPlanState("org-pro", "pro", {} as never, dependencies);

  assert.deepEqual(calls, ["free:org-free", "paid:org-pro:pro"]);
});

test("cleanupFailedOrganizationProvisioning restores the last active organization before deleting the failed org", async () => {
  const operations: string[] = [];

  await cleanupFailedOrganizationProvisioning(
    {
      organizationId: "org-1",
      previousLastActiveOrganizationId: "previous-org-id",
      userId: "current-owner-id",
    },
    {
      user: {
        update: async ({ data, where }) => {
          operations.push(`user.update:${where.id}:${data.lastActiveOrganizationId}`);
        },
      },
      organization: {
        delete: async ({ where }) => {
          operations.push(`organization.delete:${where.id}`);
        },
      },
    }
  );

  assert.deepEqual(operations, [
    "user.update:current-owner-id:previous-org-id",
    "organization.delete:org-1",
  ]);
});
