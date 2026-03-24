import type { RequestHandler } from "express";

import { HttpError } from "../../lib/http-error";
import { getAuthenticatedUser } from "../../middleware/authenticate-client";
import {
  createPropertyForAuthenticatedUser,
  type CreatePropertyInput,
  type PropertyStatus,
} from "../../services/property.service";

type CreatePropertyRequestBody = {
  organizationId?: string;
  name?: string;
  code?: string | null;
  timezone?: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  status?: string;
};

function isPropertyStatus(value: string | undefined): value is PropertyStatus {
  return value === "active" || value === "inactive" || value === "archived";
}

export const createClientPropertyController: RequestHandler = async (req, res, next) => {
  try {
    const {
      organizationId,
      name,
      code,
      timezone,
      addressLine1,
      addressLine2,
      city,
      stateRegion,
      postalCode,
      countryCode,
      status,
    } = (req.body ?? {}) as CreatePropertyRequestBody;

    if (!organizationId?.trim()) {
      throw new HttpError(400, "organizationId is required.");
    }

    if (!name?.trim()) {
      throw new HttpError(400, "Property name is required.");
    }

    if (!timezone?.trim()) {
      throw new HttpError(400, "Property timezone is required.");
    }

    if (!isPropertyStatus(status)) {
      throw new HttpError(400, "Property status must be active, inactive, or archived.");
    }

    const authUser = getAuthenticatedUser(req);
    const property = await createPropertyForAuthenticatedUser(authUser, {
      organizationId,
      name,
      code: code ?? null,
      timezone,
      addressLine1: addressLine1 ?? null,
      addressLine2: addressLine2 ?? null,
      city: city ?? null,
      stateRegion: stateRegion ?? null,
      postalCode: postalCode ?? null,
      countryCode: countryCode ?? null,
      status,
    } satisfies CreatePropertyInput);

    res.status(201).json({ property });
  } catch (error) {
    next(error);
  }
};
