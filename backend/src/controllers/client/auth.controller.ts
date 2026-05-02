import type { RequestHandler } from "express";

import { HttpError } from "../../lib/http-error";
import { getAuthenticatedUser } from "../../middleware/authenticate-client";
import { getPermissionSnapshot } from "../../services/rbac.service";
import { syncAuthenticatedUser } from "../../services/user-sync.service";

export const getCurrentClientUserController: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthenticatedUser(req);
    const user = await syncAuthenticatedUser(authUser);

    res.json({ user });
  } catch (error) {
    next(error);
  }
};

export const getClientPermissionsController: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthenticatedUser(req);
    const user = await syncAuthenticatedUser(authUser);
    const organizationId =
      typeof req.query.organizationId === "string" && req.query.organizationId.trim().length > 0
        ? req.query.organizationId.trim()
        : null;

    if (!organizationId) {
      throw new HttpError(400, "organizationId is required.");
    }

    const permissionSnapshot = await getPermissionSnapshot(user.id, organizationId);
    res.json(permissionSnapshot);
  } catch (error) {
    next(error);
  }
};
