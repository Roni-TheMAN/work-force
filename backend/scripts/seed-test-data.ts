import { prisma } from "../src/lib/prisma";
import { env } from "../src/lib/env";
import type { AuthenticatedSupabaseUser } from "../src/lib/supabase-auth";
import { seedBillingCatalog, seedOrganizationBillingSubscription } from "../src/services/billing-seed.service";
import { seedRolesForOrganization } from "../src/services/seedRoles";
import { syncAuthenticatedUser } from "../src/services/user-sync.service";

type TestPropertySeed = {
  addressLine1: string;
  city: string;
  code: string;
  countryCode: string;
  name: string;
  postalCode: string;
  stateRegion: string;
};

type TestOrganizationSeed = {
  legalName: string;
  name: string;
  planCode: "enterprise" | "free" | "pro";
  properties: TestPropertySeed[];
  slug: string;
  timezone: string;
};

type TestUserSeed = {
  email: string;
  fullName: string;
  organization: TestOrganizationSeed;
  password: string;
};

type SupabaseAuthPayload = {
  access_token?: string;
  code?: number | string;
  error?: string;
  error_description?: string;
  msg?: string;
  user?: {
    email?: string;
    id?: string;
    phone?: string;
    role?: string;
    user_metadata?: Record<string, unknown>;
  };
};

type SeededUser = {
  email: string;
  fullName: string;
  id: string;
};

type SeededOrganizationSummary = {
  adminEmail: string;
  id: string;
  name: string;
  ownerEmail: string;
  properties: Array<{
    code: string;
    name: string;
  }>;
  slug: string;
};

const TEST_USERS: TestUserSeed[] = [
  {
    email: "majorsingh2406@gmail.com",
    fullName: "Major Singh",
    password: "admin123@",
    organization: {
      slug: "major-singh-workforce",
      name: "Major Singh Workforce",
      legalName: "Major Singh Workforce LLC",
      planCode: "pro",
      timezone: "America/Indianapolis",
      properties: [
        {
          code: "MS-DT",
          name: "Downtown Suites",
          addressLine1: "101 Market Street",
          city: "Indianapolis",
          stateRegion: "IN",
          postalCode: "46204",
          countryCode: "US",
        },
        {
          code: "MS-AP",
          name: "Airport Lodge",
          addressLine1: "2450 Aviation Drive",
          city: "Indianapolis",
          stateRegion: "IN",
          postalCode: "46241",
          countryCode: "US",
        },
      ],
    },
  },
  {
    email: "roniliz0909@gmail.com",
    fullName: "Roniliz Singh",
    password: "admin123@",
    organization: {
      slug: "roniliz-ops-group",
      name: "Roniliz Ops Group",
      legalName: "Roniliz Operations Group LLC",
      planCode: "pro",
      timezone: "America/Indianapolis",
      properties: [
        {
          code: "RO-NC",
          name: "Northside Commons",
          addressLine1: "8801 North Meridian Street",
          city: "Indianapolis",
          stateRegion: "IN",
          postalCode: "46260",
          countryCode: "US",
        },
        {
          code: "RO-LK",
          name: "Lakeside Point",
          addressLine1: "5020 East 82nd Street",
          city: "Indianapolis",
          stateRegion: "IN",
          postalCode: "46250",
          countryCode: "US",
        },
      ],
    },
  },
];

function printUsage(): void {
  console.log("Usage: npm run seed:test");
  console.log("       npm run seed:test -- --dry-run");
}

function getArgFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function getString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function getFullName(userMetadata: Record<string, unknown> | undefined): string | null {
  if (!userMetadata) {
    return null;
  }

  return getString(userMetadata.full_name) ?? getString(userMetadata.name);
}

function getResponseErrorMessage(payload: SupabaseAuthPayload): string {
  return (
    getString(payload.error_description) ??
    getString(payload.msg) ??
    getString(payload.error) ??
    "Unknown Supabase auth error."
  );
}

async function requestSupabaseAuth(
  path: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; payload: SupabaseAuthPayload; status: number }> {
  if (!env.supabaseAnonKey) {
    throw new Error("SUPABASE_ANON_KEY is required to run the test seed.");
  }

  const response = await fetch(`${env.supabaseIssuer}${path}`, {
    method: "POST",
    headers: {
      apikey: env.supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as SupabaseAuthPayload;

  return {
    ok: response.ok,
    payload,
    status: response.status,
  };
}

function toAuthenticatedSupabaseUser(
  payload: SupabaseAuthPayload,
  userSeed: TestUserSeed
): AuthenticatedSupabaseUser {
  const authUser = payload.user;
  const userId = getString(authUser?.id);
  const email = getString(authUser?.email) ?? userSeed.email;

  if (!userId) {
    throw new Error(`Supabase did not return a user id for ${userSeed.email}.`);
  }

  const userMetadata =
    authUser?.user_metadata && typeof authUser.user_metadata === "object" ? authUser.user_metadata : undefined;

  return {
    token: getString(payload.access_token) ?? "",
    id: userId,
    email,
    fullName: getFullName(userMetadata) ?? userSeed.fullName,
    avatarUrl: null,
    phone: getString(authUser?.phone),
    role: getString(authUser?.role),
  };
}

async function ensureSupabaseUser(userSeed: TestUserSeed): Promise<AuthenticatedSupabaseUser> {
  const signInResponse = await requestSupabaseAuth("/token?grant_type=password", {
    email: userSeed.email,
    password: userSeed.password,
  });

  if (signInResponse.ok) {
    return toAuthenticatedSupabaseUser(signInResponse.payload, userSeed);
  }

  const signUpResponse = await requestSupabaseAuth("/signup", {
    email: userSeed.email,
    password: userSeed.password,
    data: {
      full_name: userSeed.fullName,
    },
  });

  if (signUpResponse.ok) {
    return toAuthenticatedSupabaseUser(signUpResponse.payload, userSeed);
  }

  throw new Error(
    [
      `Unable to provision Supabase user ${userSeed.email}.`,
      `Sign-in failed: ${getResponseErrorMessage(signInResponse.payload)}`,
      `Sign-up failed: ${getResponseErrorMessage(signUpResponse.payload)}`,
    ].join(" ")
  );
}

async function seedOrganization(
  owner: SeededUser,
  admin: SeededUser,
  organizationSeed: TestOrganizationSeed
): Promise<SeededOrganizationSummary> {
  return prisma.$transaction(
    async (tx) => {
      const organization = await tx.organization.upsert({
        where: {
          slug: organizationSeed.slug,
        },
        update: {
          name: organizationSeed.name,
          legalName: organizationSeed.legalName,
          timezone: organizationSeed.timezone,
          status: "active",
          ownerUserId: owner.id,
        },
        create: {
          slug: organizationSeed.slug,
          name: organizationSeed.name,
          legalName: organizationSeed.legalName,
          timezone: organizationSeed.timezone,
          status: "active",
          ownerUserId: owner.id,
        },
      });

      const roleIdsByName = await seedRolesForOrganization(organization.id, tx);
      const ownerRoleId = roleIdsByName.Owner;
      const adminRoleId = roleIdsByName.Admin;

      if (!ownerRoleId || !adminRoleId) {
        throw new Error(`Default roles were not seeded correctly for organization ${organization.id}.`);
      }

      const joinedAt = new Date();

      await tx.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: owner.id,
          },
        },
        update: {
          roleId: ownerRoleId,
          status: "active",
          invitedEmail: null,
          invitedByUserId: null,
          joinedAt,
        },
        create: {
          organizationId: organization.id,
          userId: owner.id,
          roleId: ownerRoleId,
          status: "active",
          joinedAt,
        },
      });

      await tx.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: admin.id,
          },
        },
        update: {
          roleId: adminRoleId,
          status: "active",
          invitedEmail: null,
          invitedByUserId: owner.id,
          joinedAt,
        },
        create: {
          organizationId: organization.id,
          userId: admin.id,
          roleId: adminRoleId,
          status: "active",
          invitedEmail: admin.email,
          invitedByUserId: owner.id,
          joinedAt,
        },
      });

      const properties: SeededOrganizationSummary["properties"] = [];

      for (const propertySeed of organizationSeed.properties) {
        const property = await tx.property.upsert({
          where: {
            organizationId_code: {
              organizationId: organization.id,
              code: propertySeed.code,
            },
          },
          update: {
            name: propertySeed.name,
            timezone: organizationSeed.timezone,
            addressLine1: propertySeed.addressLine1,
            city: propertySeed.city,
            stateRegion: propertySeed.stateRegion,
            postalCode: propertySeed.postalCode,
            countryCode: propertySeed.countryCode,
            status: "active",
          },
          create: {
            organizationId: organization.id,
            name: propertySeed.name,
            code: propertySeed.code,
            timezone: organizationSeed.timezone,
            addressLine1: propertySeed.addressLine1,
            city: propertySeed.city,
            stateRegion: propertySeed.stateRegion,
            postalCode: propertySeed.postalCode,
            countryCode: propertySeed.countryCode,
            status: "active",
          },
        });

        await tx.propertyUserRole.upsert({
          where: {
            propertyId_userId: {
              propertyId: property.id,
              userId: owner.id,
            },
          },
          update: {
            roleId: ownerRoleId,
          },
          create: {
            propertyId: property.id,
            userId: owner.id,
            roleId: ownerRoleId,
          },
        });

        await tx.propertyUserRole.upsert({
          where: {
            propertyId_userId: {
              propertyId: property.id,
              userId: admin.id,
            },
          },
          update: {
            roleId: adminRoleId,
          },
          create: {
            propertyId: property.id,
            userId: admin.id,
            roleId: adminRoleId,
          },
        });

        properties.push({
          code: property.code ?? propertySeed.code,
          name: property.name,
        });
      }

      await tx.user.update({
        where: { id: owner.id },
        data: { lastActiveOrganizationId: organization.id },
      });

      return {
        id: organization.id,
        slug: organization.slug,
        name: organization.name,
        ownerEmail: owner.email,
        adminEmail: admin.email,
        properties,
      };
    },
    {
      maxWait: 10_000,
      timeout: 90_000,
    }
  );
}

function printDryRun(): void {
  console.log("Test seed plan:");

  for (const userSeed of TEST_USERS) {
    console.log(`- User: ${userSeed.email} (${userSeed.fullName})`);
    console.log(`  Org: ${userSeed.organization.name} [${userSeed.organization.slug}]`);

    for (const propertySeed of userSeed.organization.properties) {
      console.log(`  Property: ${propertySeed.name} [${propertySeed.code}]`);
    }
  }
}

async function main(): Promise<void> {
  if (getArgFlag("--help") || getArgFlag("-h")) {
    printUsage();
    return;
  }

  if (getArgFlag("--dry-run")) {
    printDryRun();
    return;
  }

  await seedBillingCatalog();

  const seededUsers = new Map<string, SeededUser>();

  for (const userSeed of TEST_USERS) {
    const authUser = await ensureSupabaseUser(userSeed);
    const syncedUser = await syncAuthenticatedUser(authUser);

    seededUsers.set(userSeed.email, {
      id: syncedUser.id,
      email: syncedUser.email,
      fullName: syncedUser.fullName ?? userSeed.fullName,
    });
  }

  const firstUser = seededUsers.get(TEST_USERS[0].email);
  const secondUser = seededUsers.get(TEST_USERS[1].email);

  if (!firstUser || !secondUser) {
    throw new Error("Test users were not seeded correctly.");
  }

  const summaries = [
    await seedOrganization(firstUser, secondUser, TEST_USERS[0].organization),
    await seedOrganization(secondUser, firstUser, TEST_USERS[1].organization),
  ];

  for (const [index, summary] of summaries.entries()) {
    await seedOrganizationBillingSubscription(summary.id, TEST_USERS[index]!.organization.planCode);
  }

  console.log("Test seed complete.");
  console.log("");
  console.log("Users:");

  for (const user of seededUsers.values()) {
    console.log(`- ${user.email} (${user.fullName})`);
  }

  console.log("");
  console.log("Organizations:");

  for (const summary of summaries) {
    console.log(`- ${summary.name} [${summary.slug}] owner=${summary.ownerEmail} admin=${summary.adminEmail}`);

    for (const property of summary.properties) {
      console.log(`  - ${property.name} [${property.code}]`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
