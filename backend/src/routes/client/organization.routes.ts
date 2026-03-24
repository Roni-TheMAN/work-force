import { Router } from "express";

import {
  createClientOrganizationController,
  listClientOrganizationsController,
} from "../../controllers/client/organization.controller";
import { requireClientAuth } from "../../middleware/authenticate-client";

export const clientOrganizationRouter = Router();

clientOrganizationRouter.get("/organizations", requireClientAuth, listClientOrganizationsController);
clientOrganizationRouter.post("/organizations", requireClientAuth, createClientOrganizationController);
