import { Router } from "express";

import { clientAuthRouter } from "./auth.routes";
import { clientBillingRouter } from "./billing.routes";
import { clientOrganizationRouter } from "./organization.routes";
import { clientPropertyRouter } from "./property.routes";

export const clientRouter = Router();

clientRouter.use(clientAuthRouter);
clientRouter.use(clientBillingRouter);
clientRouter.use(clientOrganizationRouter);
clientRouter.use(clientPropertyRouter);
