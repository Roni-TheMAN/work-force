import { Router } from "express";

import {
  assignUserToPropertiesController,
  createClientPropertyController,
  getPropertyDashboardController,
  getUserAccessController,
  updatePropertyAccessController,
  updatePropertySettingsController,
} from "../../controllers/client/property.controller";
import { PERMISSIONS } from "../../lib/permissions";
import { requirePermission, requirePropertyAccess } from "../../middleware/auth";
import { requireClientAuth } from "../../middleware/authenticate-client";

export const clientPropertyRouter = Router();

clientPropertyRouter.post(
  "/properties",
  requireClientAuth,
  requirePermission(PERMISSIONS.PROPERTY_WRITE),
  createClientPropertyController
);
clientPropertyRouter.get(
  "/property/:propertyId/dashboard",
  requireClientAuth,
  requirePropertyAccess(PERMISSIONS.PROPERTY_READ),
  getPropertyDashboardController
);
clientPropertyRouter.patch(
  "/property/:propertyId/access/:userId",
  requireClientAuth,
  requirePropertyAccess(PERMISSIONS.PROPERTY_WRITE),
  updatePropertyAccessController
);
clientPropertyRouter.patch(
  "/property/:propertyId/settings",
  requireClientAuth,
  requirePropertyAccess(PERMISSIONS.PROPERTY_WRITE),
  updatePropertySettingsController
);
clientPropertyRouter.post(
  "/properties/assign-user",
  requireClientAuth,
  requirePermission(PERMISSIONS.USER_MANAGE),
  requirePermission(PERMISSIONS.PROPERTY_WRITE),
  assignUserToPropertiesController
);
clientPropertyRouter.get(
  "/users/:id/access",
  requireClientAuth,
  requirePermission(PERMISSIONS.USER_MANAGE),
  getUserAccessController
);
