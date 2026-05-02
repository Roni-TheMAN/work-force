import type { NextFunction, Request, Response } from "express";

import { hasPermission, hasPropertyAccess, canBypassPropertyScope, getOrganizationMembership } from "../lib/rbac";
import { HttpError } from "../lib/http-error";
import { prisma } from "../lib/prisma";
import { syncAuthenticatedUser } from "../services/user-sync.service";
import { getAuthenticatedUser } from "./authenticate-client";

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getOrganizationIdFromRequest(req: Request): string | null {
  const body = typeof req.body === "object" && req.body ? req.body : {};

  return (
    readString(req.params.organizationId) ??
    readString(req.params.orgId) ??
    readString((body as Record<string, unknown>).organizationId) ??
    readString(req.query.organizationId) ??
    readString(req.query.orgId)
  );
}

function getPropertyIdFromRequest(req: Request): string | null {
  const body = typeof req.body === "object" && req.body ? req.body : {};

  return (
    readString(req.params.propertyId) ??
    readString((body as Record<string, unknown>).propertyId) ??
    readString(req.query.propertyId)
  );
}

export function requirePermission(permissionKey: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const authUser = getAuthenticatedUser(req);
      const localUser = await syncAuthenticatedUser(authUser);
      const organizationId = getOrganizationIdFromRequest(req);

      if (!organizationId) {
        throw new HttpError(400, "organizationId is required for permission checks.");
      }

      const membership = await getOrganizationMembership(localUser.id, organizationId);

      if (!membership || membership.status !== "active") {
        throw new HttpError(403, "You do not have access to that organization.");
      }

      const permitted = await hasPermission(localUser.id, organizationId, permissionKey);

      if (!permitted) {
        throw new HttpError(403, "You do not have permission to perform this action.");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requirePropertyAccess(permissionKey: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const authUser = getAuthenticatedUser(req);
      const localUser = await syncAuthenticatedUser(authUser);
      const propertyId = getPropertyIdFromRequest(req);

      if (!propertyId) {
        throw new HttpError(400, "propertyId is required for property access checks.");
      }

      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: {
          id: true,
          organizationId: true,
        },
      });

      if (!property) {
        throw new HttpError(404, "Property not found.");
      }

      const membership = await getOrganizationMembership(localUser.id, property.organizationId);

      if (!membership || membership.status !== "active") {
        throw new HttpError(403, "You do not have access to that organization.");
      }

      const permitted = await hasPermission(localUser.id, property.organizationId, permissionKey);

      if (!permitted) {
        throw new HttpError(403, "You do not have permission to perform this action.");
      }

      const bypass = await canBypassPropertyScope(localUser.id, property.organizationId);

      if (bypass) {
        next();
        return;
      }

      const allowed = await hasPropertyAccess(localUser.id, property.id);

      if (!allowed) {
        throw new HttpError(403, "You do not have access to that property.");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
