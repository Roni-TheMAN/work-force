import { Prisma } from "../generated/prisma";

import { prisma } from "../lib/prisma";
import type { AuthenticatedSupabaseUser } from "../lib/supabase-auth";
import { HttpError } from "../lib/http-error";
import { toClientProperty, type ClientProperty } from "./organization.service";

export type PropertyStatus = "active" | "inactive" | "archived";

export type CreatePropertyInput = {
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
  status: PropertyStatus;
};

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeCode(value: string | null | undefined): string | null {
  const normalizedValue = normalizeOptionalText(value);
  return normalizedValue ? normalizedValue.toUpperCase() : null;
}

async function ensureUserExists(authUser: AuthenticatedSupabaseUser) {
  return prisma.user.upsert({
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
}

async function requireOrganizationAccess(
  authUser: AuthenticatedSupabaseUser,
  organizationId: string
) {
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId: authUser.id,
      status: "active",
    },
    include: {
      organization: true,
    },
  });

  if (!membership) {
    throw new HttpError(403, "You do not have access to that organization.");
  }

  if (!["owner", "admin", "manager"].includes(membership.role)) {
    throw new HttpError(403, "Your organization role cannot create properties.");
  }

  return membership;
}

export async function createPropertyForAuthenticatedUser(
  authUser: AuthenticatedSupabaseUser,
  input: CreatePropertyInput
): Promise<ClientProperty> {
  await ensureUserExists(authUser);
  await requireOrganizationAccess(authUser, input.organizationId);

  try {
    const property = await prisma.property.create({
      data: {
        organizationId: input.organizationId,
        name: input.name.trim(),
        code: normalizeCode(input.code),
        timezone: input.timezone.trim(),
        addressLine1: normalizeOptionalText(input.addressLine1),
        addressLine2: normalizeOptionalText(input.addressLine2),
        city: normalizeOptionalText(input.city),
        stateRegion: normalizeOptionalText(input.stateRegion),
        postalCode: normalizeOptionalText(input.postalCode),
        countryCode: normalizeOptionalText(input.countryCode)?.toUpperCase() ?? null,
        status: input.status,
      },
    });

    return toClientProperty(property);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "A property with that code already exists in this organization.");
    }

    throw error;
  }
}
