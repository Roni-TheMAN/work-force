import { Router } from "express";

import { getClientSchedulingOverviewController } from "../../controllers/client/scheduling.controller";
import { PERMISSIONS } from "../../lib/permissions";
import { requireClientAuth } from "../../middleware/authenticate-client";
import { requirePermission } from "../../middleware/require-permission";

export const clientSchedulingRouter = Router();

clientSchedulingRouter.get(
  "/organizations/:organizationId/scheduling/overview",
  requireClientAuth,
  requirePermission(PERMISSIONS.SCHEDULE_READ),
  getClientSchedulingOverviewController
);
