import { Router } from "express";

import {
  getClientPermissionsController,
  getCurrentClientUserController,
} from "../../controllers/client/auth.controller";
import { requireClientAuth } from "../../middleware/authenticate-client";

export const clientAuthRouter = Router();

clientAuthRouter.get("/auth/me", requireClientAuth, getCurrentClientUserController);
clientAuthRouter.get("/auth/permissions", requireClientAuth, getClientPermissionsController);
