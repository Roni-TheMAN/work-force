import type { ClientProperty } from "@/lib/api";
import { apiRequest } from "@/lib/api";
import { env } from "@/lib/env";
import { getSupabaseSession } from "@/lib/supabase";

export type AssignUserToPropertiesPayload = {
  organizationId: string;
  userId: string;
  propertyIds: string[];
};

export type PropertyAssignment = {
  id: string;
  propertyId: string;
  userId: string;
  roleId: string | null;
  createdAt: string;
  updatedAt: string;
  property: {
    id: string;
    name: string;
    organizationId: string;
  };
};

export type UserAccess = {
  role: {
    id: string;
    name: string;
  };
  permissions: string[];
  properties: Array<Pick<ClientProperty, "id" | "name" | "organizationId">>;
};

export type PropertyDashboardOperationalConfig = {
  overtimeHours: number;
  autoClockOutHours: number;
  schedulingEnabled: boolean;
};

export type PropertyPayrollFrequency = "biweekly" | "custom_days" | "monthly" | "quarterly" | "weekly";

export type PropertyDashboardPayrollConfig = {
  isConfigured: boolean;
  frequency: PropertyPayrollFrequency;
  anchorStartDate: string | null;
  customDayInterval: number | null;
  autoCloseAfterHours: number;
};

export type PropertyDashboardPayPeriod = {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  label: string;
};

export type PropertyDashboardProperty = ClientProperty & {
  operationalConfig: PropertyDashboardOperationalConfig;
};

export type PropertyDashboardSection =
  | "access"
  | "clock"
  | "overview"
  | "payroll"
  | "schedule"
  | "settings"
  | "time"
  | "workforce";

export type PropertyPermissionSnapshot = {
  propertyId: string;
  organizationId: string;
  effectivePermissions: string[];
  canBypassPropertyScope: boolean;
  canViewOverview: boolean;
  canViewWorkforce: boolean;
  canViewTime: boolean;
  canViewSchedule: boolean;
  canViewPayroll: boolean;
  canManageAccess: boolean;
  canManageSettings: boolean;
  canCreateEmployees: boolean;
  canAssignElevatedRoles: boolean;
  availableSections: PropertyDashboardSection[];
};

export type PropertyDashboardOverviewAlert = {
  id: string;
  title: string;
  count: number;
  severity: "info" | "warning";
};

export type PropertyDashboardWorkforceMember = {
  id: string;
  userId?: string | null;
  employeeCode: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  employmentStatus: string;
  attendanceStatus: "clocked-in" | "inactive" | "off-shift" | "scheduled";
  todayHours: number;
  weeklyHours: number;
  overtimeHours: number;
  shiftLabel: string;
  estimatedHourlyRate: number | null;
  isPrimary?: boolean;
  activeFrom?: string | null;
  activeTo?: string | null;
};

export type PropertyDashboardTimelineItem = {
  id: string;
  employeeName: string;
  status: string;
  shiftLabel: string;
  todayHours: number;
};

export type PropertyDashboardOpenShift = {
  id: string;
  employeeName: string;
  start: string;
  end: string;
  status: string;
};

export type PropertyDashboardScheduleDay = {
  id: string;
  label: string;
  date: string;
  shifts: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    start: string;
    end: string;
    status: string;
  }>;
};

export type PropertyScheduleStatus = "draft" | "published";
export type PropertyScheduleShiftStatus = "cancelled" | "open" | "scheduled";
export type ScheduleTemplateSkipReason = "employee_inactive" | "employee_not_assigned" | "employee_terminated";

export type PropertyScheduleShift = {
  breakMinutes: number;
  date: string;
  employee: {
    employmentStatus: string | null;
    id: string;
    name: string;
  } | null;
  employeeId: string | null;
  employeeName: string | null;
  endAt: string;
  endTime: string;
  id: string;
  isOvernight: boolean;
  notes: string | null;
  positionLabel: string | null;
  scheduleId: string;
  startAt: string;
  startTime: string;
  status: PropertyScheduleShiftStatus;
  timeLabel: string;
  updatedAt: string;
};

export type ScheduleQuickTimePreset = {
  endMinutes: number;
  endTime: string;
  id: string;
  isOvernight: boolean;
  label: string;
  startMinutes: number;
  startTime: string;
};

export type ScheduleQuickPositionPreset = {
  id: string;
  label: string;
  positionLabel: string;
};

export type PropertyScheduleQuickPresets = {
  positions: ScheduleQuickPositionPreset[];
  times: ScheduleQuickTimePreset[];
};

export type PropertyScheduleWeek = {
  days: Array<{
    date: string;
    isToday: boolean;
    label: string;
    shortLabel: string;
  }>;
  organizationId: string;
  property: {
    id: string;
    name: string;
    timezone: string;
  };
  publishedBy: {
    displayName: string | null;
    userId: string | null;
  };
  publishedAt: string | null;
  quickPresets: PropertyScheduleQuickPresets;
  scheduleId: string | null;
  shifts: PropertyScheduleShift[];
  status: PropertyScheduleStatus;
  weekEndDate: string;
  weekLabel: string;
  weekStartDate: string;
};

export type PropertyScheduleTemplateShift = {
  breakMinutes: number;
  dayIndex: number;
  employee: {
    employmentStatus: string | null;
    id: string;
    name: string;
  } | null;
  employeeId: string | null;
  employeeName: string | null;
  endMinutes: number;
  endTime: string;
  id: string;
  isOvernight: boolean;
  notes: string | null;
  positionLabel: string | null;
  startMinutes: number;
  startTime: string;
  status: PropertyScheduleShiftStatus;
  timeLabel: string;
};

export type PropertyScheduleTemplate = {
  createdAt: string;
  id: string;
  name: string;
  shiftCount: number;
  shifts: PropertyScheduleTemplateShift[];
  slotIndex: number;
  updatedAt: string;
};

export type PropertyScheduleTemplatesResponse = {
  quickPresets: PropertyScheduleQuickPresets;
  templates: PropertyScheduleTemplate[];
};

export type ApplyPropertyScheduleTemplateResult = {
  summary: {
    appliedShiftCount: number;
    skippedItems: Array<{
      dayIndex: number;
      employeeId: string | null;
      employeeName: string | null;
      endTime: string;
      positionLabel: string | null;
      reason: ScheduleTemplateSkipReason;
      startTime: string;
      templateShiftId: string;
    }>;
    skippedShiftCount: number;
  };
  week: PropertyScheduleWeek;
};

export type PropertyDashboardAccessUser = {
  id: string;
  userId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: {
    id: string;
    name: string;
  } | null;
};

export type PropertyDashboardAccessRole = {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
};

export type PropertyDashboardData = {
  property: PropertyDashboardProperty;
  propertyOptions: Array<Pick<ClientProperty, "id" | "name">>;
  permissions: PropertyPermissionSnapshot;
  payrollConfig: PropertyDashboardPayrollConfig;
  currentPayPeriod: PropertyDashboardPayPeriod | null;
  nextPayPeriod: PropertyDashboardPayPeriod | null;
  overview: {
    activeEmployees: number;
    hoursToday: number;
    alerts: PropertyDashboardOverviewAlert[];
  };
  workforce: PropertyDashboardWorkforceMember[];
  time: {
    timeline: PropertyDashboardTimelineItem[];
    openShifts: PropertyDashboardOpenShift[];
    weeklyHours: Array<{
      employeeId: string;
      employeeName: string;
      hours: number;
    }>;
    currentPeriodLabel: string | null;
    reviewItems: Array<{
      id: string;
      employeeName: string;
      status: string;
      startedAt: string;
    }>;
  };
  scheduling: {
    enabled: boolean;
    days: PropertyDashboardScheduleDay[];
  };
  payroll: {
    currentPeriod: PropertyDashboardPayPeriod | null;
    nextPeriod: PropertyDashboardPayPeriod | null;
    totalHours: number;
    estimatedWages: number | null;
    overtimeHours: number;
    requiresAttentionCount: number;
    canAdvancePeriod: boolean;
    employees: Array<{
      id: string;
      name: string;
      weeklyHours: number;
      overtimeHours: number;
      estimatedHourlyRate: number | null;
      estimatedWages: number | null;
      shiftLabel: string;
    }>;
  };
  access: {
    users: PropertyDashboardAccessUser[];
    availableRoles: PropertyDashboardAccessRole[];
  };
};

export type PropertyPayrollApprovalStatus = "approved" | "needs_changes" | "pending";
export type PropertyPayrollRunStatus = "draft" | "finalized" | "in_review" | "superseded";

export type PropertyPayrollRunSummary = {
  id: string;
  version: number;
  status: PropertyPayrollRunStatus;
  requestedByUserId: string;
  requestedByDisplay: string | null;
  startedAt: string | null;
  completedAt: string | null;
  finalizedAt: string | null;
  finalizedByUserId: string | null;
  finalizedByDisplay: string | null;
  approvalSummary: {
    approvedEmployees: number;
    needsChangesEmployees: number;
    pendingEmployees: number;
    totalEmployees: number;
  };
  totals: {
    totalMinutes: number;
    totalHours: number;
    overtimeMinutes: number;
    overtimeHours: number;
    estimatedGrossCents: number | null;
    estimatedGross: number | null;
  };
};

export type PropertyPayrollPeriodListItem = {
  periodId: string;
  startDate: string;
  endDate: string;
  status: string;
  label: string;
  latestRun: PropertyPayrollRunSummary | null;
  approvalSummary: PropertyPayrollRunSummary["approvalSummary"];
  totals: PropertyPayrollRunSummary["totals"];
  editable: boolean;
};

export type PropertyPayrollPeriodListResponse = {
  propertyId: string;
  periods: PropertyPayrollPeriodListItem[];
};

export type PropertyPayrollEmployeeDetail = {
  employeeId: string;
  name: string;
  approvalStatus: PropertyPayrollApprovalStatus;
  approvedAt: string | null;
  approvedByUserId: string | null;
  approvedByDisplay: string | null;
  approvalNote: string | null;
  reviewStatusReason: string | null;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  estimatedGross: number | null;
  flagCounts: {
    autoClosed: number;
    edited: number;
    manual: number;
  };
  shiftCount: number;
};

export type PropertyShiftExceptionFlags = {
  autoClosed: boolean;
  edited: boolean;
  locked: boolean;
  manual: boolean;
};

export type PropertyShiftPayrollImpact = {
  locked: boolean;
  payrollPeriodId: string | null;
  payrollRunId: string | null;
  payrollRunStatus: string | null;
  payrollRunVersion: number | null;
};

export type PropertyPayrollShiftDetail = {
  shiftSessionId: string;
  employeeId: string;
  employeeName: string;
  startedAt: string;
  endedAt: string | null;
  businessDate: string;
  payableMinutes: number;
  totalMinutes: number;
  breakMinutes: number;
  entryMode: string;
  status: string;
  source: string;
  estimatedGross: number | null;
  flags: PropertyShiftExceptionFlags;
};

export type PropertyTimeLogShift = {
  shiftSessionId: string;
  employeeId: string;
  employeeName: string;
  startedAt: string;
  endedAt: string | null;
  businessDate: string;
  payableMinutes: number;
  totalMinutes: number;
  breakMinutes: number;
  entryMode: string;
  status: string;
  source: string;
  payrollImpact: PropertyShiftPayrollImpact;
  flags: PropertyShiftExceptionFlags;
  breaks: Array<{
    id: string;
    breakType: "meal" | "other" | "rest";
    paid: boolean;
    startedAt: string;
    endedAt: string | null;
    durationMinutes: number | null;
    source: string;
    createdAt: string;
  }>;
};

export type PropertyTimeLogEmployeeRow = {
  employeeId: string;
  name: string;
  employmentStatus: string;
  attendanceState: "clocked-in" | "no-hours" | "worked";
  latestActivityAt: string | null;
  shiftCount: number;
  totalHours: number;
  totalMinutes: number;
  overtimeHours: number;
  overtimeMinutes: number;
  exceptionCount: number;
  flagCounts: {
    autoClosed: number;
    edited: number;
    locked: number;
    manual: number;
  };
  shifts: PropertyTimeLogShift[];
};

export type PropertyTimeLogsResponse = {
  propertyId: string;
  filters: {
    businessDateFrom: string | null;
    businessDateTo: string | null;
    employeeId: string | null;
    status: string | null;
    flags: Array<"auto_closed" | "edited" | "locked" | "manual">;
  };
  summary: {
    totalPayableHours: number;
    employeesWorked: number;
    openShifts: number;
    exceptionCount: number;
    averageShiftLengthHours: number;
    overtimeHours: number;
    shiftCount: number;
  };
  dailyTrend: Array<{
    businessDate: string;
    label: string;
    hours: number;
    shiftCount: number;
    flaggedShifts: number;
  }>;
  exceptionSummary: {
    autoClosed: number;
    edited: number;
    locked: number;
    manual: number;
  };
  employeeRows: PropertyTimeLogEmployeeRow[];
};

export type PropertyPayrollPeriodDetail = {
  propertyId: string;
  period: PropertyDashboardPayPeriod & {
    isCurrent: boolean;
  };
  latestRun: PropertyPayrollRunSummary | null;
  approvalSummary: PropertyPayrollRunSummary["approvalSummary"];
  employees: PropertyPayrollEmployeeDetail[];
  includedShifts: PropertyPayrollShiftDetail[];
  analytics: {
    summary: {
      totalPayableHours: number;
      overtimeHours: number;
      estimatedGross: number | null;
      employeesInPeriod: number;
      approvedEmployees: number;
      pendingEmployees: number;
      needsChangesEmployees: number;
      flaggedShifts: number;
    };
    dailyTrend: Array<{
      businessDate: string;
      label: string;
      hours: number;
      shiftCount: number;
      flaggedShifts: number;
    }>;
    topEmployees: Array<{
      employeeId: string;
      name: string;
      totalHours: number;
      overtimeHours: number;
      estimatedGross: number | null;
      shiftCount: number;
    }>;
    exceptionSummary: {
      autoClosed: number;
      edited: number;
      locked: number;
      manual: number;
    };
  };
  totals: PropertyPayrollRunSummary["totals"];
  actions: {
    canCreateRun: boolean;
    canApproveEmployees: boolean;
    canResetApprovals: boolean;
    canFinalize: boolean;
    canReopen: boolean;
    canExport: boolean;
    editable: boolean;
  };
};

export type UpdatePropertyAccessPayload = {
  propertyId: string;
  userId: string;
  roleId: string | null;
};

export type UpdatePropertySettingsPayload = {
  propertyId: string;
  name: string;
  timezone: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  countryCode: string | null;
  payroll: {
    frequency: PropertyPayrollFrequency;
    anchorStartDate: string;
    customDayInterval: number | null;
    autoCloseAfterHours: number | null;
  };
};

export type CreatePropertyPayrollRunPayload = {
  propertyId: string;
  periodId: string;
};

export type CreateShiftPayload = {
  breakMinutes?: number;
  date: string;
  employeeId?: string | null;
  endTime: string;
  notes?: string | null;
  positionLabel?: string | null;
  propertyId: string;
  startTime: string;
  status?: PropertyScheduleShiftStatus;
};

export type PropertyPayrollApprovalPayload = {
  propertyId: string;
  runId: string;
  employeeId: string;
  note?: string | null;
};

export type UpdateShiftPayload = {
  breakMinutes?: number;
  date?: string;
  employeeId?: string | null;
  endTime?: string;
  notes?: string | null;
  positionLabel?: string | null;
  propertyId: string;
  shiftId: string;
  startTime?: string;
  status?: PropertyScheduleShiftStatus;
};

export type ScheduleTemplateShiftInput = {
  breakMinutes?: number;
  dayIndex: number;
  employeeId?: string | null;
  endMinutes: number;
  id?: string;
  isOvernight: boolean;
  notes?: string | null;
  positionLabel?: string | null;
  startMinutes: number;
  status?: PropertyScheduleShiftStatus;
};

export type CreatePropertyScheduleTemplatePayload = {
  name?: string | null;
  propertyId: string;
  slotIndex: number;
  sourceWeekStartDate?: string | null;
};

export type UpdatePropertyScheduleTemplatePayload = {
  name?: string | null;
  propertyId: string;
  shifts?: ScheduleTemplateShiftInput[] | null;
  sourceWeekStartDate?: string | null;
  templateId: string;
};

export type PublishScheduleResult = PropertyScheduleWeek;

export async function assignUserToProperties(payload: AssignUserToPropertiesPayload): Promise<PropertyAssignment[]> {
  const response = await apiRequest<{ assignments: PropertyAssignment[] }>("/api/client/properties/assign-user", {
    auth: true,
    method: "POST",
    body: payload,
  });

  return response.assignments;
}

export async function getUserAccess(
  userId: string,
  organizationId: string,
  signal?: AbortSignal
): Promise<UserAccess> {
  const response = await apiRequest<{ access: UserAccess }>(
    `/api/client/users/${encodeURIComponent(userId)}/access?organizationId=${encodeURIComponent(organizationId)}`,
    {
      auth: true,
      signal,
    }
  );

  return response.access;
}

export async function getPropertyDashboard(
  propertyId: string,
  signal?: AbortSignal
): Promise<PropertyDashboardData> {
  const response = await apiRequest<{ dashboard: PropertyDashboardData }>(
    `/api/client/property/${encodeURIComponent(propertyId)}/dashboard`,
    {
      auth: true,
      signal,
    }
  );

  return response.dashboard;
}

export async function getPropertyPermissions(
  propertyId: string,
  signal?: AbortSignal
): Promise<PropertyPermissionSnapshot> {
  const response = await apiRequest<{ permissions: PropertyPermissionSnapshot }>(
    `/api/client/property/${encodeURIComponent(propertyId)}/permissions`,
    {
      auth: true,
      signal,
    }
  );

  return response.permissions;
}

export async function getPropertyScheduleWeek(
  propertyId: string,
  options?: {
    signal?: AbortSignal;
    weekStartDate?: string | null;
  }
): Promise<PropertyScheduleWeek> {
  const searchParams = new URLSearchParams();

  if (options?.weekStartDate) {
    searchParams.set("weekStartDate", options.weekStartDate);
  }

  const response = await apiRequest<{ week: PropertyScheduleWeek }>(
    `/api/client/property/${encodeURIComponent(propertyId)}/schedule${searchParams.size > 0 ? `?${searchParams.toString()}` : ""}`,
    {
      auth: true,
      signal: options?.signal,
    }
  );

  return response.week;
}

export async function getPropertyScheduleTemplates(
  propertyId: string,
  signal?: AbortSignal
): Promise<PropertyScheduleTemplatesResponse> {
  return apiRequest<PropertyScheduleTemplatesResponse>(`/api/client/property/${encodeURIComponent(propertyId)}/schedule/templates`, {
    auth: true,
    signal,
  });
}

export async function createPropertyScheduleShift(payload: CreateShiftPayload): Promise<PropertyScheduleWeek> {
  const response = await apiRequest<{ week: PropertyScheduleWeek }>(
    `/api/client/property/${encodeURIComponent(payload.propertyId)}/schedule/shifts`,
    {
      auth: true,
      method: "POST",
      body: {
        breakMinutes: payload.breakMinutes ?? 0,
        date: payload.date,
        employeeId: payload.employeeId ?? null,
        endTime: payload.endTime,
        notes: payload.notes ?? null,
        positionLabel: payload.positionLabel ?? null,
        startTime: payload.startTime,
        status: payload.status ?? "scheduled",
      },
    }
  );

  return response.week;
}

export async function createPropertyScheduleTemplate(
  payload: CreatePropertyScheduleTemplatePayload
): Promise<PropertyScheduleTemplatesResponse> {
  return apiRequest<PropertyScheduleTemplatesResponse>(
    `/api/client/property/${encodeURIComponent(payload.propertyId)}/schedule/templates`,
    {
      auth: true,
      method: "POST",
      body: {
        name: payload.name ?? null,
        slotIndex: payload.slotIndex,
        sourceWeekStartDate: payload.sourceWeekStartDate ?? null,
      },
    }
  );
}

export async function updatePropertyScheduleShift(payload: UpdateShiftPayload): Promise<PropertyScheduleWeek> {
  const response = await apiRequest<{ week: PropertyScheduleWeek }>(
    `/api/client/property/${encodeURIComponent(payload.propertyId)}/schedule/shifts/${encodeURIComponent(payload.shiftId)}`,
    {
      auth: true,
      method: "PATCH",
      body: {
        breakMinutes: payload.breakMinutes,
        date: payload.date,
        employeeId: payload.employeeId,
        endTime: payload.endTime,
        notes: payload.notes,
        positionLabel: payload.positionLabel,
        startTime: payload.startTime,
        status: payload.status,
      },
    }
  );

  return response.week;
}

export async function updatePropertyScheduleTemplate(
  payload: UpdatePropertyScheduleTemplatePayload
): Promise<PropertyScheduleTemplatesResponse> {
  return apiRequest<PropertyScheduleTemplatesResponse>(
    `/api/client/property/${encodeURIComponent(payload.propertyId)}/schedule/templates/${encodeURIComponent(payload.templateId)}`,
    {
      auth: true,
      method: "PATCH",
      body: {
        name: payload.name,
        shifts: payload.shifts,
        sourceWeekStartDate: payload.sourceWeekStartDate,
      },
    }
  );
}

export async function deletePropertyScheduleShift(payload: {
  propertyId: string;
  shiftId: string;
}): Promise<PropertyScheduleWeek> {
  const response = await apiRequest<{ week: PropertyScheduleWeek }>(
    `/api/client/property/${encodeURIComponent(payload.propertyId)}/schedule/shifts/${encodeURIComponent(payload.shiftId)}`,
    {
      auth: true,
      method: "DELETE",
    }
  );

  return response.week;
}

export async function deletePropertyScheduleTemplate(payload: {
  propertyId: string;
  templateId: string;
}): Promise<PropertyScheduleTemplatesResponse> {
  return apiRequest<PropertyScheduleTemplatesResponse>(
    `/api/client/property/${encodeURIComponent(payload.propertyId)}/schedule/templates/${encodeURIComponent(payload.templateId)}`,
    {
      auth: true,
      method: "DELETE",
    }
  );
}

export async function publishPropertySchedule(payload: {
  propertyId: string;
  weekStartDate?: string | null;
}): Promise<PublishScheduleResult> {
  const response = await apiRequest<{ week: PropertyScheduleWeek }>(
    `/api/client/property/${encodeURIComponent(payload.propertyId)}/schedule/publish`,
    {
      auth: true,
      method: "POST",
      body: {
        weekStartDate: payload.weekStartDate ?? null,
      },
    }
  );

  return response.week;
}

export async function applyPropertyScheduleTemplate(payload: {
  propertyId: string;
  templateId: string;
  weekStartDate?: string | null;
}): Promise<ApplyPropertyScheduleTemplateResult> {
  return apiRequest<ApplyPropertyScheduleTemplateResult>(
    `/api/client/property/${encodeURIComponent(payload.propertyId)}/schedule/templates/${encodeURIComponent(payload.templateId)}/apply`,
    {
      auth: true,
      method: "POST",
      body: {
        weekStartDate: payload.weekStartDate ?? null,
      },
    }
  );
}

export async function updatePropertyAccess(payload: UpdatePropertyAccessPayload): Promise<void> {
  await apiRequest<void>(`/api/client/property/${encodeURIComponent(payload.propertyId)}/access/${encodeURIComponent(payload.userId)}`, {
    auth: true,
    method: "PATCH",
    body: {
      roleId: payload.roleId,
    },
  });
}

export async function updatePropertySettings(
  payload: UpdatePropertySettingsPayload
): Promise<PropertyDashboardProperty> {
  const response = await apiRequest<{ property: PropertyDashboardProperty }>(
    `/api/client/property/${encodeURIComponent(payload.propertyId)}/settings`,
    {
      auth: true,
      method: "PATCH",
      body: {
        name: payload.name,
        timezone: payload.timezone,
        addressLine1: payload.addressLine1,
        addressLine2: payload.addressLine2,
        city: payload.city,
        stateRegion: payload.stateRegion,
        postalCode: payload.postalCode,
        countryCode: payload.countryCode,
        payroll: payload.payroll,
      },
    }
  );

  return response.property;
}

export async function advancePropertyPayrollPeriod(propertyId: string): Promise<void> {
  await apiRequest<void>(`/api/client/property/${encodeURIComponent(propertyId)}/payroll/advance-period`, {
    auth: true,
    method: "POST",
  });
}

export async function getPropertyPayrollPeriods(
  propertyId: string,
  signal?: AbortSignal
): Promise<PropertyPayrollPeriodListResponse> {
  return apiRequest<PropertyPayrollPeriodListResponse>(`/api/client/property/${encodeURIComponent(propertyId)}/payroll/periods`, {
    auth: true,
    signal,
  });
}

export async function getPropertyTimeLogs(
  propertyId: string,
  options?: {
    businessDateFrom?: string | null;
    businessDateTo?: string | null;
    employeeId?: string | null;
    status?: string | null;
    flags?: Array<"auto_closed" | "edited" | "locked" | "manual">;
    signal?: AbortSignal;
  }
): Promise<PropertyTimeLogsResponse> {
  const searchParams = new URLSearchParams();

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

  if (options?.flags?.length) {
    searchParams.set("flags", options.flags.join(","));
  }

  return apiRequest<PropertyTimeLogsResponse>(
    `/api/client/property/${encodeURIComponent(propertyId)}/time-logs${searchParams.size > 0 ? `?${searchParams.toString()}` : ""}`,
    {
      auth: true,
      signal: options?.signal,
    }
  );
}

export async function getPropertyPayrollPeriodDetail(
  propertyId: string,
  periodId: string,
  signal?: AbortSignal
): Promise<PropertyPayrollPeriodDetail> {
  return apiRequest<PropertyPayrollPeriodDetail>(
    `/api/client/property/${encodeURIComponent(propertyId)}/payroll/periods/${encodeURIComponent(periodId)}`,
    {
      auth: true,
      signal,
    }
  );
}

export async function createPropertyPayrollRun(
  payload: CreatePropertyPayrollRunPayload
): Promise<PropertyPayrollPeriodDetail> {
  return apiRequest<PropertyPayrollPeriodDetail>(
    `/api/client/property/${encodeURIComponent(payload.propertyId)}/payroll/periods/${encodeURIComponent(payload.periodId)}/runs`,
    {
      auth: true,
      method: "POST",
    }
  );
}

export async function approvePropertyPayrollEmployee(
  payload: PropertyPayrollApprovalPayload
): Promise<PropertyPayrollPeriodDetail> {
  return apiRequest<PropertyPayrollPeriodDetail>(
    `/api/client/property/${encodeURIComponent(payload.propertyId)}/payroll/runs/${encodeURIComponent(payload.runId)}/employees/${encodeURIComponent(payload.employeeId)}/approve`,
    {
      auth: true,
      method: "POST",
      body: {
        note: payload.note ?? null,
      },
    }
  );
}

export async function resetPropertyPayrollEmployeeApproval(
  payload: PropertyPayrollApprovalPayload
): Promise<PropertyPayrollPeriodDetail> {
  return apiRequest<PropertyPayrollPeriodDetail>(
    `/api/client/property/${encodeURIComponent(payload.propertyId)}/payroll/runs/${encodeURIComponent(payload.runId)}/employees/${encodeURIComponent(payload.employeeId)}/reset-approval`,
    {
      auth: true,
      method: "POST",
      body: {
        note: payload.note ?? null,
      },
    }
  );
}

export async function finalizePropertyPayrollRun(
  propertyId: string,
  runId: string
): Promise<PropertyPayrollPeriodDetail> {
  return apiRequest<PropertyPayrollPeriodDetail>(
    `/api/client/property/${encodeURIComponent(propertyId)}/payroll/runs/${encodeURIComponent(runId)}/finalize`,
    {
      auth: true,
      method: "POST",
    }
  );
}

export async function reopenPropertyPayrollRun(
  propertyId: string,
  runId: string
): Promise<PropertyPayrollPeriodDetail> {
  return apiRequest<PropertyPayrollPeriodDetail>(
    `/api/client/property/${encodeURIComponent(propertyId)}/payroll/runs/${encodeURIComponent(runId)}/reopen`,
    {
      auth: true,
      method: "POST",
    }
  );
}

export async function downloadPropertyPayrollExport(payload: {
  kind: "detail" | "shifts" | "summary";
  propertyId: string;
  runId: string;
}) {
  const session = await getSupabaseSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error("You must be signed in to download payroll exports.");
  }

  const response = await fetch(
    `${env.apiBaseUrl}/api/client/property/${encodeURIComponent(payload.propertyId)}/payroll/runs/${encodeURIComponent(payload.runId)}/export/${
      payload.kind === "detail" ? "detail.pdf" : `${payload.kind}.csv`
    }`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const responseText = await response.text();
    let errorMessage = "Unable to download payroll export.";

    if (responseText) {
      try {
        const parsedResponse = JSON.parse(responseText) as { error?: { message?: string }; message?: string };
        errorMessage = parsedResponse.error?.message ?? parsedResponse.message ?? responseText;
      } catch {
        errorMessage = responseText;
      }
    }

    throw new Error(errorMessage);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition");
  const filenameMatch = disposition?.match(/filename="([^"]+)"/);
  const filename =
    filenameMatch?.[1] ?? `property-payroll-${payload.kind}${payload.kind === "detail" ? ".pdf" : ".csv"}`;
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(objectUrl);
  }, 1000);
}
