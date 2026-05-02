import { Router } from "express";

import {
  acceptInviteController,
  inviteUserToOrgController,
  listOrganizationRolesController,
  listOrganizationUsersController,
  removeOrganizationUserController,
} from "../../controllers/client/org.controller";
import { PERMISSIONS } from "../../lib/permissions";
import { requirePermission } from "../../middleware/auth";
import { requireClientAuth } from "../../middleware/authenticate-client";

export const clientOrgRouter = Router();

clientOrgRouter.get(
  "/org/roles",
  requireClientAuth,
  requirePermission(PERMISSIONS.USER_INVITE),
  listOrganizationRolesController
);
clientOrgRouter.get(
  "/org/users",
  requireClientAuth,
  requirePermission(PERMISSIONS.USER_MANAGE),
  listOrganizationUsersController
);
clientOrgRouter.post(
  "/org/invite",
  requireClientAuth,
  requirePermission(PERMISSIONS.USER_INVITE),
  inviteUserToOrgController
);
clientOrgRouter.delete(
  "/org/users/:userId",
  requireClientAuth,
  requirePermission(PERMISSIONS.USER_MANAGE),
  removeOrganizationUserController
);
clientOrgRouter.post("/org/accept-invite", requireClientAuth, acceptInviteController);
