import type { ClockActionType, EmployeeKioskProfile, KioskDeviceBinding } from "./kiosk";

export type ClockEventType = "IN" | "OUT";
export type ClockEventSource = "KIOSK";
export type ClockEventSyncStatus = "PENDING" | "SYNCED" | "FAILED" | "CONFLICT";
export type OutboxOperation = "CLOCK_EVENT_CREATE";
export type OutboxStatus = "PENDING" | "PROCESSING" | "SYNCED" | "FAILED";
export type SyncEventResultStatus = "ACCEPTED" | "DUPLICATE" | "REJECTED" | "CONFLICT";

export type LocalClockEvent = {
  id: number;
  clientEventId: string;
  serverEventId: string | null;
  employeeId: string;
  propertyId: string;
  type: ClockEventType;
  timestamp: string;
  source: ClockEventSource;
  photoPath: string | null;
  syncStatus: ClockEventSyncStatus;
  syncAttempts: number;
  lastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OutboxItem = {
  id: number;
  clientEventId: string;
  operation: OutboxOperation;
  payloadJson: string;
  status: OutboxStatus;
  attempts: number;
  nextRetryAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClockEventOutboxPayload = {
  clientEventId: string;
  employeeId: string;
  propertyId: string;
  type: ClockEventType;
  deviceTimestamp: string;
  source: ClockEventSource;
  photo: {
    localPath: string;
  } | null;
};

export type CachedEmployee = EmployeeKioskProfile & {
  pinHash: string;
  pinSalt: string;
  cachedAt: string;
};

export type LocalClockCreationInput = {
  action: ClockActionType;
  binding: KioskDeviceBinding;
  capturedImageUri: string | null;
  employee: EmployeeKioskProfile;
  occurredAt: string;
};

export type SyncClockEventsRequest = {
  kioskDeviceId: string;
  propertyId: string;
  events: Array<{
    clientEventId: string;
    employeeId: string;
    type: ClockEventType;
    deviceTimestamp: string;
    estimatedServerTimestamp?: string | null;
    source: ClockEventSource;
    photo?: {
      localPath: string;
    } | null;
  }>;
};

export type SyncClockEventsResponse = {
  serverTime: string;
  results: Array<{
    clientEventId: string;
    status: SyncEventResultStatus;
    serverEventId?: string | null;
    message?: string | null;
  }>;
};

export type SyncSummary = {
  pendingCount: number;
  failedCount: number;
  conflictCount: number;
  lastSuccessfulSyncAt: string | null;
};

export function clockActionToEventType(action: ClockActionType): ClockEventType {
  return action === "clock-in" ? "IN" : "OUT";
}

export function clockEventTypeToAction(type: ClockEventType): ClockActionType {
  return type === "IN" ? "clock-in" : "clock-out";
}
