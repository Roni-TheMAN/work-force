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
export type BillingAddonCode =
  | "advanced_analytics"
  | "api_access"
  | "extra_employees_50"
  | "extra_properties_5"
  | "sms_notifications";
export type BillingQuantityMode = "single" | "stackable";
export type BillingAddonSelection = {
  code: BillingAddonCode;
  quantity: number;
};

export type CheckoutSessionResponse = {
  clientSecret: string;
  sessionId: string;
};

export type BillingCatalogItem = {
  billingType: string | null;
  code: string;
  currency: string | null;
  description: string | null;
  entitlements: Array<{
    key: string;
    value: boolean | number | string | Record<string, unknown>;
  }>;
  intervalCount: number | null;
  kind: "addon" | "plan";
  name: string;
  quantityMode: BillingQuantityMode;
  recurringInterval: string | null;
  stripePriceId: string | null;
  stripeProductId: string;
  unitAmountCents: number | null;
};

export type BillingSubscriptionItem = {
  billingType: string | null;
  catalogCode: string;
  catalogKind: "addon" | "plan";
  catalogName: string;
  currency: string | null;
  endedAt: string | null;
  id: string;
  intervalCount: number | null;
  quantity: number;
  recurringInterval: string | null;
  stripePriceId: string;
  unitAmountCents: number | null;
};

export type BillingSummary = {
  availableAddons: BillingCatalogItem[];
  entitlements: Array<{
    id: string;
    organizationId: string;
    sourceCatalogItemId: string | null;
    sourceSubscriptionItemId: string | null;
    key: string;
    value: unknown;
    grantedBy: string;
    createdAt: string;
    updatedAt: string;
  }>;
  items: BillingSubscriptionItem[];
  organizationId: string;
  plans: BillingCatalogItem[];
  subscription: null | {
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
    checkoutSessionId: string | null;
    collectionMethod: string | null;
    createdAt: string;
    currentPeriodEnd: string | null;
    currentPeriodStart: string | null;
    defaultPaymentMethodId: string | null;
    endedAt: string | null;
    id: string;
    latestInvoiceId: string | null;
    monthlySubtotalCents: number;
    organizationId: string;
    plan: BillingSubscriptionItem | null;
    addons: BillingSubscriptionItem[];
    status: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    trialEnd: string | null;
    trialStart: string | null;
    updatedAt: string;
  };
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
  body?: BodyInit | unknown;
  method?: "DELETE" | "GET" | "PATCH" | "POST";
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

export async function getAccessToken(): Promise<string> {
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
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = new Headers({
    Accept: "application/json",
  });

  if (body !== undefined && !isFormData) {
    headers.set("Content-Type", "application/json");
  }

  if (auth) {
    headers.set("Authorization", `Bearer ${await getAccessToken()}`);
  }

  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? (isFormData ? body : JSON.stringify(body)) : undefined,
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

export async function checkSignUpEmailExists(email: string): Promise<boolean> {
  const response = await apiRequest<{ exists: boolean }>("/api/public/auth/email-exists", {
    method: "POST",
    body: { email },
  });

  return response.exists;
}

export async function createCheckoutSession(
  planId: PaidPlanId,
  organizationId: string,
  addons: BillingAddonSelection[] = []
): Promise<CheckoutSessionResponse> {
  return apiRequest<CheckoutSessionResponse>("/api/client/billing/checkout-session", {
    auth: true,
    method: "POST",
    body: { planId, organizationId, addons },
  });
}

export async function syncOrganizationCheckoutSession(payload: {
  organizationId: string;
  sessionId: string;
}): Promise<BillingSummary> {
  return apiRequest<BillingSummary>("/api/client/billing/checkout-sync", {
    auth: true,
    method: "POST",
    body: payload,
  });
}

export async function fetchOrganizationBillingSummary(
  organizationId: string,
  signal?: AbortSignal
): Promise<BillingSummary> {
  return apiRequest<BillingSummary>(`/api/client/billing/summary?organizationId=${encodeURIComponent(organizationId)}`, {
    auth: true,
    signal,
  });
}

export async function addOrganizationBillingAddon(payload: {
  organizationId: string;
  code: BillingAddonCode;
  quantity: number;
}): Promise<BillingSummary> {
  return apiRequest<BillingSummary>("/api/client/billing/subscription-items", {
    auth: true,
    method: "POST",
    body: payload,
  });
}

export async function updateOrganizationBillingAddon(payload: {
  organizationId: string;
  code: BillingAddonCode;
  quantity: number;
}): Promise<BillingSummary> {
  return apiRequest<BillingSummary>(`/api/client/billing/subscription-items/${encodeURIComponent(payload.code)}`, {
    auth: true,
    method: "PATCH",
    body: {
      organizationId: payload.organizationId,
      quantity: payload.quantity,
    },
  });
}

export async function removeOrganizationBillingAddon(payload: {
  organizationId: string;
  code: BillingAddonCode;
}): Promise<BillingSummary> {
  return apiRequest<BillingSummary>(`/api/client/billing/subscription-items/${encodeURIComponent(payload.code)}`, {
    auth: true,
    method: "DELETE",
    body: {
      organizationId: payload.organizationId,
    },
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
