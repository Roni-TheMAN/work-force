import type { RequestHandler } from "express";

import { HttpError } from "../../lib/http-error";
import { getAuthenticatedUser } from "../../middleware/authenticate-client";
import {
  createOrganizationForAuthenticatedUser,
  listOrganizationsForAuthenticatedUser,
  type CreateOrganizationInput,
  type OrganizationPlanId,
} from "../../services/organization.service";

type CreateOrganizationRequestBody = {
  legalName?: string | null;
  name?: string;
  planId?: string;
  slug?: string;
  timezone?: string;
};

function isOrganizationPlanId(value: string | undefined): value is OrganizationPlanId {
  return value === "free" || value === "pro" || value === "enterprise";
}

export const createClientOrganizationController: RequestHandler = async (req, res, next) => {
  try {
    const { name, slug, legalName, timezone, planId } = (req.body ?? {}) as CreateOrganizationRequestBody;

    if (!name?.trim()) {
      throw new HttpError(400, "Organization name is required.");
    }

    if (!slug?.trim()) {
      throw new HttpError(400, "Organization slug is required.");
    }

    if (!timezone?.trim()) {
      throw new HttpError(400, "Organization timezone is required.");
    }

    if (!isOrganizationPlanId(planId)) {
      throw new HttpError(400, "Organization planId must be free, pro, or enterprise.");
    }

    const authUser = getAuthenticatedUser(req);

    const organization = await createOrganizationForAuthenticatedUser(authUser, {
      name,
      slug,
      legalName: legalName ?? null,
      timezone,
      planId,
    } satisfies CreateOrganizationInput);

    res.status(201).json({ organization });
  } catch (error) {
    if (error instanceof Error && error.message === "An organization with that slug already exists.") {
      next(new HttpError(409, error.message));
      return;
    }

    next(error);
  }
};

export const listClientOrganizationsController: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthenticatedUser(req);
    const organizations = await listOrganizationsForAuthenticatedUser(authUser);

    res.json({ organizations });
  } catch (error) {
    next(error);
  }
};
