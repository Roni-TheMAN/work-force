import { Router } from "express";

import { createClientPropertyController } from "../../controllers/client/property.controller";
import { requireClientAuth } from "../../middleware/authenticate-client";

export const clientPropertyRouter = Router();

clientPropertyRouter.post("/properties", requireClientAuth, createClientPropertyController);
