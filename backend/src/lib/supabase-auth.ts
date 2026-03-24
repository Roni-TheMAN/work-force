import { createSecretKey } from "node:crypto";

import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTPayload } from "jose";

import { env } from "./env";
import { HttpError } from "./http-error";

type UserMetadata = Record<string, unknown>;

type SupabaseJwtClaims = JWTPayload & {
  aud?: string | string[];
  email?: string;
  phone?: string;
  role?: string;
  sub?: string;
  user_metadata?: UserMetadata;
};

type SupabaseAuthUserResponse = {
  id?: string;
  email?: string;
  phone?: string;
  role?: string;
  user_metadata?: UserMetadata;
};

export type AuthenticatedSupabaseUser = {
  token: string;
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  role: string | null;
};

const supabaseJwks = createRemoteJWKSet(new URL(`${env.supabaseIssuer}/.well-known/jwks.json`));

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function getFullName(userMetadata: UserMetadata | undefined): string | null {
  if (!userMetadata) {
    return null;
  }

  return getString(userMetadata.full_name) ?? getString(userMetadata.name);
}

function getAvatarUrl(userMetadata: UserMetadata | undefined): string | null {
  if (!userMetadata) {
    return null;
  }

  return getString(userMetadata.avatar_url) ?? getString(userMetadata.picture);
}

function normalizeClaimsUser(token: string, claims: SupabaseJwtClaims): AuthenticatedSupabaseUser {
  const userId = getString(claims.sub);
  const email = getString(claims.email);
  const userMetadata = isObject(claims.user_metadata) ? claims.user_metadata : undefined;

  if (!userId || !email) {
    throw new HttpError(401, "Supabase access token is missing required identity claims.");
  }

  return {
    token,
    id: userId,
    email,
    fullName: getFullName(userMetadata),
    avatarUrl: getAvatarUrl(userMetadata),
    phone: getString(claims.phone) ?? getString(userMetadata?.phone),
    role: getString(claims.role),
  };
}

function normalizeAuthServerUser(
  token: string,
  authUser: SupabaseAuthUserResponse
): AuthenticatedSupabaseUser {
  const userId = getString(authUser.id);
  const email = getString(authUser.email);
  const userMetadata = isObject(authUser.user_metadata) ? authUser.user_metadata : undefined;

  if (!userId || !email) {
    throw new HttpError(401, "Supabase user response is missing required identity fields.");
  }

  return {
    token,
    id: userId,
    email,
    fullName: getFullName(userMetadata),
    avatarUrl: getAvatarUrl(userMetadata),
    phone: getString(authUser.phone) ?? getString(userMetadata?.phone),
    role: getString(authUser.role),
  };
}

async function verifyWithConfiguredStrategy(token: string): Promise<SupabaseJwtClaims> {
  if (env.supabaseJwtSecret) {
    const secret = createSecretKey(Buffer.from(env.supabaseJwtSecret, "utf-8"));
    const { payload } = await jwtVerify(token, secret, {
      issuer: env.supabaseIssuer,
      audience: "authenticated",
    });

    return payload as SupabaseJwtClaims;
  }

  const { payload } = await jwtVerify(token, supabaseJwks, {
    issuer: env.supabaseIssuer,
    audience: "authenticated",
  });

  return payload as SupabaseJwtClaims;
}

async function fetchUserFromSupabaseAuth(token: string): Promise<AuthenticatedSupabaseUser> {
  if (!env.supabaseAnonKey) {
    throw new HttpError(
      401,
      "Supabase access token verification failed and SUPABASE_ANON_KEY is not configured for auth-server fallback."
    );
  }

  const response = await fetch(`${env.supabaseIssuer}/user`, {
    method: "GET",
    headers: {
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new HttpError(401, "Invalid or expired Supabase access token.");
  }

  const authUser = (await response.json()) as SupabaseAuthUserResponse;
  return normalizeAuthServerUser(token, authUser);
}

function shouldFallbackToAuthServer(error: unknown): boolean {
  if (!env.supabaseAnonKey) {
    return false;
  }

  return (
    error instanceof joseErrors.JOSEError ||
    (error instanceof Error && error.message.includes("JWKS")) ||
    (error instanceof Error && error.message.includes("no applicable key"))
  );
}

export async function verifySupabaseAccessToken(token: string): Promise<AuthenticatedSupabaseUser> {
  try {
    const claims = await verifyWithConfiguredStrategy(token);
    return normalizeClaimsUser(token, claims);
  } catch (error) {
    if (shouldFallbackToAuthServer(error)) {
      return fetchUserFromSupabaseAuth(token);
    }

    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(401, "Invalid or expired Supabase access token.", { cause: error });
  }
}
