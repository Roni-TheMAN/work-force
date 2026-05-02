import { prisma } from "../../lib/prisma";
import { PERMISSIONS } from "../../lib/permissions";
import { env } from "../../lib/env";
import type { AuthenticatedSupabaseUser } from "../../lib/supabase-auth";
import { HttpError } from "../../lib/http-error";
import { hasEffectivePropertyPermission, type PropertyRequestContext } from "./property.middleware";
import { normalizeEmployeePinMode, prepareEmployeePinAssignment, recordEmployeePinEvent } from "../../services/employee-pin.service";
import { syncAuthenticatedUser } from "../../services/user-sync.service";
import { allocateWeeklyOvertimeMinutes, getPayrollImpactForShifts } from "./property-payroll-runs";
import {
  advancePropertyPayrollPeriod as advancePropertyPayrollPeriodState,
  buildPropertyDashboardMetrics,
  updatePropertyOperationalSettings,
} from "./property-payroll";

type CreatePropertyEmployeeInput = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  employeeCode?: string | null;
  createLoginAccount?: boolean;
  loginPassword?: string | null;
  propertyRole?: "manager" | "property_admin" | "scheduler" | "viewer" | null;
  pinMode?: "auto" | "manual" | null;
  manualPin?: string | null;
};

type SupabaseAuthPayload = {
  access_token?: string;
  error?: string;
  error_description?: string;
  msg?: string;
  user?: {
    email?: string;
    id?: string;
    phone?: string;
    role?: string;
    user_metadata?: Record<string, unknown>;
  };
};

type WorkforceEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  employeeCode: string | null;
  employmentStatus: string;
  userId: string | null;
  isPrimary: boolean;
  activeFrom: Date | null;
  activeTo: Date | null;
};

type PropertyTimeLogFilters = {
  businessDateFrom?: string | null;
  businessDateTo?: string | null;
  employeeId?: string | null;
  flags?: string[];
  status?: string | null;
};

type PropertyTimeFlagFilter = "auto_closed" | "edited" | "locked" | "manual";

const operationalConfig = {
  overtimeHours: 40,
  autoClockOutHours: 12,
  schedulingEnabled: true,
} as const;

const DEFAULT_WEEK_ANCHOR_DATE = "1970-01-05";

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const normalizedValue = normalizeOptionalText(value);
  return normalizedValue ? normalizedValue.toLowerCase() : null;
}

function normalizeCountryCode(value: string | null | undefined): string | null {
  const normalizedValue = normalizeOptionalText(value);
  return normalizedValue ? normalizedValue.toUpperCase() : null;
}

function formatEmployeeName(employee: Pick<WorkforceEmployee, "firstName" | "lastName">): string {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

function normalizeDateOnlyFilter(value: string | null | undefined, fieldName: string): string | null {
  const normalizedValue = normalizeOptionalText(value);

  if (!normalizedValue) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    throw new HttpError(400, `${fieldName} must be in YYYY-MM-DD format.`);
  }

  const parsedValue = new Date(`${normalizedValue}T00:00:00.000Z`);

  if (Number.isNaN(parsedValue.getTime()) || parsedValue.toISOString().slice(0, 10) !== normalizedValue) {
    throw new HttpError(400, `${fieldName} must be a valid date.`);
  }

  return normalizedValue;
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatHoursFromMinutes(minutes: number): number {
  return Number((minutes / 60).toFixed(1));
}

function normalizeTimeStatusFilter(value: string | null | undefined): "auto_closed" | "closed" | "edited" | "open" | null {
  const normalizedValue = normalizeOptionalText(value)?.toLowerCase();

  if (!normalizedValue || normalizedValue === "all") {
    return null;
  }

  if (
    normalizedValue !== "auto_closed" &&
    normalizedValue !== "closed" &&
    normalizedValue !== "edited" &&
    normalizedValue !== "open"
  ) {
    throw new HttpError(400, "status must be one of open, closed, edited, auto_closed, or all.");
  }

  return normalizedValue;
}

function normalizeTimeFlagFilters(value: string[] | undefined): Set<PropertyTimeFlagFilter> {
  const allowedFlags = new Set<PropertyTimeFlagFilter>(["auto_closed", "edited", "locked", "manual"]);
  const flags = new Set<PropertyTimeFlagFilter>();

  for (const rawValue of value ?? []) {
    const normalizedValue = normalizeOptionalText(rawValue)?.toLowerCase();

    if (!normalizedValue) {
      continue;
    }

    if (!allowedFlags.has(normalizedValue as PropertyTimeFlagFilter)) {
      throw new HttpError(400, "flags must only contain manual, edited, auto_closed, or locked.");
    }

    flags.add(normalizedValue as PropertyTimeFlagFilter);
  }

  return flags;
}

function buildDateRangeLabels(dateFrom: string | null, dateTo: string | null, fallbackDates: string[]) {
  if (dateFrom && dateTo) {
    const labels: string[] = [];
    const cursor = new Date(`${dateFrom}T00:00:00.000Z`);
    const end = new Date(`${dateTo}T00:00:00.000Z`);

    while (cursor.getTime() <= end.getTime()) {
      labels.push(formatDateOnly(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return labels;
  }

  return Array.from(new Set(fallbackDates)).sort();
}

function toShortDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function matchesAnyFlag(
  flags: Set<PropertyTimeFlagFilter>,
  value: {
    autoClosed: boolean;
    edited: boolean;
    locked: boolean;
    manual: boolean;
  }
) {
  if (flags.size === 0) {
    return true;
  }

  return (
    (flags.has("manual") && value.manual) ||
    (flags.has("edited") && value.edited) ||
    (flags.has("auto_closed") && value.autoClosed) ||
    (flags.has("locked") && value.locked)
  );
}

function hashValue(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function seeded(seed: number, offset: number): number {
  const next = Math.sin(seed + offset * 97.13) * 10000;
  return next - Math.floor(next);
}

function seededInt(seed: number, offset: number, min: number, max: number): number {
  return Math.round(min + seeded(seed, offset) * (max - min));
}

function seededFloat(seed: number, offset: number, min: number, max: number, precision = 1): number {
  const raw = min + seeded(seed, offset) * (max - min);
  return Number(raw.toFixed(precision));
}

function formatHourLabel(hour: number): string {
  const normalizedHour = ((hour + 11) % 12) + 1;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${normalizedHour}:00 ${suffix}`;
}

function getResponseErrorMessage(payload: SupabaseAuthPayload): string {
  return payload.error_description ?? payload.msg ?? payload.error ?? "Unknown Supabase auth error.";
}

function toAuthenticatedSupabaseUser(
  payload: SupabaseAuthPayload,
  fullName: string
): AuthenticatedSupabaseUser {
  const user = payload.user;

  if (!user?.id || !user.email) {
    throw new HttpError(502, "Supabase did not return a valid user record.");
  }

  return {
    token: payload.access_token ?? "",
    id: user.id,
    email: user.email,
    fullName,
    avatarUrl: null,
    phone: user.phone ?? null,
    role: user.role ?? null,
  };
}

async function requestSupabaseAuth(
  path: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; payload: SupabaseAuthPayload }> {
  if (!env.supabaseAnonKey) {
    throw new HttpError(500, "SUPABASE_ANON_KEY is required for employee login provisioning.");
  }

  const response = await fetch(`${env.supabaseIssuer}${path}`, {
    method: "POST",
    headers: {
      apikey: env.supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as SupabaseAuthPayload;

  return {
    ok: response.ok,
    payload,
  };
}

async function provisionSupabaseUser(email: string, password: string, fullName: string) {
  const signUpResponse = await requestSupabaseAuth("/signup", {
    email,
    password,
    data: {
      full_name: fullName,
    },
  });

  if (!signUpResponse.ok) {
    throw new HttpError(
      409,
      `Unable to create employee login for ${email}. ${getResponseErrorMessage(signUpResponse.payload)}`
    );
  }

  return toAuthenticatedSupabaseUser(signUpResponse.payload, fullName);
}

function getPropertyRoleName(role: CreatePropertyEmployeeInput["propertyRole"]): string {
  switch (role) {
    case "property_admin":
      return "Admin";
    case "manager":
      return "Manager";
    case "scheduler":
      return "Scheduler";
    case "viewer":
    default:
      return "Viewer";
  }
}

function ensurePropertyRoleIsAllowed(canAssignElevatedRoles: boolean, requestedRole: string) {
  const normalizedRequestedRole = requestedRole.toLowerCase();

  if (canAssignElevatedRoles) {
    return;
  }

  if (normalizedRequestedRole !== "viewer" && normalizedRequestedRole !== "scheduler") {
    throw new HttpError(403, "Managers can only assign viewer or scheduler property access.");
  }
}

async function ensureRoleIdsForOrganization(organizationId: string) {
  const roles = await prisma.organizationRole.findMany({
    where: {
      organizationId,
      name: {
        in: ["Admin", "Manager", "Scheduler", "Viewer"],
      },
    },
    select: {
      id: true,
      name: true,
      description: true,
      permissions: {
        select: {
          key: true,
        },
      },
    },
  });

  const roleIds = Object.fromEntries(roles.map((role) => [role.name, role.id]));

  if (!roleIds.Viewer || !roleIds.Manager || !roleIds.Scheduler || !roleIds.Admin) {
    throw new HttpError(500, "System property roles are not configured for this organization.");
  }

  return roleIds as Record<"Admin" | "Manager" | "Scheduler" | "Viewer", string>;
}

function getAssignablePropertyRoleNameFromKey(roleKey: string): string {
  switch (roleKey) {
    case "property_admin":
      return "Property admin";
    case "manager":
      return "Manager";
    case "scheduler":
      return "Scheduler";
    case "viewer":
      return "Viewer";
    default:
      return roleKey;
  }
}

function buildPropertyPermissionSnapshot(context: PropertyRequestContext) {
  const permissionKeys = new Set(context.permissions.effective);

  const availableSections = [
    permissionKeys.has(PERMISSIONS.PROPERTY_READ) ? "overview" : null,
    permissionKeys.has(PERMISSIONS.EMPLOYEE_READ) ? "workforce" : null,
    permissionKeys.has(PERMISSIONS.SCHEDULE_READ) ? "clock" : null,
    permissionKeys.has(PERMISSIONS.SCHEDULE_READ) ? "time" : null,
    permissionKeys.has(PERMISSIONS.SCHEDULE_READ) ? "schedule" : null,
    permissionKeys.has(PERMISSIONS.PAYROLL_READ) || permissionKeys.has(PERMISSIONS.PAYROLL_WRITE) ? "payroll" : null,
    permissionKeys.has(PERMISSIONS.PROPERTY_WRITE) ? "access" : null,
    permissionKeys.has(PERMISSIONS.PROPERTY_WRITE) ? "settings" : null,
  ].filter(
    (
      section
    ): section is "access" | "clock" | "overview" | "payroll" | "schedule" | "settings" | "time" | "workforce" =>
      Boolean(section)
  );

  return {
    propertyId: context.property.id,
    organizationId: context.property.organizationId,
    effectivePermissions: context.permissions.effective,
    canBypassPropertyScope: context.permissions.canBypassPropertyScope,
    canViewOverview: permissionKeys.has(PERMISSIONS.PROPERTY_READ),
    canViewWorkforce: permissionKeys.has(PERMISSIONS.EMPLOYEE_READ),
    canViewTime: permissionKeys.has(PERMISSIONS.SCHEDULE_READ),
    canViewSchedule: permissionKeys.has(PERMISSIONS.SCHEDULE_READ),
    canViewPayroll: permissionKeys.has(PERMISSIONS.PAYROLL_READ) || permissionKeys.has(PERMISSIONS.PAYROLL_WRITE),
    canManageAccess: permissionKeys.has(PERMISSIONS.PROPERTY_WRITE),
    canManageSettings: permissionKeys.has(PERMISSIONS.PROPERTY_WRITE),
    canCreateEmployees: permissionKeys.has(PERMISSIONS.EMPLOYEE_WRITE),
    canAssignElevatedRoles:
      context.permissions.canBypassPropertyScope || permissionKeys.has(PERMISSIONS.PROPERTY_WRITE),
    availableSections,
  };
}

async function listScopedEmployees(propertyId: string): Promise<WorkforceEmployee[]> {
  const assignments = await prisma.employeePropertyAssignment.findMany({
    where: {
      propertyId,
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          employeeCode: true,
          employmentStatus: true,
          userId: true,
        },
      },
    },
    orderBy: [{ isPrimary: "desc" }, { employee: { firstName: "asc" } }],
  });

  return assignments.map((assignment) => ({
    id: assignment.employee.id,
    firstName: assignment.employee.firstName,
    lastName: assignment.employee.lastName,
    email: assignment.employee.email,
    phone: assignment.employee.phone,
    employeeCode: assignment.employee.employeeCode,
    employmentStatus: assignment.employee.employmentStatus,
    userId: assignment.employee.userId,
    isPrimary: assignment.isPrimary,
    activeFrom: assignment.activeFrom,
    activeTo: assignment.activeTo,
  }));
}

function buildWorkforce(propertyId: string, employees: WorkforceEmployee[]) {
  return employees.map((employee, index) => {
    const seed = hashValue(`${propertyId}:${employee.id}:${index}`);
    const employmentIsActive = employee.employmentStatus.toLowerCase() === "active";
    const weeklyHours = employmentIsActive ? seededFloat(seed, 1, 24, 46) : 0;
    const todayHours = employmentIsActive ? seededFloat(seed, 2, 0, 9) : 0;
    const shiftStartHour = seededInt(seed, 3, 6, 13);
    const shiftDuration = seededInt(seed, 4, 6, 9);
    const shiftEndHour = Math.min(23, shiftStartHour + shiftDuration);
    const attendanceStatus = employmentIsActive
      ? todayHours > 4.5
        ? "clocked-in"
        : todayHours > 0
          ? "scheduled"
          : "off-shift"
      : "inactive";
    const overtimeHours = Math.max(0, Number((weeklyHours - operationalConfig.overtimeHours).toFixed(1)));
    const estimatedHourlyRate = seededFloat(seed, 5, 18, 32, 2);

    return {
      id: employee.id,
      userId: employee.userId,
      employeeCode: employee.employeeCode,
      name: formatEmployeeName(employee),
      email: employee.email,
      phone: employee.phone,
      employmentStatus: employee.employmentStatus,
      attendanceStatus,
      todayHours,
      weeklyHours,
      overtimeHours,
      estimatedHourlyRate,
      shiftLabel: `${formatHourLabel(shiftStartHour)} - ${formatHourLabel(shiftEndHour)}`,
      isPrimary: employee.isPrimary,
      activeFrom: employee.activeFrom?.toISOString() ?? null,
      activeTo: employee.activeTo?.toISOString() ?? null,
    };
  });
}

function buildOpenShifts(propertyId: string, workforce: ReturnType<typeof buildWorkforce>) {
  const roleLabels = ["Front desk", "Housekeeping", "Maintenance", "Security"];
  const openShiftCount = Math.max(1, Math.min(3, Math.ceil((workforce.length || 1) / 2)));
  const seed = hashValue(`${propertyId}:open-shifts`);

  return Array.from({ length: openShiftCount }, (_, index) => {
    const startHour = seededInt(seed, index + 1, 7, 16);

    return {
      id: `open-${propertyId}-${index}`,
      role: roleLabels[index % roleLabels.length] ?? "Coverage",
      start: formatHourLabel(startHour),
      end: formatHourLabel(Math.min(23, startHour + 8)),
      status: index === 0 ? "urgent" : "open",
    };
  });
}

function buildSchedule(propertyId: string, workforce: ReturnType<typeof buildWorkforce>) {
  const today = new Date();

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);

    const shifts = workforce.slice(0, Math.min(workforce.length, 4)).map((employee, employeeIndex) => {
      const seed = hashValue(`${propertyId}:${employee.id}:schedule:${index}`);
      const startHour = seededInt(seed, employeeIndex + 1, 6, 14);
      const endHour = Math.min(23, startHour + seededInt(seed, employeeIndex + 2, 6, 8));

      return {
        id: `${employee.id}-${date.toISOString()}`,
        employeeId: employee.id,
        employeeName: employee.name,
        start: formatHourLabel(startHour),
        end: formatHourLabel(endHour),
        status: employee.attendanceStatus === "inactive" ? "unavailable" : "scheduled",
      };
    });

    return {
      id: date.toISOString(),
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      date: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      shifts,
    };
  });
}

export async function getPropertyOverview(context: PropertyRequestContext) {
  const dashboard = await buildPropertyDashboardMetrics(context);

  return {
    property: dashboard.property,
    activeEmployees: dashboard.overview.activeEmployees,
    hoursToday: dashboard.overview.hoursToday,
    alerts: dashboard.overview.alerts,
  };
}

export async function listPropertyEmployees(context: PropertyRequestContext) {
  const dashboard = await buildPropertyDashboardMetrics(context);

  return {
    propertyId: context.property.id,
    employees: dashboard.workforce,
  };
}

export async function getPropertyTimeLogs(context: PropertyRequestContext, filters?: PropertyTimeLogFilters) {
  const employees = await listScopedEmployees(context.property.id);
  const activePayrollSetting = await prisma.propertyPayrollSetting.findFirst({
    where: {
      propertyId: context.property.id,
      effectiveFrom: {
        lte: new Date(),
      },
      OR: [
        {
          effectiveTo: null,
        },
        {
          effectiveTo: {
            gt: new Date(),
          },
        },
      ],
    },
    include: {
      payrollCalendar: {
        select: {
          anchorStartDate: true,
        },
      },
      defaultOvertimePolicy: {
        select: {
          ot1WeeklyAfterMinutes: true,
        },
      },
    },
    orderBy: {
      effectiveFrom: "desc",
    },
  });
  const normalizedEmployeeId = normalizeOptionalText(filters?.employeeId);
  const businessDateFrom = normalizeDateOnlyFilter(filters?.businessDateFrom, "businessDateFrom");
  const businessDateTo = normalizeDateOnlyFilter(filters?.businessDateTo, "businessDateTo");
  const status = normalizeTimeStatusFilter(filters?.status);
  const flagFilters = normalizeTimeFlagFilters(filters?.flags);

  if (businessDateFrom && businessDateTo && businessDateFrom > businessDateTo) {
    throw new HttpError(400, "businessDateFrom must be on or before businessDateTo.");
  }

  if (
    normalizedEmployeeId &&
    !employees.some((employee) => employee.id === normalizedEmployeeId)
  ) {
    throw new HttpError(404, "Employee is not assigned to this property.");
  }

  const openShifts = await prisma.timeShiftSession.findMany({
    where: {
      propertyId: context.property.id,
      status: "open",
    },
    select: {
      employeeId: true,
      id: true,
    },
  });
  const shifts = await prisma.timeShiftSession.findMany({
    where: {
      organizationId: context.property.organizationId,
      propertyId: context.property.id,
      employeeId: normalizedEmployeeId ?? undefined,
      businessDate: {
        gte: businessDateFrom ? new Date(`${businessDateFrom}T00:00:00.000Z`) : undefined,
        lte: businessDateTo ? new Date(`${businessDateTo}T00:00:00.000Z`) : undefined,
      },
      status: status ?? undefined,
    },
    include: {
      adjustments: {
        select: {
          id: true,
        },
      },
      breakSegments: {
        orderBy: {
          startedAt: "asc",
        },
        select: {
          id: true,
          breakType: true,
          paid: true,
          startedAt: true,
          endedAt: true,
          durationMinutes: true,
          source: true,
          createdAt: true,
        },
      },
      clockInPunch: {
        select: {
          source: true,
        },
      },
      employee: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [
      {
        startedAt: "desc",
      },
    ],
  });
  const payrollImpactByShiftId = await getPayrollImpactForShifts(
    context.property.id,
    shifts.map((shift) => ({
      shiftSessionId: shift.id,
      startedAt: shift.startedAt,
      businessDate: formatDateOnly(shift.businessDate),
    }))
  );
  const mappedShifts = shifts
    .map((shift) => {
      const flags = {
        autoClosed: shift.status === "auto_closed",
        edited: shift.status === "edited" || shift.adjustments.length > 0,
        manual: shift.entryMode === "manual",
        locked: payrollImpactByShiftId.get(shift.id)?.locked ?? false,
      };

      return {
        shiftSessionId: shift.id,
        employeeId: shift.employeeId,
        employeeName: `${shift.employee.firstName} ${shift.employee.lastName}`.trim(),
        startedAt: shift.startedAt.toISOString(),
        endedAt: shift.endedAt?.toISOString() ?? null,
        businessDate: formatDateOnly(shift.businessDate),
        totalMinutes: shift.totalMinutes ?? 0,
        payableMinutes: shift.payableMinutes ?? shift.totalMinutes ?? 0,
        breakMinutes: shift.breakMinutes,
        entryMode: shift.entryMode,
        status: shift.status,
        source: shift.clockInPunch.source,
        payrollImpact: payrollImpactByShiftId.get(shift.id) ?? {
          locked: false,
          payrollPeriodId: null,
          payrollRunId: null,
          payrollRunStatus: null,
        },
        flags,
        breaks: shift.breakSegments.map((segment) => ({
          id: segment.id,
          breakType: segment.breakType,
          paid: segment.paid,
          startedAt: segment.startedAt.toISOString(),
          endedAt: segment.endedAt?.toISOString() ?? null,
          durationMinutes: segment.durationMinutes ?? null,
          source: segment.source,
          createdAt: segment.createdAt.toISOString(),
        })),
      };
    })
    .filter((shift) => matchesAnyFlag(flagFilters, shift.flags));
  const openShiftEmployeeIds = new Set(openShifts.map((shift) => shift.employeeId));
  const overtimeThresholdMinutes =
    activePayrollSetting?.defaultOvertimePolicy?.ot1WeeklyAfterMinutes ?? operationalConfig.overtimeHours * 60;
  const weeklyAllocation = allocateWeeklyOvertimeMinutes({
    shifts: mappedShifts.map((shift) => ({
      shiftId: shift.shiftSessionId,
      employeeId: shift.employeeId,
      businessDate: shift.businessDate,
      payableMinutes: shift.payableMinutes,
    })),
    thresholdMinutes: overtimeThresholdMinutes,
    weekAnchorDate: activePayrollSetting
      ? formatDateOnly(activePayrollSetting.payrollCalendar.anchorStartDate)
      : DEFAULT_WEEK_ANCHOR_DATE,
  });
  const employeeRows = employees
    .filter((employee) => !normalizedEmployeeId || employee.id === normalizedEmployeeId)
    .map((employee) => {
      const employeeShifts = mappedShifts
        .filter((shift) => shift.employeeId === employee.id)
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
      const payableMinutes = employeeShifts.reduce((sum, shift) => sum + shift.payableMinutes, 0);
      const overtimeMinutes = weeklyAllocation.employeeTotals.get(employee.id)?.overtimeMinutes ?? 0;
      const totalMinutes = employeeShifts.reduce((sum, shift) => sum + shift.totalMinutes, 0);
      const flagCounts = employeeShifts.reduce(
        (accumulator, shift) => {
          accumulator.manual += shift.flags.manual ? 1 : 0;
          accumulator.edited += shift.flags.edited ? 1 : 0;
          accumulator.autoClosed += shift.flags.autoClosed ? 1 : 0;
          accumulator.locked += shift.flags.locked ? 1 : 0;
          return accumulator;
        },
        {
          manual: 0,
          edited: 0,
          autoClosed: 0,
          locked: 0,
        }
      );
      const latestActivityAt = employeeShifts[0]?.endedAt ?? employeeShifts[0]?.startedAt ?? null;
      const exceptionCount = employeeShifts.filter(
        (shift) => shift.flags.manual || shift.flags.edited || shift.flags.autoClosed || shift.flags.locked
      ).length;

      return {
        employeeId: employee.id,
        name: formatEmployeeName(employee),
        employmentStatus: employee.employmentStatus,
        attendanceState: openShiftEmployeeIds.has(employee.id) ? "clocked-in" : payableMinutes > 0 ? "worked" : "no-hours",
        latestActivityAt,
        shiftCount: employeeShifts.length,
        totalHours: formatHoursFromMinutes(payableMinutes),
        totalMinutes,
        overtimeHours: formatHoursFromMinutes(overtimeMinutes),
        overtimeMinutes,
        exceptionCount,
        flagCounts,
        shifts: employeeShifts,
      };
    });
  const totalPayableMinutes = employeeRows.reduce((sum, employee) => sum + employee.shifts.reduce((shiftSum, shift) => shiftSum + shift.payableMinutes, 0), 0);
  const totalOvertimeMinutes = employeeRows.reduce((sum, employee) => sum + employee.overtimeMinutes, 0);
  const totalShiftCount = mappedShifts.length;
  const exceptionSummary = mappedShifts.reduce(
    (accumulator, shift) => {
      accumulator.manual += shift.flags.manual ? 1 : 0;
      accumulator.edited += shift.flags.edited ? 1 : 0;
      accumulator.autoClosed += shift.flags.autoClosed ? 1 : 0;
      accumulator.locked += shift.flags.locked ? 1 : 0;
      return accumulator;
    },
    {
      manual: 0,
      edited: 0,
      autoClosed: 0,
      locked: 0,
    }
  );
  const trendLabels = buildDateRangeLabels(
    businessDateFrom,
    businessDateTo,
    mappedShifts.map((shift) => shift.businessDate)
  );
  const dailyTrend = trendLabels.map((businessDate) => {
    const dayShifts = mappedShifts.filter((shift) => shift.businessDate === businessDate);
    const dayMinutes = dayShifts.reduce((sum, shift) => sum + shift.payableMinutes, 0);

    return {
      businessDate,
      label: toShortDateLabel(businessDate),
      hours: formatHoursFromMinutes(dayMinutes),
      shiftCount: dayShifts.length,
      flaggedShifts: dayShifts.filter(
        (shift) => shift.flags.manual || shift.flags.edited || shift.flags.autoClosed || shift.flags.locked
      ).length,
    };
  });

  return {
    propertyId: context.property.id,
    filters: {
      businessDateFrom,
      businessDateTo,
      employeeId: normalizedEmployeeId,
      status,
      flags: Array.from(flagFilters),
    },
    summary: {
      totalPayableHours: formatHoursFromMinutes(totalPayableMinutes),
      employeesWorked: employeeRows.filter((employee) => employee.shifts.length > 0).length,
      openShifts: openShifts.length,
      exceptionCount: mappedShifts.filter(
        (shift) => shift.flags.manual || shift.flags.edited || shift.flags.autoClosed || shift.flags.locked
      ).length,
      averageShiftLengthHours: totalShiftCount > 0 ? formatHoursFromMinutes(Math.round(totalPayableMinutes / totalShiftCount)) : 0,
      overtimeHours: formatHoursFromMinutes(totalOvertimeMinutes),
      shiftCount: totalShiftCount,
    },
    dailyTrend,
    exceptionSummary,
    employeeRows,
  };
}

export async function getPropertyPayrollPreview(context: PropertyRequestContext) {
  const dashboard = await buildPropertyDashboardMetrics(context);

  return {
    propertyId: context.property.id,
    ...dashboard.payroll,
  };
}

export async function getPropertyAccess(context: PropertyRequestContext) {
  await ensureRoleIdsForOrganization(context.property.organizationId);

  const [assignments, availableRoles] = await Promise.all([
    prisma.propertyUserRole.findMany({
      where: {
        propertyId: context.property.id,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        user: {
          email: "asc",
        },
      },
    }),
    prisma.organizationRole.findMany({
      where: {
        organizationId: context.property.organizationId,
        permissions: {
          some: {
            key: PERMISSIONS.PROPERTY_READ,
          },
          none: {
            key: PERMISSIONS.ORG_MANAGE,
          },
        },
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
      },
    }),
  ]);

  return {
    propertyId: context.property.id,
    users: assignments.map((assignment) => ({
      id: assignment.id,
      userId: assignment.userId,
      email: assignment.user.email,
      fullName: assignment.user.fullName,
      avatarUrl: assignment.user.avatarUrl,
      role: assignment.role,
    })),
    availableRoles: availableRoles.map((role) => ({
      id: role.id,
      name: role.name === "Admin" ? "property_admin" : role.name.toLowerCase(),
      displayName: getAssignablePropertyRoleNameFromKey(role.name === "Admin" ? "property_admin" : role.name.toLowerCase()),
      description: role.description,
    })),
  };
}

async function getPropertySwitcherOptions(context: PropertyRequestContext) {
  if (context.permissions.canBypassPropertyScope) {
    return prisma.property.findMany({
      where: {
        organizationId: context.property.organizationId,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    });
  }

  const scopedProperties = await prisma.propertyUserRole.findMany({
    where: {
      userId: context.localUser.id,
      property: {
        organizationId: context.property.organizationId,
      },
    },
    orderBy: {
      property: {
        name: "asc",
      },
    },
    select: {
      property: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return scopedProperties.map((assignment) => assignment.property);
}

export async function getPropertyPermissionSnapshot(context: PropertyRequestContext) {
  return buildPropertyPermissionSnapshot(context);
}

export async function getPropertyDashboard(context: PropertyRequestContext) {
  const permissions = buildPropertyPermissionSnapshot(context);
  const metrics = await buildPropertyDashboardMetrics(context);
  const propertyOptions = await getPropertySwitcherOptions(context);
  const access = permissions.canManageAccess
    ? await getPropertyAccess(context)
    : {
        propertyId: context.property.id,
        users: [],
        availableRoles: [],
      };

  return {
    property: metrics.property,
    propertyOptions,
    permissions,
    payrollConfig: metrics.payrollConfig,
    currentPayPeriod: metrics.currentPayPeriod,
    nextPayPeriod: metrics.nextPayPeriod,
    overview: metrics.overview,
    workforce: permissions.canViewWorkforce ? metrics.workforce : [],
    time: permissions.canViewTime
      ? metrics.time
      : {
          timeline: [],
          openShifts: [],
          weeklyHours: [],
          currentPeriodLabel: null,
          reviewItems: [],
        },
    scheduling: {
      enabled: metrics.scheduling.enabled,
      days: permissions.canViewSchedule ? metrics.scheduling.days : [],
    },
    payroll: permissions.canViewPayroll
      ? metrics.payroll
      : {
          currentPeriod: null,
          nextPeriod: null,
          totalHours: 0,
          estimatedWages: null,
          overtimeHours: 0,
          requiresAttentionCount: 0,
          canAdvancePeriod: false,
          employees: [],
        },
    access,
  };
}

export async function updatePropertyAccess(
  context: PropertyRequestContext,
  input: {
    userId: string;
    roleId: string | null;
  }
) {
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: context.property.organizationId,
        userId: input.userId,
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!membership || membership.status !== "active") {
    throw new HttpError(404, "The selected user is not an active member of this organization.");
  }

  if (input.roleId === null) {
    await prisma.propertyUserRole.deleteMany({
      where: {
        propertyId: context.property.id,
        userId: input.userId,
      },
    });

    return null;
  }

  const role = await prisma.organizationRole.findFirst({
    where: {
      id: input.roleId,
      organizationId: context.property.organizationId,
      permissions: {
        some: {
          key: PERMISSIONS.PROPERTY_READ,
        },
        none: {
          key: PERMISSIONS.ORG_MANAGE,
        },
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!role) {
    throw new HttpError(404, "Role not found for this property.");
  }

  const assignment = await prisma.propertyUserRole.upsert({
    where: {
      propertyId_userId: {
        propertyId: context.property.id,
        userId: input.userId,
      },
    },
    update: {
      roleId: role.id,
    },
    create: {
      propertyId: context.property.id,
      userId: input.userId,
      roleId: role.id,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          avatarUrl: true,
        },
      },
      role: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return {
    id: assignment.id,
    userId: assignment.userId,
    roleId: assignment.roleId,
    user: assignment.user,
    role: assignment.role,
  };
}

export async function updatePropertySettings(
  context: PropertyRequestContext,
  input: {
    name: string;
    timezone: string;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    stateRegion?: string | null;
    postalCode?: string | null;
    countryCode?: string | null;
    payroll?: {
      frequency: "biweekly" | "custom_days" | "monthly" | "quarterly" | "weekly";
      anchorStartDate: string;
      customDayInterval?: number | null;
      autoCloseAfterHours?: number | null;
    } | null;
  }
) {
  return updatePropertyOperationalSettings(context, input);
}

export async function advancePropertyPayrollPeriod(context: PropertyRequestContext) {
  await advancePropertyPayrollPeriodState(context);
}

export async function createPropertyEmployee(context: PropertyRequestContext, input: CreatePropertyEmployeeInput) {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = normalizeEmail(input.email);
  const phone = normalizeOptionalText(input.phone);
  const employeeCode = normalizeOptionalText(input.employeeCode);
  const createLoginAccount = Boolean(input.createLoginAccount);
  const propertyRole = input.propertyRole ?? "viewer";
  const propertyRoleName = getPropertyRoleName(propertyRole);
  const canManagePins = context.permissions.canBypassPropertyScope;
  const requestedPinMode = normalizeEmployeePinMode(input.pinMode);
  const pinMode = canManagePins ? requestedPinMode : "auto";

  if (!firstName || !lastName) {
    throw new HttpError(400, "firstName and lastName are required.");
  }

  if (requestedPinMode === "manual" && !canManagePins) {
    throw new HttpError(403, "Only organization owners and admins can manually set employee kiosk PINs.");
  }

  ensurePropertyRoleIsAllowed(
    context.permissions.canBypassPropertyScope || hasEffectivePropertyPermission(context, PERMISSIONS.PROPERTY_WRITE),
    propertyRoleName
  );

  if (createLoginAccount && !email) {
    throw new HttpError(400, "An email is required when creating an employee login.");
  }

  if (createLoginAccount && !input.loginPassword?.trim()) {
    throw new HttpError(400, "loginPassword is required when creating an employee login.");
  }

  const roleIds = await ensureRoleIdsForOrganization(context.property.organizationId);
  const membershipRoleId = roleIds.Viewer;
  const propertyRoleId = roleIds[propertyRoleName as keyof typeof roleIds];

  if (!propertyRoleId) {
    throw new HttpError(500, "The selected property role is not configured for this organization.");
  }

  const fullName = `${firstName} ${lastName}`.trim();
  let linkedUserId: string | null = null;
  const pinAssignment = await prepareEmployeePinAssignment(prisma, {
    organizationId: context.property.organizationId,
    pinMode,
    manualPin: input.manualPin ?? null,
  });

  if (createLoginAccount && email && input.loginPassword) {
    const authUser = await provisionSupabaseUser(email, input.loginPassword, fullName);
    const syncedUser = await syncAuthenticatedUser(authUser);
    linkedUserId = syncedUser.id;
  }

  const createdEmployee = await prisma.$transaction(async (tx) => {
    if (linkedUserId) {
      await tx.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: context.property.organizationId,
            userId: linkedUserId,
          },
        },
        update: {
          roleId: membershipRoleId,
          status: "active",
          joinedAt: new Date(),
          invitedEmail: null,
          invitedByUserId: context.localUser.id,
        },
        create: {
          organizationId: context.property.organizationId,
          userId: linkedUserId,
          roleId: membershipRoleId,
          status: "active",
          invitedEmail: email,
          invitedByUserId: context.localUser.id,
          joinedAt: new Date(),
        },
      });

      await tx.propertyUserRole.upsert({
        where: {
          propertyId_userId: {
            propertyId: context.property.id,
            userId: linkedUserId,
          },
        },
        update: {
          roleId: propertyRoleId,
        },
        create: {
          propertyId: context.property.id,
          userId: linkedUserId,
          roleId: propertyRoleId,
        },
      });
    }

    const employee = await tx.employee.create({
      data: {
        organizationId: context.property.organizationId,
        userId: linkedUserId,
        firstName,
        lastName,
        email,
        phone,
        employeeCode,
        pinHash: pinAssignment.pinHash,
        pinLookupKey: pinAssignment.pinLookupKey,
        pinCiphertext: pinAssignment.pinCiphertext,
        pinLastSetAt: pinAssignment.assignedAt,
        pinLastSetByUserId: context.localUser.id,
        employmentStatus: "active",
      },
      select: {
        id: true,
        organizationId: true,
        userId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        employeeCode: true,
        employmentStatus: true,
        pinLastSetAt: true,
        createdAt: true,
      },
    });

    await tx.employeePropertyAssignment.upsert({
      where: {
        employeeId_propertyId: {
          employeeId: employee.id,
          propertyId: context.property.id,
        },
      },
      update: {
        isPrimary: true,
        activeFrom: new Date(),
        activeTo: null,
      },
      create: {
        employeeId: employee.id,
        propertyId: context.property.id,
        isPrimary: true,
        activeFrom: new Date(),
      },
    });

    await recordEmployeePinEvent(tx, {
      organizationId: context.property.organizationId,
      employeeId: employee.id,
      performedByUserId: context.localUser.id,
      eventType: pinMode === "manual" ? "manual_set" : "generated",
      pinMode,
    });

    return employee;
  });

  return {
    employee: {
      id: createdEmployee.id,
      organizationId: createdEmployee.organizationId,
      userId: createdEmployee.userId,
      firstName: createdEmployee.firstName,
      lastName: createdEmployee.lastName,
      email: createdEmployee.email,
      phone: createdEmployee.phone,
      employeeCode: createdEmployee.employeeCode,
      employmentStatus: createdEmployee.employmentStatus,
      kioskPinConfigured: true,
      kioskPinLastSetAt: createdEmployee.pinLastSetAt?.toISOString() ?? null,
      createdAt: createdEmployee.createdAt.toISOString(),
      propertyId: context.property.id,
    },
    pinReveal: canManagePins
      ? {
          value: pinAssignment.plainTextPin,
          mode: pinMode,
          assignedAt: pinAssignment.assignedAt.toISOString(),
        }
      : null,
  };
}
