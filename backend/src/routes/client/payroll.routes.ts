import { Router } from "express";

import { getClientPayrollSummaryController } from "../../controllers/client/payroll.controller";
import { PERMISSIONS } from "../../lib/permissions";
import { requireClientAuth } from "../../middleware/authenticate-client";
import { requirePermission } from "../../middleware/require-permission";

export const clientPayrollRouter = Router();

clientPayrollRouter.get(
  "/organizations/:organizationId/payroll/summary",
  requireClientAuth,
  requirePermission(PERMISSIONS.PAYROLL_READ),
  getClientPayrollSummaryController
);
