import type { RequestHandler } from "express";

import { HttpError } from "../../lib/http-error";
import { getAuthenticatedUser } from "../../middleware/authenticate-client";
import { syncAuthenticatedUser } from "../../services/user-sync.service";
import { getOrganizationSchedulingSummary } from "../../modules/property/property-scheduling";

export const getClientSchedulingOverviewController: RequestHandler = async (req, res, next) => {
  try {
    const organizationId =
      typeof req.params.organizationId === "string" && req.params.organizationId.trim().length > 0
        ? req.params.organizationId.trim()
        : null;

    if (!organizationId) {
      throw new HttpError(400, "organizationId is required.");
    }

    const authUser = getAuthenticatedUser(req);
    const localUser = await syncAuthenticatedUser(authUser);
    const overview = await getOrganizationSchedulingSummary({
      organizationId,
      userId: localUser.id,
    });

    res.json({ overview });
  } catch (error) {
    next(error);
  }
};
