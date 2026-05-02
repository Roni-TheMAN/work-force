import { apiRequest } from "@/lib/api";

export type TimePunchType = "clock_in" | "clock_out" | "break_start" | "break_end";

export type TimeTrackingBreak = {
  id: string;
  breakType: "meal" | "other" | "rest";
  paid: boolean;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  source: string;
  createdAt: string;
};

export type TimeTrackingShift = {
  id: string;
  organizationId: string;
  propertyId: string;
  employeeId: string;
  clockInPunchId: string;
  clockOutPunchId: string | null;
  startedAt: string;
  endedAt: string | null;
  businessDate: string;
  entryMode: string;
  status: string;
  totalMinutes: number | null;
  breakMinutes: number;
  payableMinutes: number | null;
  createdAt: string;
  updatedAt: string;
  hasAdjustments: boolean;
  payrollImpact: {
    locked: boolean;
    payrollPeriodId: string | null;
    payrollRunId: string | null;
    payrollRunStatus: string | null;
    payrollRunVersion: number | null;
  };
  breaks: TimeTrackingBreak[];
};

export type TimeTrackingPunch = {
  id: string;
  organizationId: string;
  propertyId: string;
  employeeId: string;
  propertyDeviceId: string | null;
  punchType: TimePunchType;
  occurredAt: string;
  businessDate: string;
  source: string;
  photoUrl: string | null;
  note: string | null;
  status: string;
  replacedByPunchId: string | null;
  createdByUserId: string | null;
  createdAt: string;
};

export type PropertyTimeDevice = {
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

export type RecordClientPunchPayload = {
  organizationId: string;
  propertyId: string;
  employeeId: string;
  note?: string | null;
  breakType?: "meal" | "other" | "rest" | null;
};

export type RegisterPropertyDevicePayload = {
  propertyId: string;
  deviceName: string;
  deviceType: "desktop" | "kiosk" | "mobile" | "other" | "tablet";
};

export type RetirePropertyDevicePayload = {
  propertyId: string;
  deviceId: string;
};

export type DeletePropertyDeviceRecordPayload = {
  propertyId: string;
  deviceId: string;
};

export type PropertyDevicePairingToken = {
  token: string;
  expiresAt: string;
  qrValue: string;
};

export type ShiftBreakInput = {
  breakType?: "meal" | "other" | "rest" | null;
  paid?: boolean | null;
  startedAt: string;
  endedAt?: string | null;
};

export type CreateManualShiftPayload = {
  organizationId: string;
  propertyId: string;
  employeeId: string;
  startedAt: string;
  endedAt: string;
  payableMinutes?: number | null;
  reason: string;
  breakSegments?: ShiftBreakInput[] | null;
};

export type AdjustShiftPayload = {
  organizationId: string;
  shiftSessionId: string;
  startedAt?: string | null;
  endedAt?: string | null;
  payableMinutes?: number | null;
  reason: string;
  breakSegments?: ShiftBreakInput[] | null;
};

export async function fetchOrganizationTimeShifts(
  organizationId: string,
  options?: {
    propertyId?: string | null;
    businessDateFrom?: string | null;
    businessDateTo?: string | null;
    employeeId?: string | null;
    status?: string | null;
    signal?: AbortSignal;
  }
): Promise<{
  shifts: TimeTrackingShift[];
  scope: {
    organizationId: string;
    employeeId: string | null;
    propertyIds: string[] | null;
  };
}> {
  const searchParams = new URLSearchParams();

  if (options?.propertyId) {
    searchParams.set("propertyId", options.propertyId);
  }

  if (options?.businessDateFrom) {
    searchParams.set("businessDateFrom", options.businessDateFrom);
  }

  if (options?.businessDateTo) {
    searchParams.set("businessDateTo", options.businessDateTo);
  }

  if (options?.employeeId) {
    searchParams.set("employeeId", options.employeeId);
  }

  if (options?.status) {
    searchParams.set("status", options.status);
  }

  return apiRequest(
    `/api/client/organizations/${encodeURIComponent(organizationId)}/time/shifts${
      searchParams.size > 0 ? `?${searchParams.toString()}` : ""
    }`,
    {
      auth: true,
      signal: options?.signal,
    }
  );
}

export async function fetchPropertyTimeShifts(
  organizationId: string,
  propertyId: string,
  options?: {
    businessDateFrom?: string | null;
    businessDateTo?: string | null;
    employeeId?: string | null;
    status?: string | null;
    signal?: AbortSignal;
  }
): Promise<{
  shifts: TimeTrackingShift[];
  scope: {
    organizationId: string;
    employeeId: string | null;
    propertyIds: string[] | null;
  };
}> {
  return fetchOrganizationTimeShifts(organizationId, {
    propertyId,
    businessDateFrom: options?.businessDateFrom,
    businessDateTo: options?.businessDateTo,
    employeeId: options?.employeeId,
    status: options?.status,
    signal: options?.signal,
  });
}

export async function recordClientPunch(punchType: TimePunchType, payload: RecordClientPunchPayload) {
  return apiRequest<{ punch: TimeTrackingPunch; shift: TimeTrackingShift }>(
    `/api/client/time/punches/${encodeURIComponent(punchType)}`,
    {
      auth: true,
      method: "POST",
      body: payload,
    }
  );
}

export async function fetchPropertyDevices(propertyId: string, signal?: AbortSignal): Promise<PropertyTimeDevice[]> {
  const response = await apiRequest<{ devices: PropertyTimeDevice[] }>(
    `/api/client/properties/${encodeURIComponent(propertyId)}/time/devices`,
    {
      auth: true,
      signal,
    }
  );

  return response.devices;
}

export async function registerPropertyDevice(payload: RegisterPropertyDevicePayload) {
  return apiRequest<{ authToken: string; device: PropertyTimeDevice }>(
    `/api/client/properties/${encodeURIComponent(payload.propertyId)}/time/devices`,
    {
      auth: true,
      method: "POST",
      body: {
        deviceName: payload.deviceName,
        deviceType: payload.deviceType,
      },
    }
  );
}

export async function retirePropertyDevice(payload: RetirePropertyDevicePayload) {
  const response = await apiRequest<{ device: PropertyTimeDevice }>(
    `/api/client/properties/${encodeURIComponent(payload.propertyId)}/time/devices/${encodeURIComponent(payload.deviceId)}`,
    {
      auth: true,
      method: "DELETE",
    }
  );

  return response.device;
}

export async function deletePropertyDeviceRecord(payload: DeletePropertyDeviceRecordPayload) {
  await apiRequest<void>(
    `/api/client/properties/${encodeURIComponent(payload.propertyId)}/time/devices/${encodeURIComponent(payload.deviceId)}/record`,
    {
      auth: true,
      method: "DELETE",
    }
  );
}

export async function createPropertyPairingToken(propertyId: string) {
  const response = await apiRequest<{ pairingToken: PropertyDevicePairingToken }>(
    `/api/client/properties/${encodeURIComponent(propertyId)}/time/pairing-tokens`,
    {
      auth: true,
      method: "POST",
    }
  );

  return response.pairingToken;
}

export async function createManualShift(payload: CreateManualShiftPayload) {
  return apiRequest<{ adjustmentId: string; shift: TimeTrackingShift }>(
    `/api/client/organizations/${encodeURIComponent(payload.organizationId)}/time/shifts`,
    {
      auth: true,
      method: "POST",
      body: {
        propertyId: payload.propertyId,
        employeeId: payload.employeeId,
        startedAt: payload.startedAt,
        endedAt: payload.endedAt,
        payableMinutes: payload.payableMinutes ?? null,
        reason: payload.reason,
        breakSegments: payload.breakSegments ?? null,
      },
    }
  );
}

export async function adjustShift(payload: AdjustShiftPayload) {
  return apiRequest<{ adjustmentId: string; shift: TimeTrackingShift }>(
    `/api/client/organizations/${encodeURIComponent(payload.organizationId)}/time/shifts/${encodeURIComponent(payload.shiftSessionId)}`,
    {
      auth: true,
      method: "PATCH",
      body: {
        startedAt: payload.startedAt ?? null,
        endedAt: payload.endedAt ?? null,
        payableMinutes: payload.payableMinutes ?? null,
        reason: payload.reason,
        breakSegments: payload.breakSegments ?? null,
      },
    }
  );
}
