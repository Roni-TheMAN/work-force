import type { NextFunction, Request, Response } from "express";

import { HttpError } from "../lib/http-error";
import { type AuthenticatedSupabaseUser, verifySupabaseAccessToken } from "../lib/supabase-auth";

export type AuthenticatedRequest = Request & {
  authUser: AuthenticatedSupabaseUser;
};

function getBearerToken(authorizationHeader?: string): string {
  if (!authorizationHeader) {
    throw new HttpError(401, "Missing Authorization header.");
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new HttpError(401, "Authorization header must be in the format: Bearer <token>.");
  }

  return token;
}

export async function requireClientAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = getBearerToken(req.headers.authorization);
    const authUser = await verifySupabaseAccessToken(token);

    (req as AuthenticatedRequest).authUser = authUser;
    next();
  } catch (error) {
    next(error);
  }
}

export function getAuthenticatedUser(req: Request): AuthenticatedSupabaseUser {
  const authUser = (req as AuthenticatedRequest).authUser;

  if (!authUser) {
    throw new HttpError(500, "Authenticated user was not attached to the request.");
  }

  return authUser;
}
