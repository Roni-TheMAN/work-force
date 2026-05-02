import { Router } from "express";

import {
  adjustClientShiftController,
  createManualShiftController,
  createPropertyDevicePairingTokenController,
  deletePropertyDeviceRecordController,
  listClientShiftsController,
  listPropertyDevicesController,
  recordClientPunchController,
  registerPropertyDeviceController,
  retirePropertyDeviceController,
} from "../../controllers/client/time-tracking.controller";
import { PERMISSIONS } from "../../lib/permissions";
import { requirePropertyAccess } from "../../middleware/auth";
import { requireClientAuth } from "../../middleware/authenticate-client";

export const clientTimeTrackingRouter = Router();

clientTimeTrackingRouter.get(
  "/properties/:propertyId/time/devices",
  requireClientAuth,
  requirePropertyAccess(PERMISSIONS.PROPERTY_READ),
  listPropertyDevicesController
);
clientTimeTrackingRouter.post(
  "/properties/:propertyId/time/devices",
  requireClientAuth,
  requirePropertyAccess(PERMISSIONS.PROPERTY_WRITE),
  registerPropertyDeviceController
);
clientTimeTrackingRouter.delete(
  "/properties/:propertyId/time/devices/:deviceId",
  requireClientAuth,
  requirePropertyAccess(PERMISSIONS.PROPERTY_WRITE),
  retirePropertyDeviceController
);
clientTimeTrackingRouter.delete(
  "/properties/:propertyId/time/devices/:deviceId/record",
  requireClientAuth,
  requirePropertyAccess(PERMISSIONS.PROPERTY_WRITE),
  deletePropertyDeviceRecordController
);
clientTimeTrackingRouter.post(
  "/properties/:propertyId/time/pairing-tokens",
  requireClientAuth,
  requirePropertyAccess(PERMISSIONS.PROPERTY_WRITE),
  createPropertyDevicePairingTokenController
);
clientTimeTrackingRouter.post("/time/punches/:punchType", requireClientAuth, recordClientPunchController);
clientTimeTrackingRouter.get(
  "/organizations/:organizationId/time/shifts",
  requireClientAuth,
  listClientShiftsController
);
clientTimeTrackingRouter.post(
  "/organizations/:organizationId/time/shifts",
  requireClientAuth,
  createManualShiftController
);
clientTimeTrackingRouter.patch(
  "/organizations/:organizationId/time/shifts/:shiftSessionId",
  requireClientAuth,
  adjustClientShiftController
);
