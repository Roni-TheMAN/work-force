import { Router } from "express";

import { clientAuthRouter } from "./auth.routes";
import { clientBillingRouter } from "./billing.routes";
import { clientDocumentRouter } from "../../modules/documents/document.routes";
import { clientEmployeeRouter } from "./employee.routes";
import { propertyModuleRouter } from "../../modules/property/property.routes";
import { clientOrgRouter } from "./org.routes";
import { clientOrganizationRouter } from "./organization.routes";
import { clientPayrollRouter } from "./payroll.routes";
import { clientPropertyRouter } from "./property.routes";
import { clientSchedulingRouter } from "./scheduling.routes";
import { clientTimeTrackingRouter } from "./time-tracking.routes";

export const clientRouter = Router();

clientRouter.use(clientAuthRouter);
clientRouter.use(clientBillingRouter);
clientRouter.use(clientDocumentRouter);
clientRouter.use(clientEmployeeRouter);
clientRouter.use(clientOrgRouter);
clientRouter.use(clientOrganizationRouter);
clientRouter.use(clientPayrollRouter);
clientRouter.use(propertyModuleRouter);
clientRouter.use(clientPropertyRouter);
clientRouter.use(clientSchedulingRouter);
clientRouter.use(clientTimeTrackingRouter);
