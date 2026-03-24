import { Prisma } from "../generated/prisma";

import { prisma } from "../lib/prisma";
import type { AuthenticatedSupabaseUser } from "../lib/supabase-auth";
import { type ClientUserProfile } from "./user-sync.service";

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
  membership: { role: string; joinedAt: Date | null }
): ClientOrganization {
  return {
    id: organization.id,
    slug: organization.slug,
    name: organization.name,
    legalName: organization.legalName,
    timezone: organization.timezone,
    status: organization.status,
    role: membership.role,
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
  const user = await prisma.user.upsert({
    where: { id: authUser.id },
    update: {
      email: authUser.email,
      fullName: authUser.fullName,
      phone: authUser.phone,
      avatarUrl: authUser.avatarUrl,
    },
    create: {
      id: authUser.id,
      email: authUser.email,
      fullName: authUser.fullName,
      phone: authUser.phone,
      avatarUrl: authUser.avatarUrl,
    },
  });

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    lastActiveOrganizationId: user.lastActiveOrganizationId,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function createOrganizationForAuthenticatedUser(
  authUser: AuthenticatedSupabaseUser,
  input: CreateOrganizationInput
): Promise<ClientOrganization> {
  await ensureUserExists(authUser);

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
    return await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          slug: normalizedInput.slug,
          name: normalizedInput.name,
          legalName: normalizedInput.legalName,
          timezone: normalizedInput.timezone,
          status: normalizedInput.status,
          ownerUserId: authUser.id,
        },
      });

      const membership = await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: authUser.id,
          role: "owner",
          status: "active",
          joinedAt: now,
        },
      });

      await tx.user.update({
        where: { id: authUser.id },
        data: {
          lastActiveOrganizationId: organization.id,
        },
      });

      return toClientOrganization(organization, membership);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("An organization with that slug already exists.");
    }

    throw error;
  }
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
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return memberships.map((membership) => toClientOrganization(membership.organization, membership));
}
