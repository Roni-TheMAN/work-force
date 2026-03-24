import { env } from "./env";
import { getSupabaseSession } from "./supabase";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  lastActiveOrganizationId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaidPlanId = "pro" | "enterprise";
export type OrganizationPlanId = "free" | "pro" | "enterprise";

export type CheckoutSessionResponse = {
  clientSecret: string;
  sessionId: string;
};

export type ClientOrganization = {
  id: string;
  slug: string;
  name: string;
  legalName: string | null;
  timezone: string;
  status: string;
  role: string;
  joinedAt: string | null;
  createdAt: string;
  updatedAt: string;
  properties: ClientProperty[];
};

export type ClientProperty = {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  timezone: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  countryCode: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateOrganizationPayload = {
  legalName: string | null;
  name: string;
  planId: OrganizationPlanId;
  slug: string;
  timezone: string;
};

export type CreatePropertyPayload = {
  organizationId: string;
  name: string;
  code: string | null;
  timezone: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  countryCode: string | null;
  status: "active" | "inactive" | "archived";
};

type ApiErrorResponse = {
  error?: string;
};

type ApiRequestOptions = {
  auth?: boolean;
  body?: unknown;
  method?: "GET" | "POST";
  signal?: AbortSignal;
};

export class ApiError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

async function getAccessToken(): Promise<string> {
  const session = await getSupabaseSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new ApiError(401, "You must be signed in to perform this request.");
  }

  return accessToken;
}

async function parseJson<T>(response: Response): Promise<T | null> {
  const responseText = await response.text();

  if (!responseText) {
    return null;
  }

  return JSON.parse(responseText) as T;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { auth = false, body, method = "GET", signal } = options;
  const headers = new Headers({
    Accept: "application/json",
  });

  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (auth) {
    headers.set("Authorization", `Bearer ${await getAccessToken()}`);
  }

  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  const payload = await parseJson<ApiErrorResponse | T>(response);

  if (!response.ok) {
    const errorMessage =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Request failed.";

    throw new ApiError(response.status, errorMessage);
  }

  return payload as T;
}

export async function fetchCurrentUser(signal?: AbortSignal): Promise<CurrentUser> {
  const response = await apiRequest<{ user: CurrentUser }>("/api/client/auth/me", {
    auth: true,
    signal,
  });

  return response.user;
}

export async function createCheckoutSession(planId: PaidPlanId): Promise<CheckoutSessionResponse> {
  return apiRequest<CheckoutSessionResponse>("/api/client/billing/checkout-session", {
    auth: true,
    method: "POST",
    body: { planId },
  });
}

export async function createOrganization(payload: CreateOrganizationPayload): Promise<ClientOrganization> {
  const response = await apiRequest<{ organization: ClientOrganization }>("/api/client/organizations", {
    auth: true,
    method: "POST",
    body: payload,
  });

  return response.organization;
}

export async function fetchClientOrganizations(signal?: AbortSignal): Promise<ClientOrganization[]> {
  const response = await apiRequest<{ organizations: ClientOrganization[] }>("/api/client/organizations", {
    auth: true,
    signal,
  });

  return response.organizations;
}

export async function createProperty(payload: CreatePropertyPayload): Promise<ClientProperty> {
  const response = await apiRequest<{ property: ClientProperty }>("/api/client/properties", {
    auth: true,
    method: "POST",
    body: payload,
  });

  return response.property;
}
