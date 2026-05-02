import { Prisma } from "../../generated/prisma-rbac";

import { prisma } from "../lib/prisma";
import { PERMISSIONS } from "../lib/permissions";
import type { AuthenticatedSupabaseUser } from "../lib/supabase-auth";
import { HttpError } from "../lib/http-error";
import { getNumericOrganizationEntitlement } from "./billing-entitlements.service";
import { getUserPermissions } from "./rbac.service";
import { toClientProperty, type ClientProperty } from "./organization.service";
import { ensureOrganizationBillingState } from "./stripe-billing.service";
import { syncAuthenticatedUser } from "./user-sync.service";

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
  return syncAuthenticatedUser(authUser);
}

async function requireOrganizationAccess(
  authUser: AuthenticatedSupabaseUser,
  organizationId: string
) {
  const localUser = await ensureUserExists(authUser);
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId: localUser.id,
      status: "active",
    },
    include: {
      organization: true,
    },
  });

  if (!membership) {
    throw new HttpError(403, "You do not have access to that organization.");
  }

  const permissions = await getUserPermissions(localUser.id, organizationId);

  if (!permissions.has(PERMISSIONS.PROPERTY_WRITE)) {
    throw new HttpError(403, "You do not have permission to create properties.");
  }

  return membership;
}

export async function createPropertyForAuthenticatedUser(
  authUser: AuthenticatedSupabaseUser,
  input: CreatePropertyInput
): Promise<ClientProperty> {
  await ensureUserExists(authUser);
  await requireOrganizationAccess(authUser, input.organizationId);

  let [propertyLimit, propertyCount] = await Promise.all([
    getNumericOrganizationEntitlement(input.organizationId, "max_properties"),
    prisma.property.count({
      where: {
        organizationId: input.organizationId,
      },
    }),
  ]);

  if (propertyLimit === null) {
    await ensureOrganizationBillingState(input.organizationId);
    propertyLimit = await getNumericOrganizationEntitlement(input.organizationId, "max_properties");
  }

  if (propertyLimit === null) {
    throw new HttpError(403, "Organization property entitlements are not configured.");
  }

  if (propertyCount >= propertyLimit) {
    throw new HttpError(
      409,
      `This organization has reached its property limit of ${propertyLimit}. Upgrade billing or add capacity before creating another property.`
    );
  }

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
