import { createHash, randomBytes } from "node:crypto";

import { PERMISSIONS } from "../lib/permissions";
import { prisma } from "../lib/prisma";
import {
  getOrganizationMembership,
  getPermissionKeys,
  hasPropertyAccess,
  hasPropertyScopeBypassPermission,
} from "../lib/rbac";
import { HttpError } from "../lib/http-error";
import type { AuthenticatedSupabaseUser } from "../lib/supabase-auth";
import {
  buildEmployeePinLookupKey,
  EMPLOYEE_PIN_LENGTH,
  verifyEmployeePinHash,
} from "./employee-pin.service";
import { syncAuthenticatedUser } from "./user-sync.service";
import {
  collectPayrollRunIdsForShiftMutation,
  getPayrollImpactForShifts,
  revalidatePayrollRunsForShiftMutation,
} from "../modules/property/property-payroll-runs";
import { hasTimeManagementPermission, hasTimeReadPermission } from "./time-permissions";

type RawDbClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
};

type PunchType = "clock_in" | "clock_out" | "break_start" | "break_end";
type PunchSource = "admin" | "auto_close" | "import" | "kiosk" | "manual" | "mobile";
type BreakType = "meal" | "other" | "rest";
type ShiftStatus = "auto_closed" | "closed" | "edited" | "open";
type DeviceStatus = "active" | "blocked" | "inactive" | "retired";

type PropertyScopeRecord = {
  id: string;
  organizationId: string;
  name: string;
  status: string;
  timezone: string;
};

type EmployeeScopeRecord = {
  id: string;
  organizationId: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  employeeCode: string | null;
  employmentStatus: string;
};

type PropertyDeviceScopeRecord = {
  id: string;
  propertyId: string;
  propertyName: string;
  organizationId: string;
  organizationName: string;
  timezone: string;
  status: string;
  deviceName: string;
  deviceType: string;
  pairingCode: string;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type PropertyDevicePairingTokenRecord = {
  id: string;
  organizationId: string;
  propertyId: string;
  expiresAt: Date;
  consumedAt: Date | null;
};

type TimePunchRecord = {
  id: string;
  organizationId: string;
  propertyId: string;
  employeeId: string;
  propertyDeviceId: string | null;
  punchType: PunchType;
  occurredAt: Date;
  businessDate: Date;
  source: PunchSource;
  photoUrl: string | null;
  note: string | null;
  status: string;
  clientEventId: string | null;
  replacedByPunchId: string | null;
  createdByUserId: string | null;
  createdAt: Date;
};

type TimeShiftSessionRecord = {
  id: string;
  organizationId: string;
  propertyId: string;
  employeeId: string;
  clockInPunchId: string;
  clockOutPunchId: string | null;
  startedAt: Date;
  autoCloseAt: Date;
  endedAt: Date | null;
  businessDate: Date;
  entryMode: string;
  status: string;
  totalMinutes: number | null;
  breakMinutes: number;
  payableMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
};

type ShiftBreakSegmentRecord = {
  id: string;
  shiftSessionId: string;
  breakType: BreakType;
  paid: boolean;
  startedAt: Date;
  endedAt: Date | null;
  durationMinutes: number | null;
  source: string;
  createdAt: Date;
};

type TimeShiftSessionSummary = {
  id: string;
  organizationId: string;
  propertyId: string;
  employeeId: string;
  clockInPunchId: string;
  clockOutPunchId: string | null;
  startedAt: string;
  autoCloseAt: string;
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
  breaks: Array<{
    id: string;
    breakType: BreakType;
    paid: boolean;
    startedAt: string;
    endedAt: string | null;
    durationMinutes: number | null;
    source: string;
    createdAt: string;
  }>;
};

type TimePunchSummary = {
  id: string;
  organizationId: string;
  propertyId: string;
  employeeId: string;
  propertyDeviceId: string | null;
  punchType: PunchType;
  occurredAt: string;
  businessDate: string;
  source: PunchSource;
  photoUrl: string | null;
  note: string | null;
  status: string;
  replacedByPunchId: string | null;
  createdByUserId: string | null;
  createdAt: string;
};

type PropertyDeviceSummary = {
  id: string;
  propertyId: string;
  propertyName: string;
  organizationId: string;
  organizationName: string;
  timezone: string;
  deviceName: string;
  deviceType: string;
  pairingCode: string;
  status: DeviceStatus;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ClientPunchInput = {
  breakType?: string | null;
  employeeCode?: string | null;
  employeeId?: string | null;
  note?: string | null;
  occurredAt?: string | null;
  organizationId: string;
  paid?: boolean | null;
  photoUrl?: string | null;
  propertyId: string;
};

type DevicePunchInput = {
  breakType?: string | null;
  employeeCode?: string | null;
  employeeId?: string | null;
  note?: string | null;
  occurredAt?: string | null;
  paid?: boolean | null;
  photoUrl?: string | null;
};

type KioskClockEventSyncInput = {
  events: Array<{
    clientEventId?: string | null;
    employeeId?: string | null;
    type?: string | null;
    deviceTimestamp?: string | null;
    source?: string | null;
    photo?: {
      localPath?: string | null;
    } | null;
  }>;
  kioskDeviceId?: string | null;
  propertyId?: string | null;
};

type KioskClockEventSyncResult = {
  serverTime: string;
  results: Array<{
    clientEventId: string;
    status: "ACCEPTED" | "DUPLICATE" | "REJECTED" | "CONFLICT";
    serverEventId?: string | null;
    message?: string | null;
  }>;
};

type DeviceRegistrationInput = {
  deviceName: string;
  deviceType: string;
};

type ShiftAdjustmentInput = {
  breakSegments?:
    | Array<{
        breakType?: string | null;
        endedAt?: string | null;
        paid?: boolean | null;
        startedAt: string;
      }>
    | null;
  endedAt?: string | null;
  payableMinutes?: number | null;
  reason: string;
  startedAt?: string | null;
};

type ManualShiftCreateInput = {
  breakSegments?:
    | Array<{
        breakType?: string | null;
        endedAt?: string | null;
        paid?: boolean | null;
        startedAt: string;
      }>
    | null;
  employeeId: string;
  endedAt: string;
  payableMinutes?: number | null;
  propertyId: string;
  reason: string;
  startedAt: string;
};

type ShiftListFilters = {
  businessDateFrom?: string | null;
  businessDateTo?: string | null;
  employeeId?: string | null;
  propertyId?: string | null;
  status?: string | null;
};

type SessionComputation = {
  breakMinutes: number;
  payableMinutes: number | null;
  totalMinutes: number | null;
};

type NormalizedBreakSegmentInput = {
  breakType: BreakType;
  durationMinutes: number | null;
  endedAt: Date | null;
  paid: boolean;
  source: string;
  startedAt: Date;
};

type ShiftWithBreaks = {
  breaks: ShiftBreakSegmentRecord[];
  shift: TimeShiftSessionRecord;
};

type PunchMutationResult = {
  alreadyAutoClosed?: boolean;
  message?: string;
  punch: TimePunchSummary;
  shift: TimeShiftSessionSummary;
};

type ShiftAdjustmentResult = {
  adjustmentId: string;
  shift: TimeShiftSessionSummary;
};

type DeviceRegistrationResult = {
  authToken: string;
  device: PropertyDeviceSummary;
};

type PropertyDevicePairingTokenResult = {
  expiresAt: string;
  qrValue: string;
  token: string;
};

type DevicePinVerificationResult = {
  employee: {
    employeeCode: string | null;
    employmentStatus: string;
    firstName: string;
    id: string;
    lastName: string;
    organizationId: string;
    propertyId: string;
  };
  nextAction: "clock-in" | "clock-out";
  requiresPhotoCapture: boolean;
};

function getDbClient(db: RawDbClient = prisma): RawDbClient {
  return db;
}

function normalizeRequiredText(value: string | null | undefined, fieldName: string): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new HttpError(400, `${fieldName} is required.`);
  }

  return normalizedValue;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : null;
}

function normalizePunchType(value: string): PunchType {
  if (value === "clock_in" || value === "clock_out" || value === "break_start" || value === "break_end") {
    return value;
  }

  throw new HttpError(400, "punchType must be clock_in, clock_out, break_start, or break_end.");
}

function normalizePunchSource(value: PunchSource): PunchSource {
  if (
    value === "admin" ||
    value === "auto_close" ||
    value === "import" ||
    value === "kiosk" ||
    value === "manual" ||
    value === "mobile"
  ) {
    return value;
  }

  throw new HttpError(400, "Unsupported punch source.");
}

function normalizeBreakType(value: string | null | undefined): BreakType {
  if (!value || value === "meal") {
    return "meal";
  }

  if (value === "rest" || value === "other") {
    return value;
  }

  throw new HttpError(400, "breakType must be meal, rest, or other.");
}

function normalizeDeviceType(value: string): string {
  const normalizedValue = value.trim().toLowerCase();

  if (!["desktop", "kiosk", "mobile", "other", "tablet"].includes(normalizedValue)) {
    throw new HttpError(400, "deviceType must be kiosk, mobile, tablet, desktop, or other.");
  }

  return normalizedValue;
}

function normalizeShiftStatus(value: string | null | undefined): ShiftStatus | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (
    normalizedValue === "auto_closed" ||
    normalizedValue === "closed" ||
    normalizedValue === "edited" ||
    normalizedValue === "open"
  ) {
    return normalizedValue;
  }

  throw new HttpError(400, "status must be open, closed, auto_closed, or edited.");
}

function parseOptionalDateTime(value: string | null | undefined, fieldName: string): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedValue = new Date(value);

  if (Number.isNaN(parsedValue.getTime())) {
    throw new HttpError(400, `${fieldName} must be a valid datetime.`);
  }

  return parsedValue;
}

function parseRequiredDateTime(value: string | null | undefined, fieldName: string): Date {
  const parsedValue = parseOptionalDateTime(value, fieldName);

  if (!parsedValue) {
    throw new HttpError(400, `${fieldName} is required.`);
  }

  return parsedValue;
}

function parsePositiveInteger(value: number | null | undefined, fieldName: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new HttpError(400, `${fieldName} must be a non-negative integer.`);
  }

  return value;
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function minutesBetween(startedAt: Date, endedAt: Date): number {
  return Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 60000));
}

function buildBusinessDateForTimezone(timestamp: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(timestamp);
}

function buildPairingCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

function buildDeviceAuthToken(): string {
  return randomBytes(24).toString("hex");
}

function buildPairingToken(): string {
  return randomBytes(24).toString("hex");
}

function hashDeviceToken(token: string): string {
  return `sha256:${createHash("sha256").update(token).digest("hex")}`;
}

function hashPairingToken(token: string): string {
  return `sha256:${createHash("sha256").update(`pairing:${token}`).digest("hex")}`;
}

function normalizeEmployeePin(value: string | null | undefined): string {
  const normalizedValue = normalizeRequiredText(value, "pin");

  if (!/^\d{6}$/.test(normalizedValue)) {
    throw new HttpError(400, `PIN must be exactly ${EMPLOYEE_PIN_LENGTH} numeric digits.`);
  }

  return normalizedValue;
}

function normalizePaidFlag(value: boolean | null | undefined): boolean {
  return value === true;
}

function isEmploymentActive(status: string): boolean {
  const normalizedStatus = status.trim().toLowerCase();
  return normalizedStatus === "active";
}

function computeSessionTotals(
  startedAt: Date,
  endedAt: Date | null,
  breakSegments: NormalizedBreakSegmentInput[],
  payableMinutesOverride?: number | null
): SessionComputation {
  const closedBreakSegments = breakSegments.filter((segment) => segment.endedAt);
  const breakMinutes = closedBreakSegments.reduce((sum, segment) => sum + (segment.durationMinutes ?? 0), 0);

  if (!endedAt) {
    if (payableMinutesOverride !== null && payableMinutesOverride !== undefined) {
      throw new HttpError(400, "payableMinutes cannot be set while the shift is still open.");
    }

    return {
      breakMinutes,
      payableMinutes: null,
      totalMinutes: null,
    };
  }

  const totalMinutes = minutesBetween(startedAt, endedAt);
  const unpaidBreakMinutes = closedBreakSegments.reduce(
    (sum, segment) => sum + (segment.paid ? 0 : segment.durationMinutes ?? 0),
    0
  );
  const defaultPayableMinutes = Math.max(0, totalMinutes - unpaidBreakMinutes);

  if (payableMinutesOverride !== null && payableMinutesOverride !== undefined) {
    if (payableMinutesOverride > totalMinutes) {
      throw new HttpError(400, "payableMinutes cannot exceed total minutes.");
    }

    return {
      breakMinutes,
      payableMinutes: payableMinutesOverride,
      totalMinutes,
    };
  }

  return {
    breakMinutes,
    payableMinutes: defaultPayableMinutes,
    totalMinutes,
  };
}

function normalizeBreakSegmentsForAdjustment(
  value: ShiftAdjustmentInput["breakSegments"],
  shiftStartedAt: Date,
  shiftEndedAt: Date | null
): NormalizedBreakSegmentInput[] {
  if (value === undefined || value === null) {
    return [];
  }

  const normalizedSegments = value.map((segment, index): NormalizedBreakSegmentInput => {
    const startedAt = parseRequiredDateTime(segment.startedAt, `breakSegments[${index}].startedAt`);
    const endedAt = parseOptionalDateTime(segment.endedAt, `breakSegments[${index}].endedAt`);

    if (endedAt && endedAt < startedAt) {
      throw new HttpError(400, `breakSegments[${index}].endedAt must be on or after startedAt.`);
    }

    if (startedAt < shiftStartedAt) {
      throw new HttpError(400, `breakSegments[${index}] starts before the shift starts.`);
    }

    if (shiftEndedAt && startedAt > shiftEndedAt) {
      throw new HttpError(400, `breakSegments[${index}] starts after the shift ends.`);
    }

    if (shiftEndedAt && endedAt && endedAt > shiftEndedAt) {
      throw new HttpError(400, `breakSegments[${index}] ends after the shift ends.`);
    }

    return {
      breakType: normalizeBreakType(segment.breakType),
      paid: normalizePaidFlag(segment.paid),
      startedAt,
      endedAt,
      durationMinutes: endedAt ? minutesBetween(startedAt, endedAt) : null,
      source: "admin",
    };
  });

  return validateNormalizedBreakSegments(normalizedSegments, shiftStartedAt, shiftEndedAt);
}

function validateNormalizedBreakSegments(
  normalizedSegments: NormalizedBreakSegmentInput[],
  shiftStartedAt: Date,
  shiftEndedAt: Date | null
): NormalizedBreakSegmentInput[] {
  for (const [index, segment] of normalizedSegments.entries()) {
    if (segment.startedAt < shiftStartedAt) {
      throw new HttpError(400, `breakSegments[${index}] starts before the shift starts.`);
    }

    if (shiftEndedAt && !segment.endedAt) {
      throw new HttpError(400, `breakSegments[${index}] must end before the shift can be closed.`);
    }

    if (shiftEndedAt && segment.startedAt > shiftEndedAt) {
      throw new HttpError(400, `breakSegments[${index}] starts after the shift ends.`);
    }

    if (shiftEndedAt && segment.endedAt && segment.endedAt > shiftEndedAt) {
      throw new HttpError(400, `breakSegments[${index}] ends after the shift ends.`);
    }

    if (segment.endedAt && segment.endedAt < segment.startedAt) {
      throw new HttpError(400, `breakSegments[${index}].endedAt must be on or after startedAt.`);
    }
  }

  normalizedSegments.sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime());

  for (let index = 0; index < normalizedSegments.length; index += 1) {
    const currentSegment = normalizedSegments[index];
    const nextSegment = normalizedSegments[index + 1];

    if (!currentSegment) {
      continue;
    }

    if (!currentSegment.endedAt && index !== normalizedSegments.length - 1) {
      throw new HttpError(400, "Only the final break segment may remain open.");
    }

    if (!nextSegment) {
      continue;
    }

    const currentEnd = currentSegment.endedAt ?? currentSegment.startedAt;

    if (currentEnd > nextSegment.startedAt) {
      throw new HttpError(400, "breakSegments may not overlap.");
    }
  }

  return normalizedSegments;
}

function normalizePersistedBreakSegmentsForAdjustment(
  breaks: ShiftBreakSegmentRecord[],
  shiftStartedAt: Date,
  shiftEndedAt: Date | null
): NormalizedBreakSegmentInput[] {
  return validateNormalizedBreakSegments(
    breaks.map((segment) => ({
      breakType: segment.breakType,
      paid: segment.paid,
      startedAt: segment.startedAt,
      endedAt: segment.endedAt,
      durationMinutes: segment.durationMinutes,
      source: segment.source,
    })),
    shiftStartedAt,
    shiftEndedAt
  );
}

function toTimePunchSummary(record: TimePunchRecord): TimePunchSummary {
  return {
    id: record.id,
    organizationId: record.organizationId,
    propertyId: record.propertyId,
    employeeId: record.employeeId,
    propertyDeviceId: record.propertyDeviceId,
    punchType: record.punchType,
    occurredAt: record.occurredAt.toISOString(),
    businessDate: formatDateOnly(record.businessDate),
    source: record.source,
    photoUrl: record.photoUrl,
    note: record.note,
    status: record.status,
    replacedByPunchId: record.replacedByPunchId,
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt.toISOString(),
  };
}

function toPropertyDeviceSummary(record: PropertyDeviceScopeRecord): PropertyDeviceSummary {
  return {
    id: record.id,
    propertyId: record.propertyId,
    propertyName: record.propertyName,
    organizationId: record.organizationId,
    organizationName: record.organizationName,
    timezone: record.timezone,
    deviceName: record.deviceName,
    deviceType: record.deviceType,
    pairingCode: record.pairingCode,
    status: record.status as DeviceStatus,
    lastSeenAt: toIsoString(record.lastSeenAt),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildEmptyPayrollImpact(): TimeShiftSessionSummary["payrollImpact"] {
  return {
    payrollPeriodId: null,
    payrollRunId: null,
    payrollRunStatus: null,
    payrollRunVersion: null,
    locked: false,
  };
}

function toTimeShiftSessionSummary(
  record: TimeShiftSessionRecord,
  breaks: ShiftBreakSegmentRecord[],
  options?: {
    hasAdjustments?: boolean;
    payrollImpact?: TimeShiftSessionSummary["payrollImpact"];
  }
): TimeShiftSessionSummary {
  return {
    id: record.id,
    organizationId: record.organizationId,
    propertyId: record.propertyId,
    employeeId: record.employeeId,
    clockInPunchId: record.clockInPunchId,
    clockOutPunchId: record.clockOutPunchId,
    startedAt: record.startedAt.toISOString(),
    autoCloseAt: record.autoCloseAt.toISOString(),
    endedAt: toIsoString(record.endedAt),
    businessDate: formatDateOnly(record.businessDate),
    entryMode: record.entryMode,
    status: record.status,
    totalMinutes: record.totalMinutes,
    breakMinutes: record.breakMinutes,
    payableMinutes: record.payableMinutes,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    hasAdjustments: options?.hasAdjustments ?? false,
    payrollImpact: options?.payrollImpact ?? buildEmptyPayrollImpact(),
    breaks: breaks.map((segment) => ({
      id: segment.id,
      breakType: segment.breakType,
      paid: segment.paid,
      startedAt: segment.startedAt.toISOString(),
      endedAt: toIsoString(segment.endedAt),
      durationMinutes: segment.durationMinutes,
      source: segment.source,
      createdAt: segment.createdAt.toISOString(),
    })),
  };
}

async function ensureOrganizationMembership(localUserId: string, organizationId: string) {
  const membership = await getOrganizationMembership(localUserId, organizationId);

  if (!membership || membership.status !== "active") {
    throw new HttpError(403, "You do not have access to that organization.");
  }

  return membership;
}

async function loadPropertyScope(propertyId: string): Promise<PropertyScopeRecord> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      organizationId: true,
      name: true,
      status: true,
      timezone: true,
    },
  });

  if (!property) {
    throw new HttpError(404, "Property not found.");
  }

  return property;
}

async function ensurePropertyInOrganization(propertyId: string, organizationId: string): Promise<PropertyScopeRecord> {
  const property = await loadPropertyScope(propertyId);

  if (property.organizationId !== organizationId) {
    throw new HttpError(404, "Property not found in this organization.");
  }

  return property;
}

async function ensurePropertyScopeAccess(localUserId: string, organizationId: string, propertyId: string) {
  const permissionKeys = await getPermissionKeys(localUserId, organizationId);

  if (hasPropertyScopeBypassPermission(permissionKeys)) {
    return;
  }

  const allowed = await hasPropertyAccess(localUserId, propertyId);

  if (!allowed) {
    throw new HttpError(403, "You do not have access to that property.");
  }
}

async function resolveEmployeeInOrganization(
  organizationId: string,
  employeeId?: string | null,
  employeeCode?: string | null,
  localUserId?: string | null
): Promise<EmployeeScopeRecord> {
  const normalizedEmployeeId = normalizeOptionalText(employeeId);
  const normalizedEmployeeCode = normalizeOptionalText(employeeCode);

  const employee = await prisma.employee.findFirst({
    where: {
      organizationId,
      ...(normalizedEmployeeId
        ? {
            id: normalizedEmployeeId,
          }
        : normalizedEmployeeCode
          ? {
              employeeCode: normalizedEmployeeCode,
            }
          : localUserId
            ? {
                userId: localUserId,
              }
            : {}),
    },
    select: {
      id: true,
      organizationId: true,
      userId: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      employmentStatus: true,
    },
  });

  if (!employee) {
    throw new HttpError(404, "Employee not found in this organization.");
  }

  return employee;
}

async function resolveEmployeeByPin(organizationId: string, pin: string): Promise<EmployeeScopeRecord> {
  const lookupKey = buildEmployeePinLookupKey(organizationId, pin);
  const employee = await prisma.employee.findFirst({
    where: {
      organizationId,
      pinLookupKey: lookupKey,
    },
    select: {
      id: true,
      organizationId: true,
      userId: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      employmentStatus: true,
      pinHash: true,
    },
  });

  if (!employee || !verifyEmployeePinHash(organizationId, pin, employee.pinHash)) {
    throw new HttpError(401, "PIN not recognized.");
  }

  return {
    id: employee.id,
    organizationId: employee.organizationId,
    userId: employee.userId,
    firstName: employee.firstName,
    lastName: employee.lastName,
    employeeCode: employee.employeeCode,
    employmentStatus: employee.employmentStatus,
  };
}

async function ensureEmployeeAssignedToProperty(
  db: RawDbClient,
  employeeId: string,
  propertyId: string,
  occurredAt: Date,
  options?: {
    allowCurrentAssignmentFallback?: boolean;
  }
): Promise<void> {
  const findAssignmentAt = async (effectiveAt: Date) =>
    db.$queryRawUnsafe<Array<{ employeeId: string }>>(
      `
        SELECT "employee_id" AS "employeeId"
        FROM "employee_property_assignments"
        WHERE "employee_id" = CAST($1 AS UUID)
          AND "property_id" = CAST($2 AS UUID)
          AND ("active_from" IS NULL OR "active_from" <= $3)
          AND ("active_to" IS NULL OR "active_to" >= $3)
        LIMIT 1
      `,
      employeeId,
      propertyId,
      effectiveAt
    );

  const rows = await findAssignmentAt(occurredAt);

  if (rows[0]?.employeeId) {
    return;
  }

  // Manual shift entry can backfill time for someone who is assigned today,
  // even if the assignment was formalized after the historical shift date.
  if (options?.allowCurrentAssignmentFallback) {
    const currentRows = await findAssignmentAt(new Date());

    if (currentRows[0]?.employeeId) {
      return;
    }
  }

  throw new HttpError(403, "Employee is not assigned to that property.");
}

async function loadPropertyDeviceById(db: RawDbClient, deviceId: string): Promise<PropertyDeviceScopeRecord | null> {
  const rows = await db.$queryRawUnsafe<PropertyDeviceScopeRecord[]>(
    `
      SELECT
        property_devices."id",
        property_devices."property_id" AS "propertyId",
        properties."name" AS "propertyName",
        properties."organization_id" AS "organizationId",
        organizations."name" AS "organizationName",
        properties."timezone" AS "timezone",
        property_devices."status",
        property_devices."device_name" AS "deviceName",
        property_devices."device_type" AS "deviceType",
        property_devices."pairing_code" AS "pairingCode",
        property_devices."last_seen_at" AS "lastSeenAt",
        property_devices."created_at" AS "createdAt",
        property_devices."updated_at" AS "updatedAt"
      FROM "property_devices"
      INNER JOIN "properties"
        ON "properties"."id" = "property_devices"."property_id"
      INNER JOIN "organizations"
        ON "organizations"."id" = "properties"."organization_id"
      WHERE "property_devices"."id" = CAST($1 AS UUID)
      LIMIT 1
    `,
    deviceId
  );

  return rows[0] ?? null;
}

async function loadPropertyDeviceByTokenHash(db: RawDbClient, authTokenHash: string): Promise<PropertyDeviceScopeRecord | null> {
  const rows = await db.$queryRawUnsafe<PropertyDeviceScopeRecord[]>(
    `
      SELECT
        property_devices."id",
        property_devices."property_id" AS "propertyId",
        properties."name" AS "propertyName",
        properties."organization_id" AS "organizationId",
        organizations."name" AS "organizationName",
        properties."timezone" AS "timezone",
        property_devices."status",
        property_devices."device_name" AS "deviceName",
        property_devices."device_type" AS "deviceType",
        property_devices."pairing_code" AS "pairingCode",
        property_devices."last_seen_at" AS "lastSeenAt",
        property_devices."created_at" AS "createdAt",
        property_devices."updated_at" AS "updatedAt"
      FROM "property_devices"
      INNER JOIN "properties"
        ON "properties"."id" = "property_devices"."property_id"
      INNER JOIN "organizations"
        ON "organizations"."id" = "properties"."organization_id"
      WHERE "property_devices"."auth_token_hash" = $1
      LIMIT 1
    `,
    authTokenHash
  );

  return rows[0] ?? null;
}

async function listPropertyDevices(db: RawDbClient, propertyId: string): Promise<PropertyDeviceScopeRecord[]> {
  return db.$queryRawUnsafe<PropertyDeviceScopeRecord[]>(
    `
      SELECT
        property_devices."id",
        property_devices."property_id" AS "propertyId",
        properties."name" AS "propertyName",
        properties."organization_id" AS "organizationId",
        organizations."name" AS "organizationName",
        properties."timezone" AS "timezone",
        property_devices."status",
        property_devices."device_name" AS "deviceName",
        property_devices."device_type" AS "deviceType",
        property_devices."pairing_code" AS "pairingCode",
        property_devices."last_seen_at" AS "lastSeenAt",
        property_devices."created_at" AS "createdAt",
        property_devices."updated_at" AS "updatedAt"
      FROM "property_devices"
      INNER JOIN "properties"
        ON "properties"."id" = "property_devices"."property_id"
      INNER JOIN "organizations"
        ON "organizations"."id" = "properties"."organization_id"
      WHERE "property_devices"."property_id" = CAST($1 AS UUID)
      ORDER BY "property_devices"."created_at" ASC
    `,
    propertyId
  );
}

async function loadPropertyDevicePairingTokenByHash(
  db: RawDbClient,
  tokenHash: string
): Promise<PropertyDevicePairingTokenRecord | null> {
  const rows = await db.$queryRawUnsafe<PropertyDevicePairingTokenRecord[]>(
    `
      SELECT
        "id",
        "organization_id" AS "organizationId",
        "property_id" AS "propertyId",
        "expires_at" AS "expiresAt",
        "consumed_at" AS "consumedAt"
      FROM "property_device_pairing_tokens"
      WHERE "token_hash" = $1
      LIMIT 1
    `,
    tokenHash
  );

  return rows[0] ?? null;
}

async function consumePropertyDevicePairingToken(
  db: RawDbClient,
  tokenHash: string
): Promise<PropertyDevicePairingTokenRecord | null> {
  const rows = await db.$queryRawUnsafe<PropertyDevicePairingTokenRecord[]>(
    `
      UPDATE "property_device_pairing_tokens"
      SET
        "consumed_at" = CURRENT_TIMESTAMP,
        "updated_at" = CURRENT_TIMESTAMP
      WHERE "token_hash" = $1
        AND "consumed_at" IS NULL
        AND "expires_at" > CURRENT_TIMESTAMP
      RETURNING
        "id",
        "organization_id" AS "organizationId",
        "property_id" AS "propertyId",
        "expires_at" AS "expiresAt",
        "consumed_at" AS "consumedAt"
    `,
    tokenHash
  );

  return rows[0] ?? null;
}

async function insertPropertyDevice(
  db: RawDbClient,
  propertyId: string,
  deviceName: string,
  deviceType: string,
  pairingCode: string,
  authTokenHash: string
): Promise<PropertyDeviceScopeRecord> {
  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `
      INSERT INTO "property_devices" (
        "id",
        "property_id",
        "device_name",
        "device_type",
        "pairing_code",
        "auth_token_hash",
        "status",
        "created_at",
        "updated_at"
      )
      VALUES (
        gen_random_uuid(),
        CAST($1 AS UUID),
        $2,
        $3,
        $4,
        $5,
        'active',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      RETURNING "id"
    `,
    propertyId,
    deviceName,
    deviceType,
    pairingCode,
    authTokenHash
  );

  const insertedRow = rows[0];

  if (!insertedRow?.id) {
    throw new Error("Unable to create property device.");
  }

  const hydratedDevice = await loadPropertyDeviceById(db, insertedRow.id);

  if (!hydratedDevice) {
    throw new Error("Unable to load the newly created property device.");
  }

  return hydratedDevice;
}

async function updatePropertyDeviceStatus(
  db: RawDbClient,
  deviceId: string,
  status: DeviceStatus
): Promise<PropertyDeviceScopeRecord> {
  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `
      UPDATE "property_devices"
      SET
        "status" = $2,
        "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = CAST($1 AS UUID)
      RETURNING "id"
    `,
    deviceId,
    status
  );

  const updatedRow = rows[0];

  if (!updatedRow?.id) {
    throw new Error("Unable to update property device.");
  }

  const updatedDevice = await loadPropertyDeviceById(db, updatedRow.id);

  if (!updatedDevice) {
    throw new Error("Unable to load the updated property device.");
  }

  return updatedDevice;
}

async function propertyDeviceHasPunches(db: RawDbClient, deviceId: string): Promise<boolean> {
  const rows = await db.$queryRawUnsafe<Array<{ hasPunches: boolean }>>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM "time_punches"
        WHERE "property_device_id" = CAST($1 AS UUID)
      ) AS "hasPunches"
    `,
    deviceId
  );

  return rows[0]?.hasPunches === true;
}

async function deletePropertyDeviceRecord(db: RawDbClient, deviceId: string): Promise<void> {
  const deletedCount = await db.$executeRawUnsafe(
    `
      DELETE FROM "property_devices"
      WHERE "id" = CAST($1 AS UUID)
    `,
    deviceId
  );

  if (deletedCount === 0) {
    throw new Error("Unable to delete property device.");
  }
}

async function touchPropertyDeviceLastSeen(db: RawDbClient, deviceId: string): Promise<void> {
  await db.$executeRawUnsafe(
    `
      UPDATE "property_devices"
      SET
        "last_seen_at" = CURRENT_TIMESTAMP,
        "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = CAST($1 AS UUID)
    `,
    deviceId
  );
}

async function loadOpenShiftForEmployee(db: RawDbClient, employeeId: string): Promise<TimeShiftSessionRecord | null> {
  const rows = await db.$queryRawUnsafe<TimeShiftSessionRecord[]>(
    `
      SELECT
        "id",
        "organization_id" AS "organizationId",
        "property_id" AS "propertyId",
        "employee_id" AS "employeeId",
        "clock_in_punch_id" AS "clockInPunchId",
        "clock_out_punch_id" AS "clockOutPunchId",
        "started_at" AS "startedAt",
        "auto_close_at" AS "autoCloseAt",
        "ended_at" AS "endedAt",
        "business_date" AS "businessDate",
        "entry_mode" AS "entryMode",
        "status",
        "total_minutes" AS "totalMinutes",
        "break_minutes" AS "breakMinutes",
        "payable_minutes" AS "payableMinutes",
        "created_at" AS "createdAt",
        "updated_at" AS "updatedAt"
      FROM "time_shift_sessions"
      WHERE "employee_id" = CAST($1 AS UUID)
        AND "ended_at" IS NULL
      ORDER BY "started_at" DESC
      LIMIT 1
    `,
    employeeId
  );

  return rows[0] ?? null;
}

async function loadShiftById(db: RawDbClient, shiftSessionId: string): Promise<TimeShiftSessionRecord | null> {
  const rows = await db.$queryRawUnsafe<TimeShiftSessionRecord[]>(
    `
      SELECT
        "id",
        "organization_id" AS "organizationId",
        "property_id" AS "propertyId",
        "employee_id" AS "employeeId",
        "clock_in_punch_id" AS "clockInPunchId",
        "clock_out_punch_id" AS "clockOutPunchId",
        "started_at" AS "startedAt",
        "auto_close_at" AS "autoCloseAt",
        "ended_at" AS "endedAt",
        "business_date" AS "businessDate",
        "entry_mode" AS "entryMode",
        "status",
        "total_minutes" AS "totalMinutes",
        "break_minutes" AS "breakMinutes",
        "payable_minutes" AS "payableMinutes",
        "created_at" AS "createdAt",
        "updated_at" AS "updatedAt"
      FROM "time_shift_sessions"
      WHERE "id" = CAST($1 AS UUID)
      LIMIT 1
    `,
    shiftSessionId
  );

  return rows[0] ?? null;
}

async function loadLatestAutoClosedShiftForEmployee(
  db: RawDbClient,
  employeeId: string,
  propertyId: string
): Promise<TimeShiftSessionRecord | null> {
  const rows = await db.$queryRawUnsafe<TimeShiftSessionRecord[]>(
    `
      SELECT
        "id",
        "organization_id" AS "organizationId",
        "property_id" AS "propertyId",
        "employee_id" AS "employeeId",
        "clock_in_punch_id" AS "clockInPunchId",
        "clock_out_punch_id" AS "clockOutPunchId",
        "started_at" AS "startedAt",
        "auto_close_at" AS "autoCloseAt",
        "ended_at" AS "endedAt",
        "business_date" AS "businessDate",
        "entry_mode" AS "entryMode",
        "status",
        "total_minutes" AS "totalMinutes",
        "break_minutes" AS "breakMinutes",
        "payable_minutes" AS "payableMinutes",
        "created_at" AS "createdAt",
        "updated_at" AS "updatedAt"
      FROM "time_shift_sessions"
      WHERE "employee_id" = CAST($1 AS UUID)
        AND "property_id" = CAST($2 AS UUID)
        AND "status" = 'auto_closed'
      ORDER BY "ended_at" DESC, "updated_at" DESC
      LIMIT 1
    `,
    employeeId,
    propertyId
  );

  return rows[0] ?? null;
}

async function listShiftBreakSegments(db: RawDbClient, shiftSessionId: string): Promise<ShiftBreakSegmentRecord[]> {
  return db.$queryRawUnsafe<ShiftBreakSegmentRecord[]>(
    `
      SELECT
        "id",
        "shift_session_id" AS "shiftSessionId",
        "break_type" AS "breakType",
        "paid",
        "started_at" AS "startedAt",
        "ended_at" AS "endedAt",
        "duration_minutes" AS "durationMinutes",
        "source",
        "created_at" AS "createdAt"
      FROM "shift_break_segments"
      WHERE "shift_session_id" = CAST($1 AS UUID)
      ORDER BY "started_at" ASC, "created_at" ASC
    `,
    shiftSessionId
  );
}

async function loadOpenBreakSegment(db: RawDbClient, shiftSessionId: string): Promise<ShiftBreakSegmentRecord | null> {
  const rows = await db.$queryRawUnsafe<ShiftBreakSegmentRecord[]>(
    `
      SELECT
        "id",
        "shift_session_id" AS "shiftSessionId",
        "break_type" AS "breakType",
        "paid",
        "started_at" AS "startedAt",
        "ended_at" AS "endedAt",
        "duration_minutes" AS "durationMinutes",
        "source",
        "created_at" AS "createdAt"
      FROM "shift_break_segments"
      WHERE "shift_session_id" = CAST($1 AS UUID)
        AND "ended_at" IS NULL
      ORDER BY "started_at" DESC
      LIMIT 1
    `,
    shiftSessionId
  );

  return rows[0] ?? null;
}

async function loadShiftWithBreaks(db: RawDbClient, shiftSessionId: string): Promise<ShiftWithBreaks | null> {
  const shift = await loadShiftById(db, shiftSessionId);

  if (!shift) {
    return null;
  }

  const breaks = await listShiftBreakSegments(db, shiftSessionId);

  return {
    shift,
    breaks,
  };
}

async function loadTimePunchByClientEventId(db: RawDbClient, clientEventId: string): Promise<TimePunchRecord | null> {
  const rows = await db.$queryRawUnsafe<TimePunchRecord[]>(
    `
      SELECT
        "id",
        "organization_id" AS "organizationId",
        "property_id" AS "propertyId",
        "employee_id" AS "employeeId",
        "property_device_id" AS "propertyDeviceId",
        "punch_type" AS "punchType",
        "occurred_at" AS "occurredAt",
        "business_date" AS "businessDate",
        "source",
        "photo_url" AS "photoUrl",
        "note",
        "status",
        "client_event_id" AS "clientEventId",
        "replaced_by_punch_id" AS "replacedByPunchId",
        "created_by_user_id" AS "createdByUserId",
        "created_at" AS "createdAt"
      FROM "time_punches"
      WHERE "client_event_id" = $1
      LIMIT 1
    `,
    clientEventId
  );

  return rows[0] ?? null;
}

async function insertTimePunch(
  db: RawDbClient,
  input: {
    businessDate: string;
    createdByUserId: string | null;
    employeeId: string;
    note: string | null;
    occurredAt: Date;
    organizationId: string;
    photoUrl: string | null;
    propertyDeviceId: string | null;
    propertyId: string;
    punchType: PunchType;
    source: PunchSource;
    clientEventId?: string | null;
  }
): Promise<TimePunchRecord> {
  const rows = await db.$queryRawUnsafe<TimePunchRecord[]>(
    `
      INSERT INTO "time_punches" (
        "id",
        "organization_id",
        "property_id",
        "employee_id",
        "property_device_id",
        "punch_type",
        "occurred_at",
        "business_date",
        "source",
        "photo_url",
        "note",
        "status",
        "client_event_id",
        "created_by_user_id",
        "created_at"
      )
      VALUES (
        gen_random_uuid(),
        CAST($1 AS UUID),
        CAST($2 AS UUID),
        CAST($3 AS UUID),
        CAST($4 AS UUID),
        $5,
        $6,
        CAST($7 AS DATE),
        $8,
        $9,
        $10,
        'valid',
        $11,
        CAST($12 AS UUID),
        CURRENT_TIMESTAMP
      )
      RETURNING
        "id",
        "organization_id" AS "organizationId",
        "property_id" AS "propertyId",
        "employee_id" AS "employeeId",
        "property_device_id" AS "propertyDeviceId",
        "punch_type" AS "punchType",
        "occurred_at" AS "occurredAt",
        "business_date" AS "businessDate",
        "source",
        "photo_url" AS "photoUrl",
        "note",
        "status",
        "replaced_by_punch_id" AS "replacedByPunchId",
        "created_by_user_id" AS "createdByUserId",
        "created_at" AS "createdAt"
    `,
    input.organizationId,
    input.propertyId,
    input.employeeId,
    input.propertyDeviceId,
    input.punchType,
    input.occurredAt,
    input.businessDate,
    input.source,
    input.photoUrl,
    input.note,
    input.clientEventId ?? null,
    input.createdByUserId
  );

  const punch = rows[0];

  if (!punch) {
    throw new Error("Unable to record time punch.");
  }

  return punch;
}

async function loadTimePunchById(db: RawDbClient, punchId: string): Promise<TimePunchRecord | null> {
  const rows = await db.$queryRawUnsafe<TimePunchRecord[]>(
    `
      SELECT
        "id",
        "organization_id" AS "organizationId",
        "property_id" AS "propertyId",
        "employee_id" AS "employeeId",
        "property_device_id" AS "propertyDeviceId",
        "punch_type" AS "punchType",
        "occurred_at" AS "occurredAt",
        "business_date" AS "businessDate",
        "source",
        "photo_url" AS "photoUrl",
        "note",
        "status",
        "client_event_id" AS "clientEventId",
        "replaced_by_punch_id" AS "replacedByPunchId",
        "created_by_user_id" AS "createdByUserId",
        "created_at" AS "createdAt"
      FROM "time_punches"
      WHERE "id" = CAST($1 AS UUID)
      LIMIT 1
    `,
    punchId
  );

  return rows[0] ?? null;
}

async function insertShiftSession(
  db: RawDbClient,
  input: {
    autoCloseAt: Date;
    businessDate: string;
    clockInPunchId: string;
    employeeId: string;
    entryMode?: string;
    organizationId: string;
    propertyId: string;
    startedAt: Date;
  }
): Promise<TimeShiftSessionRecord> {
  const rows = await db.$queryRawUnsafe<TimeShiftSessionRecord[]>(
    `
      INSERT INTO "time_shift_sessions" (
        "id",
        "organization_id",
        "property_id",
        "employee_id",
        "clock_in_punch_id",
        "started_at",
        "auto_close_at",
        "business_date",
        "entry_mode",
        "status",
        "break_minutes",
        "created_at",
        "updated_at"
      )
      VALUES (
        gen_random_uuid(),
        CAST($1 AS UUID),
        CAST($2 AS UUID),
        CAST($3 AS UUID),
        CAST($4 AS UUID),
        $5,
        $6,
        CAST($7 AS DATE),
        $8,
        'open',
        0,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      RETURNING
        "id",
        "organization_id" AS "organizationId",
        "property_id" AS "propertyId",
        "employee_id" AS "employeeId",
        "clock_in_punch_id" AS "clockInPunchId",
        "clock_out_punch_id" AS "clockOutPunchId",
        "started_at" AS "startedAt",
        "auto_close_at" AS "autoCloseAt",
        "ended_at" AS "endedAt",
        "business_date" AS "businessDate",
        "entry_mode" AS "entryMode",
        "status",
        "total_minutes" AS "totalMinutes",
        "break_minutes" AS "breakMinutes",
        "payable_minutes" AS "payableMinutes",
        "created_at" AS "createdAt",
        "updated_at" AS "updatedAt"
    `,
    input.organizationId,
    input.propertyId,
    input.employeeId,
    input.clockInPunchId,
    input.startedAt,
    input.autoCloseAt,
    input.businessDate,
    input.entryMode ?? "punch"
  );

  const shift = rows[0];

  if (!shift) {
    throw new Error("Unable to create time shift session.");
  }

  return shift;
}

async function updateShiftSession(
  db: RawDbClient,
  input: {
    breakMinutes: number;
    clockOutPunchId?: string | null;
    endedAt: Date | null;
    payableMinutes: number | null;
    shiftSessionId: string;
    status: ShiftStatus;
    totalMinutes: number | null;
  }
): Promise<TimeShiftSessionRecord> {
  const rows = await db.$queryRawUnsafe<TimeShiftSessionRecord[]>(
    `
      UPDATE "time_shift_sessions"
      SET
        "clock_out_punch_id" = CAST($2 AS UUID),
        "ended_at" = $3,
        "status" = $4,
        "total_minutes" = $5,
        "break_minutes" = $6,
        "payable_minutes" = $7,
        "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = CAST($1 AS UUID)
      RETURNING
        "id",
        "organization_id" AS "organizationId",
        "property_id" AS "propertyId",
        "employee_id" AS "employeeId",
        "clock_in_punch_id" AS "clockInPunchId",
        "clock_out_punch_id" AS "clockOutPunchId",
        "started_at" AS "startedAt",
        "auto_close_at" AS "autoCloseAt",
        "ended_at" AS "endedAt",
        "business_date" AS "businessDate",
        "entry_mode" AS "entryMode",
        "status",
        "total_minutes" AS "totalMinutes",
        "break_minutes" AS "breakMinutes",
        "payable_minutes" AS "payableMinutes",
        "created_at" AS "createdAt",
        "updated_at" AS "updatedAt"
    `,
    input.shiftSessionId,
    input.clockOutPunchId ?? null,
    input.endedAt,
    input.status,
    input.totalMinutes,
    input.breakMinutes,
    input.payableMinutes
  );

  const shift = rows[0];

  if (!shift) {
    throw new Error("Unable to update shift session.");
  }

  return shift;
}

async function insertBreakSegment(
  db: RawDbClient,
  input: {
    breakType: BreakType;
    durationMinutes: number | null;
    endedAt: Date | null;
    paid: boolean;
    shiftSessionId: string;
    source: string;
    startedAt: Date;
  }
): Promise<ShiftBreakSegmentRecord> {
  const rows = await db.$queryRawUnsafe<ShiftBreakSegmentRecord[]>(
    `
      INSERT INTO "shift_break_segments" (
        "id",
        "shift_session_id",
        "break_type",
        "paid",
        "started_at",
        "ended_at",
        "duration_minutes",
        "source",
        "created_at"
      )
      VALUES (
        gen_random_uuid(),
        CAST($1 AS UUID),
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        CURRENT_TIMESTAMP
      )
      RETURNING
        "id",
        "shift_session_id" AS "shiftSessionId",
        "break_type" AS "breakType",
        "paid",
        "started_at" AS "startedAt",
        "ended_at" AS "endedAt",
        "duration_minutes" AS "durationMinutes",
        "source",
        "created_at" AS "createdAt"
    `,
    input.shiftSessionId,
    input.breakType,
    input.paid,
    input.startedAt,
    input.endedAt,
    input.durationMinutes,
    input.source
  );

  const segment = rows[0];

  if (!segment) {
    throw new Error("Unable to create break segment.");
  }

  return segment;
}

async function closeBreakSegment(
  db: RawDbClient,
  breakSegmentId: string,
  endedAt: Date
): Promise<ShiftBreakSegmentRecord> {
  const rows = await db.$queryRawUnsafe<ShiftBreakSegmentRecord[]>(
    `
      UPDATE "shift_break_segments"
      SET
        "ended_at" = $2,
        "duration_minutes" = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM ($2 - "started_at")) / 60))::INTEGER
      WHERE "id" = CAST($1 AS UUID)
      RETURNING
        "id",
        "shift_session_id" AS "shiftSessionId",
        "break_type" AS "breakType",
        "paid",
        "started_at" AS "startedAt",
        "ended_at" AS "endedAt",
        "duration_minutes" AS "durationMinutes",
        "source",
        "created_at" AS "createdAt"
    `,
    breakSegmentId,
    endedAt
  );

  const segment = rows[0];

  if (!segment) {
    throw new Error("Unable to close break segment.");
  }

  return segment;
}

async function replaceShiftBreakSegments(
  db: RawDbClient,
  shiftSessionId: string,
  segments: NormalizedBreakSegmentInput[]
): Promise<ShiftBreakSegmentRecord[]> {
  await db.$executeRawUnsafe(
    `
      DELETE FROM "shift_break_segments"
      WHERE "shift_session_id" = CAST($1 AS UUID)
    `,
    shiftSessionId
  );

  const insertedSegments: ShiftBreakSegmentRecord[] = [];

  for (const segment of segments) {
    insertedSegments.push(
      await insertBreakSegment(db, {
        shiftSessionId,
        breakType: segment.breakType,
        paid: segment.paid,
        startedAt: segment.startedAt,
        endedAt: segment.endedAt,
        durationMinutes: segment.durationMinutes,
        source: segment.source,
      })
    );
  }

  return insertedSegments;
}

async function insertTimeAdjustment(
  db: RawDbClient,
  input: {
    adjustedByUserId: string;
    afterSnapshot: TimeShiftSessionSummary;
    beforeSnapshot: TimeShiftSessionSummary;
    employeeId: string;
    organizationId: string;
    propertyId: string;
    reason: string;
    shiftSessionId: string;
  }
): Promise<string> {
  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `
      INSERT INTO "time_adjustments" (
        "id",
        "shift_session_id",
        "organization_id",
        "property_id",
        "employee_id",
        "adjusted_by_user_id",
        "reason",
        "before_snapshot",
        "after_snapshot",
        "created_at"
      )
      VALUES (
        gen_random_uuid(),
        CAST($1 AS UUID),
        CAST($2 AS UUID),
        CAST($3 AS UUID),
        CAST($4 AS UUID),
        CAST($5 AS UUID),
        $6,
        CAST($7 AS JSONB),
        CAST($8 AS JSONB),
        CURRENT_TIMESTAMP
      )
      RETURNING "id"
    `,
    input.shiftSessionId,
    input.organizationId,
    input.propertyId,
    input.employeeId,
    input.adjustedByUserId,
    input.reason,
    JSON.stringify(input.beforeSnapshot),
    JSON.stringify(input.afterSnapshot)
  );

  const row = rows[0];

  if (!row?.id) {
    throw new Error("Unable to create time adjustment.");
  }

  return row.id;
}

async function loadShiftAdjustmentCounts(
  db: RawDbClient,
  shiftSessionIds: string[]
): Promise<Map<string, number>> {
  if (shiftSessionIds.length === 0) {
    return new Map();
  }

  const rows = await db.$queryRawUnsafe<Array<{ adjustmentCount: number; shiftSessionId: string }>>(
    `
      SELECT
        "shift_session_id" AS "shiftSessionId",
        COUNT(*)::INTEGER AS "adjustmentCount"
      FROM "time_adjustments"
      WHERE "shift_session_id" = ANY($1::uuid[])
      GROUP BY "shift_session_id"
    `,
    shiftSessionIds
  );

  return new Map(rows.map((row) => [row.shiftSessionId, row.adjustmentCount]));
}

async function hydrateShiftSummary(db: RawDbClient, shiftSessionId: string): Promise<TimeShiftSessionSummary> {
  const shiftWithBreaks = await loadShiftWithBreaks(db, shiftSessionId);

  if (!shiftWithBreaks) {
    throw new HttpError(404, "Shift session not found.");
  }

  const adjustmentCounts = await loadShiftAdjustmentCounts(db, [shiftWithBreaks.shift.id]);
  const payrollImpact = await getPayrollImpactForShifts(shiftWithBreaks.shift.propertyId, [
    {
      shiftSessionId: shiftWithBreaks.shift.id,
      startedAt: shiftWithBreaks.shift.startedAt,
      businessDate: formatDateOnly(shiftWithBreaks.shift.businessDate),
    },
  ]);

  return toTimeShiftSessionSummary(shiftWithBreaks.shift, shiftWithBreaks.breaks, {
    hasAdjustments: (adjustmentCounts.get(shiftWithBreaks.shift.id) ?? 0) > 0,
    payrollImpact: payrollImpact.get(shiftWithBreaks.shift.id) ?? buildEmptyPayrollImpact(),
  });
}

async function ensureDeviceIsActive(device: PropertyDeviceScopeRecord): Promise<void> {
  if (device.status !== "active") {
    throw new HttpError(403, "This device is not active.");
  }
}

async function ensureCanManageOtherEmployeeTime(localUserId: string, organizationId: string, propertyId: string): Promise<void> {
  const permissionKeys = await getPermissionKeys(localUserId, organizationId);
  const canManageTime = hasTimeManagementPermission(permissionKeys);

  if (!canManageTime) {
    throw new HttpError(403, "You do not have permission to manage time for other employees.");
  }

  if (hasPropertyScopeBypassPermission(permissionKeys)) {
    return;
  }

  const hasScopedAccess = await hasPropertyAccess(localUserId, propertyId);

  if (!hasScopedAccess) {
    throw new HttpError(403, "You do not have access to that property.");
  }
}

async function ensureCanReadTimeScope(
  localUserId: string,
  organizationId: string,
  propertyId: string | null,
  targetEmployee: EmployeeScopeRecord | null
): Promise<{ propertyIds: string[] | null }> {
  const permissionKeys = await getPermissionKeys(localUserId, organizationId);
  const canReadAllTime =
    permissionKeys.has(PERMISSIONS.EMPLOYEE_READ) ||
    permissionKeys.has(PERMISSIONS.SCHEDULE_READ) ||
    permissionKeys.has(PERMISSIONS.PAYROLL_READ);

  if (targetEmployee?.userId === localUserId && !canReadAllTime) {
    return {
      propertyIds: propertyId ? [propertyId] : null,
    };
  }

  if (!canReadAllTime) {
    throw new HttpError(403, "You do not have permission to view time records.");
  }

  if (propertyId) {
    if (!hasPropertyScopeBypassPermission(permissionKeys)) {
      const allowed = await hasPropertyAccess(localUserId, propertyId);

      if (!allowed) {
        throw new HttpError(403, "You do not have access to that property.");
      }
    }

    return { propertyIds: [propertyId] };
  }

  if (hasPropertyScopeBypassPermission(permissionKeys)) {
    return { propertyIds: null };
  }

  const scopedAssignments = await prisma.propertyUserRole.findMany({
    where: {
      userId: localUserId,
      property: {
        organizationId,
      },
    },
    select: {
      propertyId: true,
    },
  });

  return {
    propertyIds: scopedAssignments.map((assignment) => assignment.propertyId),
  };
}

async function resolveNextKioskAction(
  db: RawDbClient,
  employeeId: string,
  propertyId: string
): Promise<"clock-in" | "clock-out"> {
  const openShift = await loadOpenShiftForEmployee(db, employeeId);

  if (!openShift) {
    return "clock-in";
  }

  if (openShift.propertyId !== propertyId) {
    throw new HttpError(409, "Employee has an open shift at another property.");
  }

  return "clock-out";
}

async function loadPropertyAutoCloseAfterHours(propertyId: string, referenceTime = new Date()): Promise<number> {
  const activeSetting = await prisma.propertyPayrollSetting.findFirst({
    where: {
      propertyId,
      effectiveFrom: {
        lte: referenceTime,
      },
      OR: [
        {
          effectiveTo: null,
        },
        {
          effectiveTo: {
            gt: referenceTime,
          },
        },
      ],
    },
    orderBy: {
      effectiveFrom: "desc",
    },
    select: {
      autoCloseAfterHours: true,
    },
  });

  return activeSetting?.autoCloseAfterHours ?? 12;
}

async function reconcileOpenShiftRecordIfNeeded(shift: TimeShiftSessionRecord): Promise<void> {
  if (shift.autoCloseAt.getTime() > Date.now()) {
    return;
  }

  const property = await loadPropertyScope(shift.propertyId);
  const employee = await resolveEmployeeInOrganization(shift.organizationId, shift.employeeId, null, null);
  const autoCloseAfterHours = Math.round((shift.autoCloseAt.getTime() - shift.startedAt.getTime()) / (60 * 60 * 1000));

  try {
    await prisma.$transaction(async (tx) => {
      const db = tx as RawDbClient;

      await closeShiftFromClockOut(db, {
        createdByUserId: null,
        employee,
        note: `Auto-closed after ${autoCloseAfterHours} hours.`,
        occurredAt: shift.autoCloseAt,
        photoUrl: null,
        property,
        propertyDeviceId: null,
        source: "auto_close",
      });
    });
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 409) {
      return;
    }

    throw error;
  }
}

async function reconcileOpenShiftForEmployee(employeeId: string): Promise<void> {
  const openShift = await loadOpenShiftForEmployee(getDbClient(), employeeId);

  if (!openShift) {
    return;
  }

  await reconcileOpenShiftRecordIfNeeded(openShift);
}

export async function reconcileOpenShiftsForProperty(propertyId: string): Promise<void> {
  const openShifts = await getDbClient().$queryRawUnsafe<TimeShiftSessionRecord[]>(
    `
      SELECT
        "id",
        "organization_id" AS "organizationId",
        "property_id" AS "propertyId",
        "employee_id" AS "employeeId",
        "clock_in_punch_id" AS "clockInPunchId",
        "clock_out_punch_id" AS "clockOutPunchId",
        "started_at" AS "startedAt",
        "auto_close_at" AS "autoCloseAt",
        "ended_at" AS "endedAt",
        "business_date" AS "businessDate",
        "entry_mode" AS "entryMode",
        "status",
        "total_minutes" AS "totalMinutes",
        "break_minutes" AS "breakMinutes",
        "payable_minutes" AS "payableMinutes",
        "created_at" AS "createdAt",
        "updated_at" AS "updatedAt"
      FROM "time_shift_sessions"
      WHERE "property_id" = CAST($1 AS UUID)
        AND "status" = 'open'
        AND "auto_close_at" <= CURRENT_TIMESTAMP
      ORDER BY "auto_close_at" ASC
    `,
    propertyId
  );

  for (const shift of openShifts) {
    await reconcileOpenShiftRecordIfNeeded(shift);
  }
}

export async function reconcileOverdueOpenShifts(): Promise<void> {
  const openShifts = await getDbClient().$queryRawUnsafe<TimeShiftSessionRecord[]>(
    `
      SELECT
        "id",
        "organization_id" AS "organizationId",
        "property_id" AS "propertyId",
        "employee_id" AS "employeeId",
        "clock_in_punch_id" AS "clockInPunchId",
        "clock_out_punch_id" AS "clockOutPunchId",
        "started_at" AS "startedAt",
        "auto_close_at" AS "autoCloseAt",
        "ended_at" AS "endedAt",
        "business_date" AS "businessDate",
        "entry_mode" AS "entryMode",
        "status",
        "total_minutes" AS "totalMinutes",
        "break_minutes" AS "breakMinutes",
        "payable_minutes" AS "payableMinutes",
        "created_at" AS "createdAt",
        "updated_at" AS "updatedAt"
      FROM "time_shift_sessions"
      WHERE "status" = 'open'
        AND "auto_close_at" <= CURRENT_TIMESTAMP
      ORDER BY "auto_close_at" ASC
    `
  );

  for (const shift of openShifts) {
    await reconcileOpenShiftRecordIfNeeded(shift);
  }
}

async function createShiftFromClockIn(
  db: RawDbClient,
  input: {
    createdByUserId: string | null;
    employee: EmployeeScopeRecord;
    note: string | null;
    occurredAt: Date;
    photoUrl: string | null;
    property: PropertyScopeRecord;
    propertyDeviceId: string | null;
    source: PunchSource;
    clientEventId?: string | null;
  }
): Promise<PunchMutationResult> {
  const existingOpenShift = await loadOpenShiftForEmployee(db, input.employee.id);

  if (existingOpenShift) {
    throw new HttpError(409, "Employee already has an open shift.");
  }

  await ensureEmployeeAssignedToProperty(db, input.employee.id, input.property.id, input.occurredAt);

  const autoCloseAfterHours = await loadPropertyAutoCloseAfterHours(input.property.id, input.occurredAt);
  const autoCloseAt = new Date(input.occurredAt.getTime() + autoCloseAfterHours * 60 * 60 * 1000);
  const businessDate = buildBusinessDateForTimezone(input.occurredAt, input.property.timezone);
  const punch = await insertTimePunch(db, {
    organizationId: input.property.organizationId,
    propertyId: input.property.id,
    employeeId: input.employee.id,
    propertyDeviceId: input.propertyDeviceId,
    punchType: "clock_in",
    occurredAt: input.occurredAt,
    businessDate,
    source: input.source,
    photoUrl: input.photoUrl,
    note: input.note,
    createdByUserId: input.createdByUserId,
    clientEventId: input.clientEventId ?? null,
  });
  const shift = await insertShiftSession(db, {
    organizationId: input.property.organizationId,
    propertyId: input.property.id,
    employeeId: input.employee.id,
    clockInPunchId: punch.id,
    startedAt: input.occurredAt,
    autoCloseAt,
    businessDate,
    entryMode: "punch",
  });

  return {
    punch: toTimePunchSummary(punch),
    shift: toTimeShiftSessionSummary(shift, []),
  };
}

async function closeShiftFromClockOut(
  db: RawDbClient,
  input: {
    createdByUserId: string | null;
    employee: EmployeeScopeRecord;
    note: string | null;
    occurredAt: Date;
    photoUrl: string | null;
    property: PropertyScopeRecord;
    propertyDeviceId: string | null;
    source: PunchSource;
    clientEventId?: string | null;
  }
): Promise<PunchMutationResult> {
  const openShift = await loadOpenShiftForEmployee(db, input.employee.id);

  if (!openShift) {
    if (input.source !== "auto_close") {
      const autoClosedShift = await loadLatestAutoClosedShiftForEmployee(db, input.employee.id, input.property.id);

      if (
        autoClosedShift?.clockOutPunchId &&
        autoClosedShift.endedAt &&
        autoClosedShift.endedAt.getTime() <= input.occurredAt.getTime()
      ) {
        const autoClosePunch = await loadTimePunchById(db, autoClosedShift.clockOutPunchId);
        const breaks = await listShiftBreakSegments(db, autoClosedShift.id);

        if (autoClosePunch) {
          return {
            alreadyAutoClosed: true,
            message: `Shift was already auto-closed at ${autoClosedShift.endedAt.toISOString()}. No manual clock-out was recorded.`,
            punch: toTimePunchSummary(autoClosePunch),
            shift: toTimeShiftSessionSummary(autoClosedShift, breaks),
          };
        }
      }
    }

    throw new HttpError(409, "Employee does not have an open shift.");
  }

  if (openShift.propertyId !== input.property.id) {
    throw new HttpError(409, "Employee has an open shift at a different property.");
  }

  if (input.occurredAt < openShift.startedAt) {
    throw new HttpError(400, "clock_out cannot occur before the shift starts.");
  }

  if (input.source !== "auto_close" && input.occurredAt.getTime() >= openShift.autoCloseAt.getTime()) {
    const autoCloseAfterHours = Math.round((openShift.autoCloseAt.getTime() - openShift.startedAt.getTime()) / (60 * 60 * 1000));
    const autoCloseResult = await closeShiftFromClockOut(db, {
      createdByUserId: null,
      employee: input.employee,
      note: `Auto-closed after ${autoCloseAfterHours} hours.`,
      occurredAt: openShift.autoCloseAt,
      photoUrl: null,
      property: input.property,
      propertyDeviceId: null,
      source: "auto_close",
    });

    return {
      ...autoCloseResult,
      alreadyAutoClosed: true,
      message: `Shift was already auto-closed at ${openShift.autoCloseAt.toISOString()}. No manual clock-out was recorded.`,
    };
  }

  const businessDate = buildBusinessDateForTimezone(input.occurredAt, input.property.timezone);
  const punch = await insertTimePunch(db, {
    organizationId: input.property.organizationId,
    propertyId: input.property.id,
    employeeId: input.employee.id,
    propertyDeviceId: input.propertyDeviceId,
    punchType: "clock_out",
    occurredAt: input.occurredAt,
    businessDate,
    source: input.source,
    photoUrl: input.photoUrl,
    note: input.note,
    createdByUserId: input.createdByUserId,
    clientEventId: input.clientEventId ?? null,
  });
  const openBreak = await loadOpenBreakSegment(db, openShift.id);

  if (openBreak) {
    if (input.occurredAt < openBreak.startedAt) {
      throw new HttpError(400, "clock_out cannot end an open break before that break starts.");
    }

    await closeBreakSegment(db, openBreak.id, input.occurredAt);
  }

  const latestBreaks = await listShiftBreakSegments(db, openShift.id);
  const sessionComputation = computeSessionTotals(
    openShift.startedAt,
    input.occurredAt,
    latestBreaks.map((segment) => ({
      breakType: segment.breakType,
      paid: segment.paid,
      startedAt: segment.startedAt,
      endedAt: segment.endedAt,
      durationMinutes: segment.durationMinutes,
      source: segment.source,
    }))
  );
  const nextStatus: ShiftStatus = input.source === "auto_close" ? "auto_closed" : "closed";
  const shift = await updateShiftSession(db, {
    shiftSessionId: openShift.id,
    clockOutPunchId: punch.id,
    endedAt: input.occurredAt,
    status: nextStatus,
    totalMinutes: sessionComputation.totalMinutes,
    breakMinutes: sessionComputation.breakMinutes,
    payableMinutes: sessionComputation.payableMinutes,
  });

  return {
    punch: toTimePunchSummary(punch),
    shift: toTimeShiftSessionSummary(shift, latestBreaks),
  };
}

async function startBreakFromPunch(
  db: RawDbClient,
  input: {
    breakType: BreakType;
    createdByUserId: string | null;
    employee: EmployeeScopeRecord;
    note: string | null;
    occurredAt: Date;
    paid: boolean;
    photoUrl: string | null;
    property: PropertyScopeRecord;
    propertyDeviceId: string | null;
    source: PunchSource;
  }
): Promise<PunchMutationResult> {
  const openShift = await loadOpenShiftForEmployee(db, input.employee.id);

  if (!openShift) {
    throw new HttpError(409, "Employee must be clocked in before starting a break.");
  }

  if (openShift.propertyId !== input.property.id) {
    throw new HttpError(409, "Employee has an open shift at a different property.");
  }

  if (input.occurredAt < openShift.startedAt) {
    throw new HttpError(400, "break_start cannot occur before the shift starts.");
  }

  const existingOpenBreak = await loadOpenBreakSegment(db, openShift.id);

  if (existingOpenBreak) {
    throw new HttpError(409, "Employee already has an open break.");
  }

  const businessDate = buildBusinessDateForTimezone(input.occurredAt, input.property.timezone);
  const punch = await insertTimePunch(db, {
    organizationId: input.property.organizationId,
    propertyId: input.property.id,
    employeeId: input.employee.id,
    propertyDeviceId: input.propertyDeviceId,
    punchType: "break_start",
    occurredAt: input.occurredAt,
    businessDate,
    source: input.source,
    photoUrl: input.photoUrl,
    note: input.note,
    createdByUserId: input.createdByUserId,
  });

  await insertBreakSegment(db, {
    shiftSessionId: openShift.id,
    breakType: input.breakType,
    paid: input.paid,
    startedAt: input.occurredAt,
    endedAt: null,
    durationMinutes: null,
    source: input.source,
  });

  const breaks = await listShiftBreakSegments(db, openShift.id);
  const shift = await updateShiftSession(db, {
    shiftSessionId: openShift.id,
    clockOutPunchId: openShift.clockOutPunchId,
    endedAt: openShift.endedAt,
    status: "open",
    totalMinutes: null,
    breakMinutes: breaks.reduce((sum, segment) => sum + (segment.durationMinutes ?? 0), 0),
    payableMinutes: null,
  });

  return {
    punch: toTimePunchSummary(punch),
    shift: toTimeShiftSessionSummary(shift, breaks),
  };
}

async function endBreakFromPunch(
  db: RawDbClient,
  input: {
    createdByUserId: string | null;
    employee: EmployeeScopeRecord;
    note: string | null;
    occurredAt: Date;
    photoUrl: string | null;
    property: PropertyScopeRecord;
    propertyDeviceId: string | null;
    source: PunchSource;
  }
): Promise<PunchMutationResult> {
  const openShift = await loadOpenShiftForEmployee(db, input.employee.id);

  if (!openShift) {
    throw new HttpError(409, "Employee must be clocked in before ending a break.");
  }

  if (openShift.propertyId !== input.property.id) {
    throw new HttpError(409, "Employee has an open shift at a different property.");
  }

  const openBreak = await loadOpenBreakSegment(db, openShift.id);

  if (!openBreak) {
    throw new HttpError(409, "Employee does not have an open break.");
  }

  if (input.occurredAt < openBreak.startedAt) {
    throw new HttpError(400, "break_end cannot occur before the break starts.");
  }

  const businessDate = buildBusinessDateForTimezone(input.occurredAt, input.property.timezone);
  const punch = await insertTimePunch(db, {
    organizationId: input.property.organizationId,
    propertyId: input.property.id,
    employeeId: input.employee.id,
    propertyDeviceId: input.propertyDeviceId,
    punchType: "break_end",
    occurredAt: input.occurredAt,
    businessDate,
    source: input.source,
    photoUrl: input.photoUrl,
    note: input.note,
    createdByUserId: input.createdByUserId,
  });

  await closeBreakSegment(db, openBreak.id, input.occurredAt);

  const breaks = await listShiftBreakSegments(db, openShift.id);
  const shift = await updateShiftSession(db, {
    shiftSessionId: openShift.id,
    clockOutPunchId: openShift.clockOutPunchId,
    endedAt: openShift.endedAt,
    status: "open",
    totalMinutes: null,
    breakMinutes: breaks.reduce((sum, segment) => sum + (segment.durationMinutes ?? 0), 0),
    payableMinutes: null,
  });

  return {
    punch: toTimePunchSummary(punch),
    shift: toTimeShiftSessionSummary(shift, breaks),
  };
}

async function recordPunchTransaction(
  db: RawDbClient,
  input: {
    breakType?: BreakType;
    createdByUserId: string | null;
    employee: EmployeeScopeRecord;
    note: string | null;
    occurredAt: Date;
    paid?: boolean;
    photoUrl: string | null;
    property: PropertyScopeRecord;
    propertyDeviceId: string | null;
    punchType: PunchType;
    source: PunchSource;
    clientEventId?: string | null;
  }
): Promise<PunchMutationResult> {
  if (input.punchType === "clock_in") {
    return createShiftFromClockIn(db, input);
  }

  if (input.punchType === "clock_out") {
    return closeShiftFromClockOut(db, input);
  }

  if (input.punchType === "break_start") {
    return startBreakFromPunch(db, {
      ...input,
      breakType: input.breakType ?? "meal",
      paid: input.paid ?? false,
    });
  }

  return endBreakFromPunch(db, input);
}

async function listShiftRows(
  db: RawDbClient,
  input: {
    businessDateFrom: string | null;
    businessDateTo: string | null;
    employeeId: string | null;
    organizationId: string;
    propertyIds: string[] | null;
    status: ShiftStatus | null;
  }
): Promise<TimeShiftSessionRecord[]> {
  const conditions = [`"organization_id" = CAST($1 AS UUID)`];
  const values: unknown[] = [input.organizationId];

  if (input.employeeId) {
    values.push(input.employeeId);
    conditions.push(`"employee_id" = CAST($${values.length} AS UUID)`);
  }

  if (input.propertyIds) {
    if (input.propertyIds.length === 0) {
      return [];
    }

    values.push(input.propertyIds);
    conditions.push(`"property_id" = ANY($${values.length}::uuid[])`);
  }

  if (input.businessDateFrom) {
    values.push(input.businessDateFrom);
    conditions.push(`"business_date" >= CAST($${values.length} AS DATE)`);
  }

  if (input.businessDateTo) {
    values.push(input.businessDateTo);
    conditions.push(`"business_date" <= CAST($${values.length} AS DATE)`);
  }

  if (input.status) {
    values.push(input.status);
    conditions.push(`"status" = $${values.length}`);
  }

  return db.$queryRawUnsafe<TimeShiftSessionRecord[]>(
    `
      SELECT
        "id",
        "organization_id" AS "organizationId",
        "property_id" AS "propertyId",
        "employee_id" AS "employeeId",
        "clock_in_punch_id" AS "clockInPunchId",
        "clock_out_punch_id" AS "clockOutPunchId",
        "started_at" AS "startedAt",
        "auto_close_at" AS "autoCloseAt",
        "ended_at" AS "endedAt",
        "business_date" AS "businessDate",
        "entry_mode" AS "entryMode",
        "status",
        "total_minutes" AS "totalMinutes",
        "break_minutes" AS "breakMinutes",
        "payable_minutes" AS "payableMinutes",
        "created_at" AS "createdAt",
        "updated_at" AS "updatedAt"
      FROM "time_shift_sessions"
      WHERE ${conditions.join("\n        AND ")}
      ORDER BY "started_at" DESC, "created_at" DESC
    `,
    ...values
  );
}

export async function registerPropertyDeviceForAuthenticatedUser(
  authUser: AuthenticatedSupabaseUser,
  propertyId: string,
  input: DeviceRegistrationInput
): Promise<DeviceRegistrationResult> {
  const localUser = await syncAuthenticatedUser(authUser);
  const property = await loadPropertyScope(propertyId);

  await ensureOrganizationMembership(localUser.id, property.organizationId);
  await ensurePropertyScopeAccess(localUser.id, property.organizationId, property.id);

  const deviceName = normalizeRequiredText(input.deviceName, "deviceName");
  const deviceType = normalizeDeviceType(input.deviceType);
  const authToken = buildDeviceAuthToken();
  const device = await insertPropertyDevice(getDbClient(), property.id, deviceName, deviceType, buildPairingCode(), hashDeviceToken(authToken));

  return {
    authToken,
    device: toPropertyDeviceSummary(device),
  };
}

export async function listPropertyDevicesForAuthenticatedUser(
  authUser: AuthenticatedSupabaseUser,
  propertyId: string
): Promise<PropertyDeviceSummary[]> {
  const localUser = await syncAuthenticatedUser(authUser);
  const property = await loadPropertyScope(propertyId);

  await ensureOrganizationMembership(localUser.id, property.organizationId);
  await ensurePropertyScopeAccess(localUser.id, property.organizationId, property.id);

  const devices = await listPropertyDevices(getDbClient(), property.id);

  return devices.map(toPropertyDeviceSummary);
}

export async function retirePropertyDeviceForAuthenticatedUser(
  authUser: AuthenticatedSupabaseUser,
  propertyId: string,
  deviceId: string
): Promise<PropertyDeviceSummary> {
  const localUser = await syncAuthenticatedUser(authUser);
  const property = await loadPropertyScope(propertyId);

  await ensureOrganizationMembership(localUser.id, property.organizationId);
  await ensurePropertyScopeAccess(localUser.id, property.organizationId, property.id);

  const existingDevice = await loadPropertyDeviceById(getDbClient(), deviceId);

  if (!existingDevice || existingDevice.propertyId !== property.id) {
    throw new HttpError(404, "Property device not found.");
  }

  if (existingDevice.status === "retired") {
    return toPropertyDeviceSummary(existingDevice);
  }

  const retiredDevice = await updatePropertyDeviceStatus(getDbClient(), existingDevice.id, "retired");
  return toPropertyDeviceSummary(retiredDevice);
}

export async function deletePropertyDeviceRecordForAuthenticatedUser(
  authUser: AuthenticatedSupabaseUser,
  propertyId: string,
  deviceId: string
): Promise<void> {
  const localUser = await syncAuthenticatedUser(authUser);
  const property = await loadPropertyScope(propertyId);

  await ensureOrganizationMembership(localUser.id, property.organizationId);
  await ensurePropertyScopeAccess(localUser.id, property.organizationId, property.id);

  const existingDevice = await loadPropertyDeviceById(getDbClient(), deviceId);

  if (!existingDevice || existingDevice.propertyId !== property.id) {
    throw new HttpError(404, "Property device not found.");
  }

  if (existingDevice.status !== "retired") {
    throw new HttpError(409, "Unpair the device before deleting its record.");
  }

  await prisma.$transaction(async (tx) => {
    const db = tx as RawDbClient;

    if (await propertyDeviceHasPunches(db, existingDevice.id)) {
      throw new HttpError(409, "This device has recorded punches and cannot be deleted.");
    }

    await deletePropertyDeviceRecord(db, existingDevice.id);
  });
}

export async function createPropertyDevicePairingTokenForAuthenticatedUser(
  authUser: AuthenticatedSupabaseUser,
  propertyId: string
): Promise<PropertyDevicePairingTokenResult> {
  const localUser = await syncAuthenticatedUser(authUser);
  const property = await loadPropertyScope(propertyId);

  await ensureOrganizationMembership(localUser.id, property.organizationId);
  await ensurePropertyScopeAccess(localUser.id, property.organizationId, property.id);

  const token = buildPairingToken();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.propertyDevicePairingToken.create({
    data: {
      organizationId: property.organizationId,
      propertyId: property.id,
      tokenHash: hashPairingToken(token),
      expiresAt,
      createdByUserId: localUser.id,
    },
  });

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    qrValue: JSON.stringify({
      kind: "workforce.kiosk_pairing",
      token,
      expiresAt: expiresAt.toISOString(),
    }),
  };
}

export async function completeQrPropertyDevicePairing(input: {
  deviceName: string;
  deviceType: string;
  token: string;
}): Promise<DeviceRegistrationResult> {
  const token = normalizeRequiredText(input.token, "token");
  const deviceName = normalizeRequiredText(input.deviceName, "deviceName");
  const deviceType = normalizeDeviceType(input.deviceType);
  const tokenHash = hashPairingToken(token);

  const result = await prisma.$transaction(async (tx) => {
    const db = tx as RawDbClient;
    const pairingToken = await consumePropertyDevicePairingToken(db, tokenHash);

    if (!pairingToken) {
      const existingToken = await loadPropertyDevicePairingTokenByHash(db, tokenHash);

      if (!existingToken) {
        throw new HttpError(404, "Pairing token was not recognized.");
      }

      if (existingToken.consumedAt) {
        throw new HttpError(409, "This pairing token has already been used.");
      }

      if (existingToken.expiresAt.getTime() <= Date.now()) {
        throw new HttpError(410, "This pairing token has expired.");
      }

      throw new HttpError(409, "This pairing token is no longer available.");
    }

    const authToken = buildDeviceAuthToken();
    const device = await insertPropertyDevice(
      db,
      pairingToken.propertyId,
      deviceName,
      deviceType,
      buildPairingCode(),
      hashDeviceToken(authToken)
    );

    return {
      authToken,
      device: toPropertyDeviceSummary(device),
    };
  });

  return result;
}

export async function getDeviceContextByToken(authToken: string): Promise<PropertyDeviceSummary> {
  const normalizedToken = normalizeRequiredText(authToken, "deviceToken");
  const device = await loadPropertyDeviceByTokenHash(getDbClient(), hashDeviceToken(normalizedToken));

  if (!device) {
    throw new HttpError(401, "Invalid device token.");
  }

  await ensureDeviceIsActive(device);
  await touchPropertyDeviceLastSeen(getDbClient(), device.id);
  const refreshedDevice = await loadPropertyDeviceById(getDbClient(), device.id);

  if (!refreshedDevice) {
    throw new Error("Unable to reload device context.");
  }

  return toPropertyDeviceSummary(refreshedDevice);
}

export async function verifyEmployeePinForDevice(
  authToken: string,
  input: {
    pin: string;
  }
): Promise<DevicePinVerificationResult> {
  const normalizedToken = normalizeRequiredText(authToken, "deviceToken");
  const pin = normalizeEmployeePin(input.pin);
  const device = await loadPropertyDeviceByTokenHash(getDbClient(), hashDeviceToken(normalizedToken));

  if (!device) {
    throw new HttpError(401, "Invalid device token.");
  }

  await ensureDeviceIsActive(device);

  const employee = await resolveEmployeeByPin(device.organizationId, pin);

  if (!isEmploymentActive(employee.employmentStatus)) {
    throw new HttpError(409, "This employee is inactive.");
  }

  await ensureEmployeeAssignedToProperty(getDbClient(), employee.id, device.propertyId, new Date());
  await reconcileOpenShiftForEmployee(employee.id);
  await touchPropertyDeviceLastSeen(getDbClient(), device.id);

  return {
    employee: {
      id: employee.id,
      organizationId: employee.organizationId,
      propertyId: device.propertyId,
      firstName: employee.firstName,
      lastName: employee.lastName,
      employeeCode: employee.employeeCode,
      employmentStatus: employee.employmentStatus,
    },
    nextAction: await resolveNextKioskAction(getDbClient(), employee.id, device.propertyId),
    requiresPhotoCapture: false,
  };
}

export async function recordClientPunchForAuthenticatedUser(
  authUser: AuthenticatedSupabaseUser,
  punchTypeInput: string,
  input: ClientPunchInput
): Promise<PunchMutationResult> {
  const punchType = normalizePunchType(punchTypeInput);
  const organizationId = normalizeRequiredText(input.organizationId, "organizationId");
  const propertyId = normalizeRequiredText(input.propertyId, "propertyId");
  const localUser = await syncAuthenticatedUser(authUser);

  await ensureOrganizationMembership(localUser.id, organizationId);

  const property = await ensurePropertyInOrganization(propertyId, organizationId);
  const employee = await resolveEmployeeInOrganization(
    organizationId,
    input.employeeId ?? null,
    input.employeeCode ?? null,
    localUser.id
  );

  if (!isEmploymentActive(employee.employmentStatus)) {
    throw new HttpError(409, "Only active employees can record punches.");
  }

  const isSelfPunch = employee.userId === localUser.id;

  if (!isSelfPunch) {
    await ensureCanManageOtherEmployeeTime(localUser.id, organizationId, property.id);
  }

  const occurredAt = parseOptionalDateTime(input.occurredAt, "occurredAt") ?? new Date();
  const note = normalizeOptionalText(input.note);
  const photoUrl = normalizeOptionalText(input.photoUrl);
  const breakType = normalizeBreakType(input.breakType);
  const paid = normalizePaidFlag(input.paid);
  await reconcileOpenShiftForEmployee(employee.id);

  return prisma.$transaction(async (tx) =>
    recordPunchTransaction(tx as RawDbClient, {
      createdByUserId: localUser.id,
      employee,
      note,
      occurredAt,
      photoUrl,
      property,
      propertyDeviceId: null,
      punchType,
      source: isSelfPunch ? "mobile" : "admin",
      breakType,
      paid,
    })
  );
}

export async function recordDevicePunch(authToken: string, punchTypeInput: string, input: DevicePunchInput): Promise<PunchMutationResult> {
  const normalizedToken = normalizeRequiredText(authToken, "deviceToken");
  const punchType = normalizePunchType(punchTypeInput);
  const device = await loadPropertyDeviceByTokenHash(getDbClient(), hashDeviceToken(normalizedToken));

  if (!device) {
    throw new HttpError(401, "Invalid device token.");
  }

  await ensureDeviceIsActive(device);

  const employee = await resolveEmployeeInOrganization(
    device.organizationId,
    input.employeeId ?? null,
    input.employeeCode ?? null
  );

  if (!isEmploymentActive(employee.employmentStatus)) {
    throw new HttpError(409, "Only active employees can record punches.");
  }

  const property: PropertyScopeRecord = {
    id: device.propertyId,
    organizationId: device.organizationId,
    name: device.propertyName,
    timezone: device.timezone,
    status: "active",
  };
  const occurredAt = parseOptionalDateTime(input.occurredAt, "occurredAt") ?? new Date();
  const note = normalizeOptionalText(input.note);
  const photoUrl = normalizeOptionalText(input.photoUrl);
  const breakType = normalizeBreakType(input.breakType);
  const paid = normalizePaidFlag(input.paid);
  await reconcileOpenShiftForEmployee(employee.id);

  const result = await prisma.$transaction(async (tx) => {
    const db = tx as RawDbClient;
    const mutationResult = await recordPunchTransaction(db, {
      createdByUserId: null,
      employee,
      note,
      occurredAt,
      photoUrl,
      property,
      propertyDeviceId: device.id,
      punchType,
      source: normalizePunchSource(device.deviceType === "kiosk" ? "kiosk" : "mobile"),
      breakType,
      paid,
    });

    await touchPropertyDeviceLastSeen(db, device.id);

    return mutationResult;
  });

  return result;
}

function normalizeClientEventId(value: string | null | undefined): string {
  const normalizedValue = normalizeRequiredText(value, "clientEventId");

  if (normalizedValue.length > 128) {
    throw new HttpError(400, "clientEventId is too long.");
  }

  return normalizedValue;
}

function normalizeKioskSyncType(value: string | null | undefined): PunchType {
  if (value === "IN") {
    return "clock_in";
  }

  if (value === "OUT") {
    return "clock_out";
  }

  throw new HttpError(400, "type must be IN or OUT.");
}

function isSuspiciousDeviceTimestamp(value: Date): boolean {
  const now = Date.now();
  const timestamp = value.getTime();
  const futureToleranceMs = 10 * 60 * 1000;
  const pastToleranceMs = 7 * 24 * 60 * 60 * 1000;

  return timestamp > now + futureToleranceMs || timestamp < now - pastToleranceMs;
}

export async function syncDeviceClockEvents(
  authToken: string,
  input: KioskClockEventSyncInput
): Promise<KioskClockEventSyncResult> {
  const normalizedToken = normalizeRequiredText(authToken, "deviceToken");
  const device = await loadPropertyDeviceByTokenHash(getDbClient(), hashDeviceToken(normalizedToken));

  if (!device) {
    throw new HttpError(401, "Invalid device token.");
  }

  await ensureDeviceIsActive(device);

  if (normalizeOptionalText(input.kioskDeviceId) && input.kioskDeviceId !== device.id) {
    throw new HttpError(403, "Kiosk device is not authorized for this sync request.");
  }

  if (normalizeOptionalText(input.propertyId) && input.propertyId !== device.propertyId) {
    throw new HttpError(403, "Kiosk device is not authorized for this property.");
  }

  const events = Array.isArray(input.events) ? input.events : [];
  const results: KioskClockEventSyncResult["results"] = [];
  const property: PropertyScopeRecord = {
    id: device.propertyId,
    organizationId: device.organizationId,
    name: device.propertyName,
    timezone: device.timezone,
    status: "active",
  };

  for (const event of events) {
    let clientEventId = "";

    try {
      clientEventId = normalizeClientEventId(event.clientEventId);
      const existingPunch = await loadTimePunchByClientEventId(getDbClient(), clientEventId);

      if (existingPunch) {
        results.push({
          clientEventId,
          status: "DUPLICATE",
          serverEventId: existingPunch.id,
          message: "Clock event was already processed.",
        });
        continue;
      }

      const punchType = normalizeKioskSyncType(event.type);
      const occurredAt = parseRequiredDateTime(event.deviceTimestamp, "deviceTimestamp");

      if (isSuspiciousDeviceTimestamp(occurredAt)) {
        results.push({
          clientEventId,
          status: "CONFLICT",
          message: "Device timestamp is outside the allowed sync window.",
        });
        continue;
      }

      const employee = await resolveEmployeeInOrganization(device.organizationId, event.employeeId ?? null, null);

      if (!isEmploymentActive(employee.employmentStatus)) {
        results.push({
          clientEventId,
          status: "CONFLICT",
          message: "Employee is inactive.",
        });
        continue;
      }

      await reconcileOpenShiftForEmployee(employee.id);
      const mutationResult = await prisma.$transaction(async (tx) => {
        const db = tx as RawDbClient;
        const duplicate = await loadTimePunchByClientEventId(db, clientEventId);

        if (duplicate) {
          return {
            duplicate,
            mutation: null,
          };
        }

        const mutation = await recordPunchTransaction(db, {
          createdByUserId: null,
          employee,
          note: null,
          occurredAt,
          photoUrl: null,
          property,
          propertyDeviceId: device.id,
          punchType,
          source: "kiosk",
          clientEventId,
        });

        await touchPropertyDeviceLastSeen(db, device.id);

        return {
          duplicate: null,
          mutation,
        };
      });

      if (mutationResult.duplicate) {
        results.push({
          clientEventId,
          status: "DUPLICATE",
          serverEventId: mutationResult.duplicate.id,
          message: "Clock event was already processed.",
        });
      } else {
        results.push({
          clientEventId,
          status: "ACCEPTED",
          serverEventId: mutationResult.mutation?.punch.id ?? null,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Clock event sync failed.";
      results.push({
        clientEventId: clientEventId || String(event.clientEventId ?? ""),
        status: error instanceof HttpError && error.statusCode >= 400 && error.statusCode < 500 ? "CONFLICT" : "REJECTED",
        message,
      });
    }
  }

  return {
    serverTime: new Date().toISOString(),
    results,
  };
}

export async function listShiftsForAuthenticatedUser(
  authUser: AuthenticatedSupabaseUser,
  organizationIdInput: string,
  filters: ShiftListFilters
): Promise<{
  shifts: TimeShiftSessionSummary[];
  scope: {
    employeeId: string | null;
    organizationId: string;
    propertyIds: string[] | null;
  };
}> {
  const organizationId = normalizeRequiredText(organizationIdInput, "organizationId");
  const propertyId = normalizeOptionalText(filters.propertyId);
  const employeeId = normalizeOptionalText(filters.employeeId);
  const status = normalizeShiftStatus(filters.status);
  const localUser = await syncAuthenticatedUser(authUser);
  const permissionKeys = await getPermissionKeys(localUser.id, organizationId);
  const canReadAllTime = hasTimeReadPermission(permissionKeys);

  await ensureOrganizationMembership(localUser.id, organizationId);

  if (propertyId) {
    await ensurePropertyInOrganization(propertyId, organizationId);
  }

  const targetEmployee = employeeId
    ? await resolveEmployeeInOrganization(organizationId, employeeId, null, null)
    : canReadAllTime
      ? null
      : await resolveEmployeeInOrganization(organizationId, null, null, localUser.id).catch(() => null);
  const readableScope = await ensureCanReadTimeScope(localUser.id, organizationId, propertyId, targetEmployee);

  const shifts = await listShiftRows(getDbClient(), {
    organizationId,
    employeeId: targetEmployee?.id ?? null,
    propertyIds: readableScope.propertyIds,
    businessDateFrom: normalizeOptionalText(filters.businessDateFrom),
    businessDateTo: normalizeOptionalText(filters.businessDateTo),
    status,
  });
  const adjustmentCounts = await loadShiftAdjustmentCounts(
    getDbClient(),
    shifts.map((shift) => shift.id)
  );
  const payrollImpactByShiftId = new Map<string, TimeShiftSessionSummary["payrollImpact"]>();

  for (const [currentPropertyId, propertyShifts] of Array.from(
    shifts.reduce((accumulator, shift) => {
      const existing = accumulator.get(shift.propertyId) ?? [];
      existing.push(shift);
      accumulator.set(shift.propertyId, existing);
      return accumulator;
    }, new Map<string, TimeShiftSessionRecord[]>()).entries()
  )) {
    const impact = await getPayrollImpactForShifts(
      currentPropertyId,
      propertyShifts.map((shift) => ({
        shiftSessionId: shift.id,
        startedAt: shift.startedAt,
        businessDate: formatDateOnly(shift.businessDate),
      }))
    );

    for (const [shiftId, shiftImpact] of impact.entries()) {
      payrollImpactByShiftId.set(shiftId, shiftImpact);
    }
  }

  const shiftSummaries = await Promise.all(
    shifts.map(async (shift) => {
      const breaks = await listShiftBreakSegments(getDbClient(), shift.id);
      return toTimeShiftSessionSummary(shift, breaks, {
        hasAdjustments: (adjustmentCounts.get(shift.id) ?? 0) > 0,
        payrollImpact: payrollImpactByShiftId.get(shift.id) ?? buildEmptyPayrollImpact(),
      });
    })
  );

  return {
    shifts: shiftSummaries,
    scope: {
      organizationId,
      employeeId: targetEmployee?.id ?? null,
      propertyIds: readableScope.propertyIds,
    },
  };
}

export async function adjustShiftForAuthenticatedUser(
  authUser: AuthenticatedSupabaseUser,
  organizationIdInput: string,
  shiftSessionIdInput: string,
  input: ShiftAdjustmentInput
): Promise<ShiftAdjustmentResult> {
  const organizationId = normalizeRequiredText(organizationIdInput, "organizationId");
  const shiftSessionId = normalizeRequiredText(shiftSessionIdInput, "shiftSessionId");
  const reason = normalizeRequiredText(input.reason, "reason");
  const localUser = await syncAuthenticatedUser(authUser);

  await ensureOrganizationMembership(localUser.id, organizationId);

  const shiftWithBreaks = await loadShiftWithBreaks(getDbClient(), shiftSessionId);

  if (!shiftWithBreaks || shiftWithBreaks.shift.organizationId !== organizationId) {
    throw new HttpError(404, "Shift session not found in this organization.");
  }

  const existingShift = shiftWithBreaks;

  const property = await ensurePropertyInOrganization(existingShift.shift.propertyId, organizationId);
  await ensureCanManageOtherEmployeeTime(localUser.id, organizationId, existingShift.shift.propertyId);

  const nextStartedAt = parseOptionalDateTime(input.startedAt, "startedAt") ?? existingShift.shift.startedAt;
  const nextEndedAt = input.endedAt !== undefined ? parseOptionalDateTime(input.endedAt, "endedAt") : existingShift.shift.endedAt;
  const nextBusinessDate = buildBusinessDateForTimezone(nextStartedAt, property.timezone);
  const nextAutoCloseAfterHours = await loadPropertyAutoCloseAfterHours(property.id, nextStartedAt);
  const nextAutoCloseAt = new Date(nextStartedAt.getTime() + nextAutoCloseAfterHours * 60 * 60 * 1000);

  if (nextEndedAt && nextEndedAt < nextStartedAt) {
    throw new HttpError(400, "endedAt must be on or after startedAt.");
  }

  const payrollRunIds = await collectPayrollRunIdsForShiftMutation({
    propertyId: existingShift.shift.propertyId,
    before: {
      startedAt: existingShift.shift.startedAt,
      businessDate: formatDateOnly(existingShift.shift.businessDate),
    },
    after: {
      startedAt: nextStartedAt,
      businessDate: nextBusinessDate,
    },
  });

  const normalizedBreakSegments =
    input.breakSegments === undefined
      ? normalizePersistedBreakSegmentsForAdjustment(existingShift.breaks, nextStartedAt, nextEndedAt)
      : normalizeBreakSegmentsForAdjustment(input.breakSegments, nextStartedAt, nextEndedAt);
  const payableMinutesOverride = parsePositiveInteger(input.payableMinutes, "payableMinutes");
  const computedSession = computeSessionTotals(nextStartedAt, nextEndedAt, normalizedBreakSegments, payableMinutesOverride);
  const beforeSummary = toTimeShiftSessionSummary(existingShift.shift, existingShift.breaks);

  const result = await prisma.$transaction(async (tx) => {
    const db = tx as RawDbClient;

    if (nextStartedAt.getTime() !== existingShift.shift.startedAt.getTime()) {
      await db.$executeRawUnsafe(
        `
          UPDATE "time_shift_sessions"
          SET
            "started_at" = $2,
            "business_date" = CAST($3 AS DATE),
            "auto_close_at" = $4,
            "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = CAST($1 AS UUID)
        `,
        shiftSessionId,
        nextStartedAt,
        nextBusinessDate,
        nextAutoCloseAt
      );
    }

    if (input.breakSegments !== undefined) {
      await replaceShiftBreakSegments(db, shiftSessionId, normalizedBreakSegments);
    }

    const updatedShift = await updateShiftSession(db, {
      shiftSessionId,
      clockOutPunchId: existingShift.shift.clockOutPunchId,
      endedAt: nextEndedAt,
      status: nextEndedAt ? "edited" : "open",
      totalMinutes: computedSession.totalMinutes,
      breakMinutes: computedSession.breakMinutes,
      payableMinutes: computedSession.payableMinutes,
    });
    const refreshedSummary = await hydrateShiftSummary(db, shiftSessionId);
    const adjustmentId = await insertTimeAdjustment(db, {
      shiftSessionId,
      organizationId,
      propertyId: updatedShift.propertyId,
      employeeId: updatedShift.employeeId,
      adjustedByUserId: localUser.id,
      reason,
      beforeSnapshot: beforeSummary,
      afterSnapshot: refreshedSummary,
    });

    return {
      adjustmentId,
      shift: refreshedSummary,
    };
  });

  await revalidatePayrollRunsForShiftMutation(payrollRunIds, existingShift.shift.employeeId);
  return result;
}

export async function createManualShiftForAuthenticatedUser(
  authUser: AuthenticatedSupabaseUser,
  organizationIdInput: string,
  input: ManualShiftCreateInput
): Promise<ShiftAdjustmentResult> {
  const organizationId = normalizeRequiredText(organizationIdInput, "organizationId");
  const propertyId = normalizeRequiredText(input.propertyId, "propertyId");
  const employeeId = normalizeRequiredText(input.employeeId, "employeeId");
  const reason = normalizeRequiredText(input.reason, "reason");
  const localUser = await syncAuthenticatedUser(authUser);

  await ensureOrganizationMembership(localUser.id, organizationId);

  const property = await ensurePropertyInOrganization(propertyId, organizationId);
  await ensureCanManageOtherEmployeeTime(localUser.id, organizationId, propertyId);

  const employee = await resolveEmployeeInOrganization(organizationId, employeeId, null, null);
  const startedAt = parseRequiredDateTime(input.startedAt, "startedAt");
  const endedAt = parseRequiredDateTime(input.endedAt, "endedAt");

  if (endedAt < startedAt) {
    throw new HttpError(400, "endedAt must be on or after startedAt.");
  }

  await ensureEmployeeAssignedToProperty(getDbClient(), employee.id, property.id, startedAt, {
    allowCurrentAssignmentFallback: true,
  });

  const normalizedBreakSegments = normalizeBreakSegmentsForAdjustment(input.breakSegments ?? [], startedAt, endedAt).map(
    (segment) => ({
      ...segment,
      source: "manual",
    })
  );
  const payableMinutesOverride = parsePositiveInteger(input.payableMinutes, "payableMinutes");
  const computedSession = computeSessionTotals(startedAt, endedAt, normalizedBreakSegments, payableMinutesOverride);
  const businessDate = buildBusinessDateForTimezone(startedAt, property.timezone);
  const autoCloseAfterHours = await loadPropertyAutoCloseAfterHours(property.id, startedAt);
  const autoCloseAt = new Date(startedAt.getTime() + autoCloseAfterHours * 60 * 60 * 1000);
  const payrollRunIds = await collectPayrollRunIdsForShiftMutation({
    propertyId: property.id,
    after: {
      startedAt,
      businessDate,
    },
  });

  const result = await prisma.$transaction(async (tx) => {
    const db = tx as RawDbClient;
    const clockInPunch = await insertTimePunch(db, {
      organizationId,
      propertyId: property.id,
      employeeId: employee.id,
      propertyDeviceId: null,
      punchType: "clock_in",
      occurredAt: startedAt,
      businessDate,
      source: "manual",
      photoUrl: null,
      note: `Manual shift created: ${reason}`,
      createdByUserId: localUser.id,
    });
    const shift = await insertShiftSession(db, {
      organizationId,
      propertyId: property.id,
      employeeId: employee.id,
      clockInPunchId: clockInPunch.id,
      startedAt,
      autoCloseAt,
      businessDate,
      entryMode: "manual",
    });

    for (const segment of normalizedBreakSegments) {
      await insertBreakSegment(db, {
        shiftSessionId: shift.id,
        breakType: segment.breakType,
        paid: segment.paid,
        startedAt: segment.startedAt,
        endedAt: segment.endedAt,
        durationMinutes: segment.durationMinutes,
        source: segment.source,
      });
    }

    const clockOutPunch = await insertTimePunch(db, {
      organizationId,
      propertyId: property.id,
      employeeId: employee.id,
      propertyDeviceId: null,
      punchType: "clock_out",
      occurredAt: endedAt,
      businessDate: buildBusinessDateForTimezone(endedAt, property.timezone),
      source: "manual",
      photoUrl: null,
      note: `Manual shift created: ${reason}`,
      createdByUserId: localUser.id,
    });

    await updateShiftSession(db, {
      shiftSessionId: shift.id,
      clockOutPunchId: clockOutPunch.id,
      endedAt,
      status: "closed",
      totalMinutes: computedSession.totalMinutes,
      breakMinutes: computedSession.breakMinutes,
      payableMinutes: computedSession.payableMinutes,
    });

    const afterSummary = await hydrateShiftSummary(db, shift.id);
    const adjustmentId = await insertTimeAdjustment(db, {
      shiftSessionId: shift.id,
      organizationId,
      propertyId: property.id,
      employeeId: employee.id,
      adjustedByUserId: localUser.id,
      reason: `Manual shift created. ${reason}`,
      beforeSnapshot: afterSummary,
      afterSnapshot: afterSummary,
    });

    return {
      adjustmentId,
      shift: afterSummary,
    };
  });

  await revalidatePayrollRunsForShiftMutation(payrollRunIds, employee.id);
  return result;
}
