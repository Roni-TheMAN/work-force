import type { RequestHandler } from "express";

import { getAuthenticatedUser } from "../../middleware/authenticate-client";
import { syncAuthenticatedUser } from "../../services/user-sync.service";

export const getCurrentClientUserController: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthenticatedUser(req);
    const user = await syncAuthenticatedUser(authUser);

    res.json({ user });
  } catch (error) {
    next(error);
  }
};
