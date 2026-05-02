import { Router } from "express";

import {
  addEmployeePropertyAssignmentController,
  archiveEmployeeController,
  deleteEmployeeController,
  listClientEmployeesController,
  removeEmployeePropertyAssignmentController,
  resetEmployeePinController,
  revealEmployeePinController,
  updateEmployeePropertyAssignmentController,
} from "../../controllers/client/employee.controller";
import { PERMISSIONS } from "../../lib/permissions";
import { requireClientAuth } from "../../middleware/authenticate-client";
import { requirePermission } from "../../middleware/auth";

export const clientEmployeeRouter = Router();

clientEmployeeRouter.get(
  "/organizations/:organizationId/employees",
  requireClientAuth,
  requirePermission(PERMISSIONS.EMPLOYEE_READ),
  listClientEmployeesController
);

clientEmployeeRouter.delete(
  "/organizations/:organizationId/employees/:employeeId",
  requireClientAuth,
  requirePermission(PERMISSIONS.EMPLOYEE_WRITE),
  deleteEmployeeController
);

clientEmployeeRouter.post(
  "/organizations/:organizationId/employees/:employeeId/archive",
  requireClientAuth,
  requirePermission(PERMISSIONS.EMPLOYEE_WRITE),
  archiveEmployeeController
);

clientEmployeeRouter.post(
  "/organizations/:organizationId/employees/:employeeId/properties",
  requireClientAuth,
  requirePermission(PERMISSIONS.EMPLOYEE_WRITE),
  addEmployeePropertyAssignmentController
);

clientEmployeeRouter.patch(
  "/organizations/:organizationId/employees/:employeeId/properties/:propertyId",
  requireClientAuth,
  requirePermission(PERMISSIONS.EMPLOYEE_WRITE),
  updateEmployeePropertyAssignmentController
);

clientEmployeeRouter.delete(
  "/organizations/:organizationId/employees/:employeeId/properties/:propertyId",
  requireClientAuth,
  requirePermission(PERMISSIONS.EMPLOYEE_WRITE),
  removeEmployeePropertyAssignmentController
);

clientEmployeeRouter.post(
  "/organizations/:organizationId/employees/:employeeId/pin/reveal",
  requireClientAuth,
  requirePermission(PERMISSIONS.EMPLOYEE_WRITE),
  revealEmployeePinController
);

clientEmployeeRouter.post(
  "/organizations/:organizationId/employees/:employeeId/pin/reset",
  requireClientAuth,
  requirePermission(PERMISSIONS.EMPLOYEE_WRITE),
  resetEmployeePinController
);
