export const KIOSK_PIN_LENGTH = 6;

export type KioskPairingMethod = "qr" | "login";
export type KioskDeviceStatus = "active" | "revoked" | "pending";
export type KioskHealthState = "healthy" | "attention" | "offline";
export type KioskEnvironment = "api";
export type PairingActorRole = "org_owner" | "org_admin" | "property_admin" | "manager";
export type ClockActionType = "clock-in" | "clock-out";
export type CameraMode = "preview" | "scan" | "test";

export type OrganizationSummary = {
  id: string;
  name: string;
};

export type PropertySummary = {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  timezone: string;
  status: "active" | "inactive" | "archived";
};

export type KioskDeviceSummary = {
  id: string;
  deviceName: string;
  deviceCode: string;
  deviceIdentifier: string;
  status: KioskDeviceStatus;
  pairingMethod: KioskPairingMethod;
  pairedAt: string;
  lastSeenAt: string;
};

export type KioskDeviceBinding = {
  organization: OrganizationSummary;
  property: PropertySummary;
  device: KioskDeviceSummary;
};

export type KioskBrandingConfig = {
  instructionText: string;
  welcomeLabel: string;
  supportLabel: string;
  requiresPhotoCapture: boolean;
};

export type KioskHealthSummary = {
  state: KioskHealthState;
  message: string;
  lastSyncAt: string | null;
  isOnline?: boolean;
  pendingSyncCount?: number;
  failedSyncCount?: number;
  conflictCount?: number;
};

export type PersistedKioskSession = {
  binding: KioskDeviceBinding;
  branding: KioskBrandingConfig;
  deviceAuthToken: string;
  environment: KioskEnvironment;
  storedAt: string;
};

export type PairingQrPayload = {
  kind: "workforce.kiosk_pairing";
  token: string;
  expiresAt?: string;
};

export type PairingLoginCredentials = {
  email: string;
  password: string;
  deviceName: string;
};

export type PairingAuthorizedUser = {
  id: string;
  fullName: string;
  email: string;
  role: PairingActorRole;
  organization: OrganizationSummary;
  allowedProperties: PropertySummary[];
};

export type PairKioskWithLoginInput = {
  authorizedUserId: string;
  propertyId: string;
  deviceName: string;
};

export type PairingResult = {
  binding: KioskDeviceBinding;
  branding: KioskBrandingConfig;
  deviceAuthToken: string;
  pairedBy: {
    id: string;
    fullName: string;
    role: PairingActorRole;
    method: KioskPairingMethod;
  };
};

export type PairingTokenResult = {
  token: string;
  expiresAt: string;
};

export type EmployeeKioskProfile = {
  id: string;
  organizationId: string;
  propertyId: string;
  firstName: string;
  lastName: string;
  employeeCode: string | null;
  employmentStatus: string;
};

export type EmployeeValidationFailureCode =
  | "invalid_pin"
  | "inactive_employee"
  | "open_shift_conflict"
  | "unauthorized_property";

export type EmployeeValidationSuccess = {
  ok: true;
  employee: EmployeeKioskProfile;
  nextAction: ClockActionType;
  requiresPhotoCapture: boolean;
};

export type EmployeeValidationFailure = {
  ok: false;
  code: EmployeeValidationFailureCode;
  title: string;
  message: string;
};

export type EmployeeValidationResult = EmployeeValidationSuccess | EmployeeValidationFailure;

export type CreateClockEventInput = {
  binding: KioskDeviceBinding;
  employee: EmployeeKioskProfile;
  action: ClockActionType;
  capturedImageUri: string | null;
  occurredAt: string;
};

export type ClockEventFailureCode =
  | "duplicate_clock_in"
  | "duplicate_clock_out"
  | "camera_failure"
  | "unauthorized_property";

export type ClockEventSuccess = {
  ok: true;
  action: ClockActionType;
  employee: EmployeeKioskProfile;
  occurredAt: string;
  title: string;
  message: string;
  pendingSync?: boolean;
};

export type ClockEventFailure = {
  ok: false;
  code: ClockEventFailureCode;
  action: ClockActionType;
  employee: EmployeeKioskProfile | null;
  occurredAt: string;
  title: string;
  message: string;
};

export type ClockEventResult = ClockEventSuccess | ClockEventFailure;

export type ClockFlowResult =
  | {
      kind: "pairing";
      success: true;
      title: string;
      message: string;
    }
  | {
      kind: "clock";
      success: boolean;
      title: string;
      message: string;
      employeeName?: string;
      actionLabel?: string;
    };

export type CameraTestResult = {
  ok: true;
  message: string;
} | {
  ok: false;
  message: string;
};
