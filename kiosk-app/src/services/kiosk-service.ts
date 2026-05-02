import Constants from "expo-constants";

import { createOfflineClockService } from "./offlineClock.service";
import { getNetworkStatus, isOnline, subscribeToNetworkStatus, type NetworkStatus } from "./network.service";
import { syncPendingClockEvents } from "./sync/clockEventSync.service";
import type { SyncClockEventsRequest, SyncClockEventsResponse } from "../types/offlineClock";
import type {
  ClockEventResult,
  CreateClockEventInput,
  EmployeeKioskProfile,
  EmployeeValidationResult,
  KioskBrandingConfig,
  KioskDeviceBinding,
  KioskHealthSummary,
  PairingAuthorizedUser,
  PairingLoginCredentials,
  PairingQrPayload,
  PairingResult,
  PairingTokenResult,
  PairKioskWithLoginInput,
  PropertySummary,
} from "../types/kiosk";

type CurrentUserResponse = {
  id: string;
  email: string;
  fullName: string | null;
};

type ClientOrganization = {
  id: string;
  name: string;
  role: string;
  properties: PropertySummary[];
};

type PublicDeviceSummary = {
  id: string;
  propertyId: string;
  propertyName: string;
  organizationId: string;
  organizationName: string;
  timezone: string;
  deviceName: string;
  deviceType: "desktop" | "kiosk" | "mobile" | "other" | "tablet";
  pairingCode: string;
  status: "active" | "blocked" | "inactive" | "retired";
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type VerifyPinResponse = {
  employee: {
    id: string;
    organizationId: string;
    propertyId: string;
    firstName: string;
    lastName: string;
    employeeCode: string | null;
    employmentStatus: string;
  };
  nextAction: "clock-in" | "clock-out";
  requiresPhotoCapture: boolean;
};

type DeviceRegistrationResponse = {
  authToken: string;
  device: PublicDeviceSummary;
};

type KioskApiErrorShape = {
  error?: string;
  message?: string;
};

type KioskApiError = Error & {
  statusCode?: number;
};

export type KioskService = {
  fetchCurrentKioskDeviceBinding: (deviceAuthToken: string) => Promise<KioskDeviceBinding | null>;
  fetchPropertyBranding: (binding: KioskDeviceBinding) => Promise<KioskBrandingConfig>;
  fetchHealthStatus: (binding: KioskDeviceBinding | null) => Promise<KioskHealthSummary>;
  generatePairingToken: (propertyId: string) => Promise<PairingTokenResult>;
  parsePairingQrData: (rawValue: string) => PairingQrPayload;
  authenticatePairingUser: (credentials: PairingLoginCredentials) => Promise<PairingAuthorizedUser>;
  pairKioskWithQr: (payload: PairingQrPayload, deviceName: string) => Promise<PairingResult>;
  pairKioskWithAuthorizedLogin: (input: PairKioskWithLoginInput) => Promise<PairingResult>;
  unpairKiosk: (binding: KioskDeviceBinding) => Promise<void>;
  validateEmployeePin: (binding: KioskDeviceBinding, pin: string) => Promise<EmployeeValidationResult>;
  createClockEvent: (input: CreateClockEventInput) => Promise<ClockEventResult>;
  syncPendingClockEvents: (binding: KioskDeviceBinding) => Promise<void>;
  subscribeToNetworkStatus: (listener: (status: NetworkStatus) => void) => () => void;
};

const configuredBackendBaseUrl =
  process.env.EXPO_PUBLIC_BACKEND_URL?.replace(/\/+$/, "") ??
  (Constants.expoConfig?.extra?.backendUrl as string | undefined)?.replace(/\/+$/, "") ??
  null;

function parseExpoHost(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value.includes("://") ? value : `http://${value}`);
    return parsed.hostname || null;
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "::1";
}

function replaceLoopbackHost(baseUrl: string, nextHost: string): string {
  try {
    const parsed = new URL(baseUrl);

    if (!isLoopbackHost(parsed.hostname)) {
      return baseUrl;
    }

    parsed.hostname = nextHost;
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return baseUrl;
  }
}

function resolveBackendBaseUrl(): string {
  const expoHost =
    parseExpoHost(Constants.expoConfig?.hostUri) ??
    parseExpoHost(Constants.platform?.hostUri);

  if (configuredBackendBaseUrl) {
    return expoHost ? replaceLoopbackHost(configuredBackendBaseUrl, expoHost) : configuredBackendBaseUrl;
  }

  if (expoHost) {
    return `http://${expoHost}:4000`;
  }

  return "http://localhost:4000";
}

const backendBaseUrl = resolveBackendBaseUrl();

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") ??
  (Constants.expoConfig?.extra?.supabaseUrl as string | undefined)?.replace(/\/+$/, "") ??
  "";

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  (Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined) ??
  "";

function requireBackendBaseUrl(): string {
  if (!backendBaseUrl) {
    throw new Error("EXPO_PUBLIC_BACKEND_URL is required for kiosk API calls.");
  }

  return backendBaseUrl;
}

function requireSupabaseConfig(): { anonKey: string; url: string } {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are required for kiosk login pairing.");
  }

  return {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
  };
}

async function parseJson<T>(response: Response): Promise<T | null> {
  const rawText = await response.text();

  if (!rawText) {
    return null;
  }

  return JSON.parse(rawText) as T;
}

async function requestBackend<T>(
  path: string,
  options?: {
    authToken?: string | null;
    body?: unknown;
    deviceToken?: string | null;
    method?: "GET" | "POST";
  }
): Promise<T> {
  const baseUrl = requireBackendBaseUrl();
  const headers = new Headers({
    Accept: "application/json",
  });

  if (options?.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options?.authToken) {
    headers.set("Authorization", `Bearer ${options.authToken}`);
  } else if (options?.deviceToken) {
    headers.set("Authorization", `Bearer ${options.deviceToken}`);
  }

  let response: Response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options?.method ?? "GET",
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error(
      `Unable to reach the kiosk backend at ${baseUrl}. In Expo Go, point EXPO_PUBLIC_BACKEND_URL at your computer's LAN address if localhost is not reachable.`
    );
  }

  const payload = await parseJson<KioskApiErrorShape | T>(response);

  if (!response.ok) {
    const errorPayload = payload as KioskApiErrorShape | null;
    const error = new Error(
      errorPayload && typeof errorPayload === "object"
        ? errorPayload.error ?? errorPayload.message ?? "Request failed."
        : "Request failed."
    ) as KioskApiError;
    error.statusCode = response.status;
    throw error;
  }

  return payload as T;
}

async function signInPairingUser(email: string, password: string): Promise<string> {
  const { anonKey, url } = requireSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });
  const payload = (await parseJson<{
    access_token?: string;
    error_description?: string;
    msg?: string;
  }>(response)) ?? { msg: "Unable to sign in." };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? payload.msg ?? "Unable to sign in.");
  }

  return payload.access_token;
}

function parseJsonQrPayload(rawValue: string): PairingQrPayload | null {
  try {
    const value = JSON.parse(rawValue) as Partial<PairingQrPayload>;

    if (value.kind === "workforce.kiosk_pairing" && typeof value.token === "string") {
      return {
        kind: "workforce.kiosk_pairing",
        token: value.token,
        expiresAt: value.expiresAt,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function parseUrlQrPayload(rawValue: string): PairingQrPayload | null {
  try {
    const parsed = new URL(rawValue);
    const token = parsed.searchParams.get("token");

    if (!token) {
      return null;
    }

    if (parsed.protocol === "workforce:" || parsed.hostname.includes("workforce")) {
      return {
        kind: "workforce.kiosk_pairing",
        token,
        expiresAt: parsed.searchParams.get("expiresAt") ?? undefined,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function mapRole(roleName: string): PairingAuthorizedUser["role"] {
  const normalized = roleName.trim().toLowerCase();

  if (normalized === "owner") {
    return "org_owner";
  }

  if (normalized === "admin") {
    return "org_admin";
  }

  if (normalized.includes("property")) {
    return "property_admin";
  }

  return "manager";
}

function buildBranding(binding: KioskDeviceBinding): KioskBrandingConfig {
  return {
    welcomeLabel: binding.property.name,
    instructionText: "Enter PIN to clock in or out",
    supportLabel: `${binding.property.name} kiosk`,
    requiresPhotoCapture: false,
  };
}

function mapDeviceToBinding(device: PublicDeviceSummary): KioskDeviceBinding {
  const pairedAt = device.createdAt;

  return {
    organization: {
      id: device.organizationId,
      name: device.organizationName,
    },
    property: {
      id: device.propertyId,
      organizationId: device.organizationId,
      name: device.propertyName,
      code: null,
      timezone: device.timezone,
      status: "active",
    },
    device: {
      id: device.id,
      deviceName: device.deviceName,
      deviceCode: device.pairingCode,
      deviceIdentifier: device.id,
      status: device.status === "active" ? "active" : "revoked",
      pairingMethod: "qr",
      pairedAt,
      lastSeenAt: device.lastSeenAt ?? pairedAt,
    },
  };
}

function mapValidationError(error: unknown): EmployeeValidationResult {
  const message = error instanceof Error ? error.message : "Unable to validate PIN.";

  if (message.includes("PIN not recognized")) {
    return {
      ok: false,
      code: "invalid_pin",
      title: "PIN not recognized",
      message: "Check the PIN and try again.",
    };
  }

  if (message.includes("inactive")) {
    return {
      ok: false,
      code: "inactive_employee",
      title: "Employee inactive",
      message: "This employee is no longer active for clock events.",
    };
  }

  if (message.includes("another property")) {
    return {
      ok: false,
      code: "open_shift_conflict",
      title: "Open shift elsewhere",
      message: "This employee already has an open shift at another property.",
    };
  }

  return {
    ok: false,
    code: "unauthorized_property",
    title: "Property access blocked",
    message: "This employee is not assigned to the current property.",
  };
}

function mapClockEventFailure(input: CreateClockEventInput, error: unknown): ClockEventResult {
  const message = error instanceof Error ? error.message : "Unable to record the clock event.";

  if (message.includes("already has an open shift")) {
    return {
      ok: false,
      code: "duplicate_clock_in",
      action: input.action,
      employee: input.employee,
      occurredAt: input.occurredAt,
      title: "Already clocked in",
      message: "A recent clock-in already exists for this employee.",
    };
  }

  if (message.includes("does not have an open shift")) {
    return {
      ok: false,
      code: "duplicate_clock_out",
      action: input.action,
      employee: input.employee,
      occurredAt: input.occurredAt,
      title: "Already clocked out",
      message: "A recent clock-out already exists for this employee.",
    };
  }

  return {
    ok: false,
    code: "unauthorized_property",
    action: input.action,
    employee: input.employee,
    occurredAt: input.occurredAt,
    title: "Clock event failed",
    message,
  };
}

export function createKioskService(): KioskService {
  let activeDeviceAuthToken: string | null = null;
  const offlineClockService = createOfflineClockService();
  const pairingSessions = new Map<
    string,
    {
      accessToken: string;
      authorizedUser: PairingAuthorizedUser;
    }
  >();

  return {
    async fetchCurrentKioskDeviceBinding(deviceAuthToken) {
      activeDeviceAuthToken = deviceAuthToken;

      try {
        const response = await requestBackend<{ device: PublicDeviceSummary }>("/api/public/time/devices/me", {
          deviceToken: deviceAuthToken,
        });

        return mapDeviceToBinding(response.device);
      } catch (error) {
        const typedError = error as KioskApiError;

        if (typedError.statusCode === 401 || typedError.statusCode === 403) {
          return null;
        }

        throw error;
      }
    },

    async fetchPropertyBranding(binding) {
      return buildBranding(binding);
    },

    async fetchHealthStatus(binding) {
      const summary = await offlineClockService.getSummary();

      if (!binding || !activeDeviceAuthToken) {
        return {
          state: "attention",
          message: "Kiosk is waiting for property pairing.",
          lastSyncAt: null,
          isOnline: false,
          pendingSyncCount: summary.pendingCount,
          failedSyncCount: summary.failedCount,
          conflictCount: summary.conflictCount,
        };
      }

      try {
        await requestBackend<{ device: PublicDeviceSummary }>("/api/public/time/devices/me", {
          deviceToken: activeDeviceAuthToken,
        });
        await offlineClockService.markSuccessfulSync();
        const refreshedSummary = await offlineClockService.getSummary();

        return {
          state: "healthy",
          message:
            refreshedSummary.pendingCount > 0
              ? `${refreshedSummary.pendingCount} clock event${refreshedSummary.pendingCount === 1 ? "" : "s"} pending sync.`
              : "Device session healthy.",
          lastSyncAt: refreshedSummary.lastSuccessfulSyncAt ?? new Date().toISOString(),
          isOnline: true,
          pendingSyncCount: refreshedSummary.pendingCount,
          failedSyncCount: refreshedSummary.failedCount,
          conflictCount: refreshedSummary.conflictCount,
        };
      } catch {
        const refreshedSummary = await offlineClockService.getSummary();
        return {
          state: "offline",
          message:
            refreshedSummary.conflictCount > 0
              ? `${refreshedSummary.conflictCount} clock event${refreshedSummary.conflictCount === 1 ? "" : "s"} need admin review.`
              : "Offline. Clock events will be saved locally while allowed.",
          lastSyncAt: refreshedSummary.lastSuccessfulSyncAt,
          isOnline: false,
          pendingSyncCount: refreshedSummary.pendingCount,
          failedSyncCount: refreshedSummary.failedCount,
          conflictCount: refreshedSummary.conflictCount,
        };
      }
    },

    async generatePairingToken(_propertyId) {
      throw new Error("Generate kiosk pairing tokens from the property dashboard.");
    },

    parsePairingQrData(rawValue) {
      const jsonPayload = parseJsonQrPayload(rawValue);

      if (jsonPayload) {
        return jsonPayload;
      }

      const urlPayload = parseUrlQrPayload(rawValue);

      if (urlPayload) {
        return urlPayload;
      }

      throw new Error("QR code is not a valid Workforce kiosk pairing token.");
    },

    async authenticatePairingUser(credentials) {
      const accessToken = await signInPairingUser(credentials.email.trim(), credentials.password);
      const [currentUserResponse, organizationsResponse] = await Promise.all([
        requestBackend<{ user: CurrentUserResponse }>("/api/client/auth/me", {
          authToken: accessToken,
        }),
        requestBackend<{ organizations: ClientOrganization[] }>("/api/client/organizations", {
          authToken: accessToken,
        }),
      ]);

      const organizations = organizationsResponse.organizations;

      if (organizations.length === 0) {
        throw new Error("This account does not have access to any organization properties.");
      }

      const allowedProperties = organizations.flatMap((organization) => organization.properties);
      const preferredOrganization = organizations[0];

      if (!preferredOrganization || allowedProperties.length === 0) {
        throw new Error("This account does not have access to any properties.");
      }

      const authorizedUser: PairingAuthorizedUser = {
        id: currentUserResponse.user.id,
        fullName: currentUserResponse.user.fullName ?? credentials.email.trim(),
        email: currentUserResponse.user.email,
        role: mapRole(preferredOrganization.role),
        organization: {
          id: preferredOrganization.id,
          name: preferredOrganization.name,
        },
        allowedProperties,
      };

      pairingSessions.set(authorizedUser.id, {
        accessToken,
        authorizedUser,
      });

      return authorizedUser;
    },

    async pairKioskWithQr(payload, deviceName) {
      const result = await requestBackend<DeviceRegistrationResponse>("/api/public/time/pairing/qr/complete", {
        method: "POST",
        body: {
          token: payload.token,
          deviceName,
          deviceType: "kiosk",
        },
      });
      activeDeviceAuthToken = result.authToken;
      const binding = mapDeviceToBinding(result.device);

      return {
        binding: {
          ...binding,
          device: {
            ...binding.device,
            pairingMethod: "qr",
          },
        },
        branding: buildBranding(binding),
        deviceAuthToken: result.authToken,
        pairedBy: {
          id: "qr-admin",
          fullName: "Authorized admin",
          role: "org_admin",
          method: "qr",
        },
      };
    },

    async pairKioskWithAuthorizedLogin(input) {
      const pairingSession = pairingSessions.get(input.authorizedUserId);

      if (!pairingSession) {
        throw new Error("Authorized pairing session has expired. Sign in again.");
      }

      const result = await requestBackend<DeviceRegistrationResponse>(
        `/api/client/properties/${encodeURIComponent(input.propertyId)}/time/devices`,
        {
          authToken: pairingSession.accessToken,
          method: "POST",
          body: {
            deviceName: input.deviceName,
            deviceType: "kiosk",
          },
        }
      );
      activeDeviceAuthToken = result.authToken;
      const binding = mapDeviceToBinding(result.device);

      return {
        binding: {
          ...binding,
          device: {
            ...binding.device,
            pairingMethod: "login",
          },
        },
        branding: buildBranding(binding),
        deviceAuthToken: result.authToken,
        pairedBy: {
          id: pairingSession.authorizedUser.id,
          fullName: pairingSession.authorizedUser.fullName,
          role: pairingSession.authorizedUser.role,
          method: "login",
        },
      };
    },

    async unpairKiosk(_binding) {
      activeDeviceAuthToken = null;
    },

    async validateEmployeePin(binding, pin) {
      if (!activeDeviceAuthToken) {
        return {
          ok: false,
          code: "unauthorized_property",
          title: "Kiosk not paired",
          message: "This kiosk does not have an active device session.",
        };
      }

      const networkStatus = await getNetworkStatus();

      if (!isOnline(networkStatus)) {
        const cachedValidation = await offlineClockService.validateCachedPin(binding, pin);

        if (cachedValidation.ok) {
          return cachedValidation;
        }

        return {
          ok: false,
          code: "invalid_pin",
          title: cachedValidation.title,
          message: cachedValidation.message,
        };
      }

      try {
        const result = await requestBackend<VerifyPinResponse>("/api/public/time/devices/verify-pin", {
          deviceToken: activeDeviceAuthToken,
          method: "POST",
          body: {
            pin,
          },
        });
        const employee = {
          id: result.employee.id,
          organizationId: result.employee.organizationId,
          propertyId: result.employee.propertyId,
          firstName: result.employee.firstName,
          lastName: result.employee.lastName,
          employeeCode: result.employee.employeeCode,
          employmentStatus: result.employee.employmentStatus,
        } satisfies EmployeeKioskProfile;

        await offlineClockService.cacheValidatedEmployeePin(employee, pin);
        await offlineClockService.markSuccessfulSync();

        return {
          ok: true,
          employee,
          nextAction: await offlineClockService.resolveNextAction(employee.id, binding.property.id, result.nextAction),
          requiresPhotoCapture: result.requiresPhotoCapture,
        };
      } catch (error) {
        const cachedValidation = await offlineClockService.validateCachedPin(binding, pin);

        if (cachedValidation.ok) {
          return cachedValidation;
        }

        return mapValidationError(error);
      }
    },

    async createClockEvent(input) {
      if (!activeDeviceAuthToken) {
        return {
          ok: false,
          code: "unauthorized_property",
          action: input.action,
          employee: input.employee,
          occurredAt: input.occurredAt,
          title: "Kiosk not paired",
          message: "This kiosk does not have an active device session.",
        };
      }

      try {
        await offlineClockService.createLocalClockEvent(input);

        if (isOnline(await getNetworkStatus())) {
          await syncPendingClockEvents({
            binding: input.binding,
            postClockEvents: (body) =>
              requestBackend<SyncClockEventsResponse>("/api/public/time/devices/sync/clock-events", {
                deviceToken: activeDeviceAuthToken,
                method: "POST",
                body,
              }),
          });
        }

        const summary = await offlineClockService.getSummary();
        const pendingSync = summary.pendingCount > 0;

        return {
          ok: true,
          action: input.action,
          employee: input.employee,
          occurredAt: input.occurredAt,
          title: input.action === "clock-in" ? "Clock-in saved" : "Clock-out saved",
          message:
            input.action === "clock-in"
              ? pendingSync
                ? "Shift has started on this kiosk and will sync when online."
                : "Shift has started on this kiosk."
              : pendingSync
                ? "Shift has been closed on this kiosk and will sync when online."
                : "Shift has been closed out successfully.",
          pendingSync,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "";

        if (message === "duplicate_clock_in") {
          return mapClockEventFailure(input, new Error("already has an open shift"));
        }

        if (message === "duplicate_clock_out") {
          return mapClockEventFailure(input, new Error("does not have an open shift"));
        }

        return mapClockEventFailure(input, error);
      }
    },

    async syncPendingClockEvents(binding) {
      if (!activeDeviceAuthToken || !isOnline(await getNetworkStatus())) {
        return;
      }

      await syncPendingClockEvents({
        binding,
        postClockEvents: (body: SyncClockEventsRequest) =>
          requestBackend<SyncClockEventsResponse>("/api/public/time/devices/sync/clock-events", {
            deviceToken: activeDeviceAuthToken,
            method: "POST",
            body,
          }),
      });
    },

    subscribeToNetworkStatus(listener) {
      return subscribeToNetworkStatus(listener);
    },
  };
}
