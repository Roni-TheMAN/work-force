import type { NextFunction, Request, Response } from "express";

import { type AuthenticatedSupabaseUser, verifySupabaseAccessToken } from "../../lib/supabase-auth";
import { hasPropertyScopeBypassPermission } from "../../lib/rbac";
import { HttpError } from "../../lib/http-error";
import { prisma } from "../../lib/prisma";
import { syncAuthenticatedUser, type ClientUserProfile } from "../../services/user-sync.service";

export type PropertyRequestContext = {
  authUser: AuthenticatedSupabaseUser;
  localUser: ClientUserProfile;
  property: {
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
  };
  organizationMembership: {
    id: string;
    organizationId: string;
    userId: string;
    status: string;
    role: {
      id: string;
      name: string;
      permissions: Array<{
        key: string;
      }>;
    };
  };
  propertyUserRole: {
    id: string;
    role: {
      id: string;
      name: string;
      permissions: Array<{
        key: string;
      }>;
    } | null;
  } | null;
  permissions: {
    organization: string[];
    property: string[];
    effective: string[];
    canBypassPropertyScope: boolean;
  };
};

export type PropertyRequest = Request & {
  propertyContext?: PropertyRequestContext;
};

function getBearerToken(authorizationHeader?: string): string {
  if (!authorizationHeader) {
    throw new HttpError(401, "Missing Authorization header.");
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new HttpError(401, "Authorization header must be in the format: Bearer <token>.");
  }

  return token;
}

function getPropertyId(req: Request): string {
  const rawPropertyId = req.params.propertyId;
  const propertyId = typeof rawPropertyId === "string" ? rawPropertyId.trim() : "";

  if (!propertyId) {
    throw new HttpError(400, "propertyId is required.");
  }

  return propertyId;
}

function dedupePermissionKeys(permissionKeys: string[]): string[] {
  return Array.from(new Set(permissionKeys)).sort();
}

export function getPropertyContext(req: Request): PropertyRequestContext {
  const context = (req as PropertyRequest).propertyContext;

  if (!context) {
    throw new HttpError(500, "Property request context was not attached.");
  }

  return context;
}

export function hasEffectivePropertyPermission(context: PropertyRequestContext, permissionKey: string): boolean {
  return context.permissions.effective.includes(permissionKey);
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = getBearerToken(req.headers.authorization);
    const authUser = await verifySupabaseAccessToken(token);
    const localUser = await syncAuthenticatedUser(authUser);

    (req as PropertyRequest).propertyContext = {
      authUser,
      localUser,
    } as PropertyRequestContext;

    next();
  } catch (error) {
    next(error);
  }
}

export async function requireOrgAccess(req: Request, _res: Response, next: NextFunction) {
  try {
    const propertyId = getPropertyId(req);
    const currentContext = getPropertyContext(req);
    const property = await prisma.property.findUnique({
      where: {
        id: propertyId,
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        code: true,
        timezone: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        stateRegion: true,
        postalCode: true,
        countryCode: true,
        status: true,
      },
    });

    if (!property) {
      throw new HttpError(404, "Property not found.");
    }

    const organizationMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: property.organizationId,
          userId: currentContext.localUser.id,
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

    if (!organizationMembership || organizationMembership.status !== "active") {
      throw new HttpError(403, "You do not have access to that organization.");
    }

    const organizationPermissions = dedupePermissionKeys(
      organizationMembership.role.permissions.map((permission) => permission.key)
    );

    (req as PropertyRequest).propertyContext = {
      ...currentContext,
      property,
      organizationMembership: {
        id: organizationMembership.id,
        organizationId: organizationMembership.organizationId,
        userId: organizationMembership.userId,
        status: organizationMembership.status,
        role: {
          id: organizationMembership.role.id,
          name: organizationMembership.role.name,
          permissions: organizationMembership.role.permissions.map((permission) => ({
            key: permission.key,
          })),
        },
      },
      permissions: {
        organization: organizationPermissions,
        property: [],
        effective: organizationPermissions,
        canBypassPropertyScope: false,
      },
    } as PropertyRequestContext;

    next();
  } catch (error) {
    next(error);
  }
}

export async function requirePropertyAccess(req: Request, _res: Response, next: NextFunction) {
  try {
    const currentContext = getPropertyContext(req);
    const organizationPermissionKeys = currentContext.permissions.organization;
    const canBypassPropertyScope = hasPropertyScopeBypassPermission(organizationPermissionKeys);

    if (canBypassPropertyScope) {
      (req as PropertyRequest).propertyContext = {
        ...currentContext,
        propertyUserRole: null,
        permissions: {
          organization: organizationPermissionKeys,
          property: [],
          effective: organizationPermissionKeys,
          canBypassPropertyScope: true,
        },
      };

      next();
      return;
    }

    const propertyUserRole = await prisma.propertyUserRole.findUnique({
      where: {
        propertyId_userId: {
          propertyId: currentContext.property.id,
          userId: currentContext.localUser.id,
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

    if (!propertyUserRole || !propertyUserRole.role) {
      throw new HttpError(403, "You do not have access to that property.");
    }

    const propertyPermissionKeys = dedupePermissionKeys(
      propertyUserRole.role.permissions.map((permission) => permission.key)
    );

    if (propertyPermissionKeys.length === 0) {
      throw new HttpError(403, "You do not have access to that property.");
    }

    (req as PropertyRequest).propertyContext = {
      ...currentContext,
      propertyUserRole: {
        id: propertyUserRole.id,
        role: {
          id: propertyUserRole.role.id,
          name: propertyUserRole.role.name,
          permissions: propertyUserRole.role.permissions.map((permission) => ({
            key: permission.key,
          })),
        },
      },
      permissions: {
        organization: organizationPermissionKeys,
        property: propertyPermissionKeys,
        effective: propertyPermissionKeys,
        canBypassPropertyScope: false,
      },
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireEffectivePermission(permissionKey: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const context = getPropertyContext(req);

      if (!hasEffectivePropertyPermission(context, permissionKey)) {
        throw new HttpError(403, "You do not have permission to perform this action for this property.");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
