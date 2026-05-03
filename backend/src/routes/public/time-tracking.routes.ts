import { Router } from "express";

import {
  completePublicQrPairingController,
  getPublicDeviceContextController,
  getPublicDeviceScheduleWeekController,
  recordPublicDevicePunchController,
  syncPublicDeviceClockEventsController,
  verifyPublicDevicePinController,
} from "../../controllers/public/time-tracking.controller";

export const publicTimeTrackingRouter = Router();

publicTimeTrackingRouter.get("/time/devices/me", getPublicDeviceContextController);
publicTimeTrackingRouter.get("/time/devices/schedule/week", getPublicDeviceScheduleWeekController);
publicTimeTrackingRouter.post("/time/devices/verify-pin", verifyPublicDevicePinController);
publicTimeTrackingRouter.post("/time/devices/sync/clock-events", syncPublicDeviceClockEventsController);
publicTimeTrackingRouter.post("/time/devices/punches/:punchType", recordPublicDevicePunchController);
publicTimeTrackingRouter.post("/time/pairing/qr/complete", completePublicQrPairingController);
