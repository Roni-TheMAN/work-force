import { Router } from "express";

import { checkPublicEmailExistsController } from "../../controllers/public/auth.controller";

export const publicAuthRouter = Router();

publicAuthRouter.post("/auth/email-exists", checkPublicEmailExistsController);
