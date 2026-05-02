import { HttpError } from "../../lib/http-error";
import { prisma } from "../../lib/prisma";
import type { PropertyRequestContext } from "./property.middleware";
import type { Prisma } from "../../../generated/prisma-rbac";
import {
  assemblePropertyPayrollDetailReport,
  loadFinalizedPayrollRunForExport,
} from "./property-payroll-detail-report";
import { renderPropertyPayrollDetailPdf } from "./property-payroll-detail-pdf";

const DEFAULT_OVERTIME_THRESHOLD_MINUTES = 40 * 60;
const DEFAULT_OT1_MULTIPLIER = 1.5;

type PersistedPayrollFrequency = "biweekly" | "custom" | "monthly" | "quarterly" | "semimonthly" | "weekly";

type PeriodWindow = {
  endDate: string;
  startDate: string;
};

type PayrollSettingRecord = Awaited<ReturnType<typeof loadPayrollSettingForMoment>>;

type RateRecord = {
  annualSalaryCents: bigint | null;
  baseHourlyRateCents: bigint | null;
  currency: string;
  effectiveFrom: Date;
  employeeId: string;
  payType: string;
  propertyId: string | null;
  title: string | null;
};

type ComputedShiftRow = {
  actualEndedAt: string | null;
  actualStartedAt: string;
  breakMinutes: number;
  businessDate: string;
  departmentLabel: string | null;
  employeeId: string;
  employeeName: string;
  endedAt: string | null;
  entryMode: string;
  estimatedGrossCents: bigint | null;
  flags: {
    autoClosed: boolean;
    edited: boolean;
    manual: boolean;
  };
  overtime1Minutes: number;
  overtime2Minutes: number;
  payableMinutes: number;
  punchInfo: string | null;
  regularMinutes: number;
  shiftSessionId: string;
  source: string;
  startedAt: string;
  status: string;
  totalMinutes: number;
  weekEndDate: string;
  weekStartDate: string;
};

type ComputedEmployeeRow = {
  approvalNote: string | null;
  approvalStatus: "approved" | "needs_changes" | "pending";
  approvedAt: string | null;
  approvedByUserId: string | null;
  employeeId: string;
  estimatedGross: number | null;
  flagCounts: {
    autoClosed: number;
    edited: number;
    manual: number;
  };
  grossPayCents: bigint;
  name: string;
  overtimeHours: number;
  overtimeMinutes: number;
  payableMinutes: number;
  rateSnapshot: Record<string, unknown>;
  regularHours: number;
  regularMinutes: number;
  shiftCount: number;
  totalHours: number;
  totalMinutes: number;
};

type ComputedRunData = {
  approvalSummary: {
    approvedEmployees: number;
    needsChangesEmployees: number;
    pendingEmployees: number;
    totalEmployees: number;
  };
  employees: ComputedEmployeeRow[];
  shifts: ComputedShiftRow[];
  totals: {
    estimatedGross: number | null;
    estimatedGrossCents: number | null;
    overtimeHours: number;
    overtimeMinutes: number;
    totalHours: number;
    totalMinutes: number;
  };
};

type ExistingApprovalSnapshot = {
  approvalNote: string | null;
  approvalStatus: "approved" | "needs_changes" | "pending";
  approvedAt: Date | null;
  approvedByDisplay: string | null;
  approvedByUserId: string | null;
};

type ShiftPayrollMutationInput = {
  after?: {
    businessDate: string;
    startedAt: Date;
  } | null;
  before?: {
    businessDate: string;
    startedAt: Date;
  } | null;
  propertyId: string;
};

type ShiftPayrollImpact = {
  locked: boolean;
  payrollPeriodId: string | null;
  payrollRunId: string | null;
  payrollRunStatus: string | null;
  payrollRunVersion: number | null;
};

type UserDisplayLike = {
  email: string | null;
  fullName: string | null;
} | null;

type PersistedEmployeeSummaryLike = {
  approvalStatus: string;
  grossPayCents: bigint;
  overtime1Minutes: number;
  overtime2Minutes: number;
  payableMinutes: number;
};

type PersistedRunSummaryLike = {
  completedAt: Date | null;
  employeeSummaries: PersistedEmployeeSummaryLike[];
  finalizedAt: Date | null;
  finalizedByUser: UserDisplayLike;
  finalizedByUserId: string | null;
  id: string;
  requestedByUser: UserDisplayLike;
  requestedByUserId: string;
  startedAt: Date | null;
  status: string;
  version: number;
};

type WeeklyOvertimeShiftInput = {
  businessDate: string;
  employeeId: string;
  payableMinutes: number;
  shiftId: string;
};

type WeeklyOvertimeShiftAllocation = {
  businessDate: string;
  employeeId: string;
  overtimeMinutes: number;
  payableMinutes: number;
  regularMinutes: number;
  shiftId: string;
  weekEndDate: string;
  weekStartDate: string;
};

type WeeklyOvertimeAllocationResult = {
  dailyMinutes: Map<
    string,
    {
      overtimeMinutes: number;
      payableMinutes: number;
      regularMinutes: number;
    }
  >;
  employeeTotals: Map<
    string,
    {
      overtimeMinutes: number;
      payableMinutes: number;
      regularMinutes: number;
    }
  >;
  shiftAllocations: Map<string, WeeklyOvertimeShiftAllocation>;
};

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function diffDays(left: Date, right: Date): number {
  return Math.floor((left.getTime() - right.getTime()) / 86_400_000);
}

function floorDivide(value: number, divisor: number): number {
  return Math.floor(value / divisor);
}

function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addMonthsClamped(value: Date, months: number): Date {
  const year = value.getUTCFullYear();
  const monthIndex = value.getUTCMonth();
  const day = value.getUTCDate();
  const targetMonthIndex = monthIndex + months;
  const normalizedYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const normalizedDay = Math.min(day, getDaysInMonth(normalizedYear, normalizedMonthIndex));

  return new Date(Date.UTC(normalizedYear, normalizedMonthIndex, normalizedDay));
}

function readCustomDayInterval(configJson: unknown): number | null {
  if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) {
    return null;
  }

  const daysInterval = (configJson as { daysInterval?: unknown }).daysInterval;
  return typeof daysInterval === "number" && Number.isInteger(daysInterval) && daysInterval > 0 ? daysInterval : null;
}

function buildDateOnlyForTimezone(timestamp: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(timestamp);
}

function buildPayrollPeriodLabel(startDate: string, endDate: string): string {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  const startFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
  const endFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: start.getUTCFullYear() === end.getUTCFullYear() ? undefined : "numeric",
  });

  return `${startFormatter.format(start)} - ${endFormatter.format(end)}`;
}

function resolveWeekWindowForBusinessDate(anchorDateOnly: string, businessDate: string) {
  const anchor = parseDateOnly(anchorDateOnly);
  const target = parseDateOnly(businessDate);
  const offsetDays = floorDivide(diffDays(target, anchor), 7) * 7;
  const weekStartDate = formatDateOnly(addDays(anchor, offsetDays));

  return {
    weekStartDate,
    weekEndDate: formatDateOnly(addDays(parseDateOnly(weekStartDate), 6)),
  };
}

function readAdjustmentSnapshotDate(snapshot: Prisma.JsonValue, field: "endedAt" | "startedAt"): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  const value = (snapshot as Record<string, unknown>)[field];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function resolveActualShiftTimestamps(input: {
  adjustments: Array<{
    beforeSnapshot: Prisma.JsonValue;
  }>;
  endedAt: Date | null;
  startedAt: Date;
}) {
  const earliestAdjustment = input.adjustments[0] ?? null;

  return {
    actualStartedAt:
      readAdjustmentSnapshotDate(earliestAdjustment?.beforeSnapshot ?? null, "startedAt") ??
      input.startedAt.toISOString(),
    actualEndedAt:
      readAdjustmentSnapshotDate(earliestAdjustment?.beforeSnapshot ?? null, "endedAt") ??
      input.endedAt?.toISOString() ??
      null,
  };
}

function buildShiftPunchInfo(input: {
  actualEndedAt: string | null;
  actualStartedAt: string;
  clockInReplaced: boolean;
  clockOutReplaced: boolean;
  editedEndedAt: string | null;
  editedStartedAt: string;
  isAutoClosed: boolean;
  isEdited: boolean;
  isManual: boolean;
  latestAdjustmentReason: string | null;
}) {
  const parts: string[] = [];

  if (input.isManual) {
    parts.push("Manual");
  }

  if (input.isAutoClosed) {
    parts.push("Auto-closed");
  }

  if (input.isEdited) {
    if (input.actualStartedAt !== input.editedStartedAt) {
      parts.push("In edited");
    }

    if ((input.actualEndedAt ?? "") !== (input.editedEndedAt ?? "")) {
      parts.push("Out edited");
    }

    if (parts.every((part) => part !== "In edited" && part !== "Out edited")) {
      parts.push("Edited");
    }
  }

  if (input.clockInReplaced) {
    parts.push("In corrected");
  }

  if (input.clockOutReplaced) {
    parts.push("Out corrected");
  }

  const normalizedReason = normalizeOptionalText(input.latestAdjustmentReason);

  if (normalizedReason && !normalizedReason.toLowerCase().startsWith("manual shift created")) {
    parts.push(normalizedReason);
  }

  return parts.length > 0 ? parts.join(", ") : null;
}

export function allocateWeeklyOvertimeMinutes(input: {
  shifts: WeeklyOvertimeShiftInput[];
  thresholdMinutes: number;
  weekAnchorDate: string;
}): WeeklyOvertimeAllocationResult {
  const safeThresholdMinutes = Math.max(0, input.thresholdMinutes);
  const employeeWeekMinutes = new Map<string, number>();
  const employeeTotals = new Map<string, { overtimeMinutes: number; payableMinutes: number; regularMinutes: number }>();
  const dailyMinutes = new Map<string, { overtimeMinutes: number; payableMinutes: number; regularMinutes: number }>();
  const shiftAllocations = new Map<string, WeeklyOvertimeShiftAllocation>();

  for (const shift of input.shifts) {
    const weekWindow = resolveWeekWindowForBusinessDate(input.weekAnchorDate, shift.businessDate);
    const employeeWeekKey = `${shift.employeeId}:${weekWindow.weekStartDate}`;
    const consumedWeekMinutes = employeeWeekMinutes.get(employeeWeekKey) ?? 0;
    const remainingRegularMinutes = Math.max(0, safeThresholdMinutes - consumedWeekMinutes);
    const regularMinutes = Math.min(shift.payableMinutes, remainingRegularMinutes);
    const overtimeMinutes = Math.max(0, shift.payableMinutes - regularMinutes);
    const currentEmployeeTotals = employeeTotals.get(shift.employeeId) ?? {
      payableMinutes: 0,
      regularMinutes: 0,
      overtimeMinutes: 0,
    };
    const currentDayTotals = dailyMinutes.get(shift.businessDate) ?? {
      payableMinutes: 0,
      regularMinutes: 0,
      overtimeMinutes: 0,
    };

    employeeWeekMinutes.set(employeeWeekKey, consumedWeekMinutes + shift.payableMinutes);
    currentEmployeeTotals.payableMinutes += shift.payableMinutes;
    currentEmployeeTotals.regularMinutes += regularMinutes;
    currentEmployeeTotals.overtimeMinutes += overtimeMinutes;
    employeeTotals.set(shift.employeeId, currentEmployeeTotals);
    currentDayTotals.payableMinutes += shift.payableMinutes;
    currentDayTotals.regularMinutes += regularMinutes;
    currentDayTotals.overtimeMinutes += overtimeMinutes;
    dailyMinutes.set(shift.businessDate, currentDayTotals);
    shiftAllocations.set(shift.shiftId, {
      shiftId: shift.shiftId,
      employeeId: shift.employeeId,
      businessDate: shift.businessDate,
      payableMinutes: shift.payableMinutes,
      regularMinutes,
      overtimeMinutes,
      weekStartDate: weekWindow.weekStartDate,
      weekEndDate: weekWindow.weekEndDate,
    });
  }

  return {
    shiftAllocations,
    employeeTotals,
    dailyMinutes,
  };
}

function computeMonthlyWindow(anchorStartDate: Date, targetDate: Date, monthSpan: number): PeriodWindow {
  const rawMonthDelta =
    (targetDate.getUTCFullYear() - anchorStartDate.getUTCFullYear()) * 12 +
    (targetDate.getUTCMonth() - anchorStartDate.getUTCMonth());
  let periodIndex = floorDivide(rawMonthDelta, monthSpan);
  let startDate = addMonthsClamped(anchorStartDate, periodIndex * monthSpan);

  while (targetDate < startDate) {
    periodIndex -= 1;
    startDate = addMonthsClamped(anchorStartDate, periodIndex * monthSpan);
  }

  let nextStartDate = addMonthsClamped(anchorStartDate, (periodIndex + 1) * monthSpan);

  while (targetDate >= nextStartDate) {
    periodIndex += 1;
    startDate = nextStartDate;
    nextStartDate = addMonthsClamped(anchorStartDate, (periodIndex + 1) * monthSpan);
  }

  return {
    startDate: formatDateOnly(startDate),
    endDate: formatDateOnly(addDays(nextStartDate, -1)),
  };
}

function buildPeriodWindowForDate(
  calendar: {
    anchorStartDate: Date;
    configJson: unknown;
    frequency: string;
  },
  targetDate: string
): PeriodWindow {
  const anchorDate = calendar.anchorStartDate;
  const target = parseDateOnly(targetDate);
  const persistedFrequency = calendar.frequency as PersistedPayrollFrequency;

  if (persistedFrequency === "weekly" || persistedFrequency === "biweekly" || persistedFrequency === "custom") {
    const intervalDays =
      persistedFrequency === "weekly"
        ? 7
        : persistedFrequency === "biweekly"
          ? 14
          : readCustomDayInterval(calendar.configJson) ?? 14;
    const offset = floorDivide(diffDays(target, anchorDate), intervalDays) * intervalDays;
    const startDate = addDays(anchorDate, offset);

    return {
      startDate: formatDateOnly(startDate),
      endDate: formatDateOnly(addDays(startDate, intervalDays - 1)),
    };
  }

  if (persistedFrequency === "monthly") {
    return computeMonthlyWindow(anchorDate, target, 1);
  }

  if (persistedFrequency === "quarterly") {
    return computeMonthlyWindow(anchorDate, target, 3);
  }

  return {
    startDate: formatDateOnly(anchorDate),
    endDate: formatDateOnly(anchorDate),
  };
}

function formatHoursFromMinutes(minutes: number): number {
  return Number((minutes / 60).toFixed(1));
}

function centsToCurrencyNumber(value: bigint | null): number | null {
  return value === null ? null : Number((Number(value) / 100).toFixed(2));
}

function resolveUserDisplayLabel(user: UserDisplayLike): string | null {
  const fullName = user?.fullName?.trim();

  if (fullName) {
    return fullName;
  }

  return user?.email?.trim() ?? null;
}

export function buildApprovalSummaryFromEmployees(
  employees: Array<{
    approvalStatus: string;
  }>
) {
  return employees.reduce(
    (accumulator, employee) => {
      accumulator.totalEmployees += 1;

      if (employee.approvalStatus === "approved") {
        accumulator.approvedEmployees += 1;
      } else if (employee.approvalStatus === "needs_changes") {
        accumulator.needsChangesEmployees += 1;
      } else {
        accumulator.pendingEmployees += 1;
      }

      return accumulator;
    },
    {
      totalEmployees: 0,
      approvedEmployees: 0,
      needsChangesEmployees: 0,
      pendingEmployees: 0,
    }
  );
}

export function buildRunTotalsFromEmployeeSummaries(employeeSummaries: PersistedEmployeeSummaryLike[]) {
  const totals = employeeSummaries.reduce(
    (accumulator, summary) => {
      accumulator.totalMinutes += summary.payableMinutes;
      accumulator.overtimeMinutes += summary.overtime1Minutes + summary.overtime2Minutes;
      accumulator.estimatedGrossCents += summary.grossPayCents;
      return accumulator;
    },
    {
      totalMinutes: 0,
      overtimeMinutes: 0,
      estimatedGrossCents: BigInt(0),
    }
  );

  return {
    totalMinutes: totals.totalMinutes,
    totalHours: formatHoursFromMinutes(totals.totalMinutes),
    overtimeMinutes: totals.overtimeMinutes,
    overtimeHours: formatHoursFromMinutes(totals.overtimeMinutes),
    estimatedGrossCents: totals.estimatedGrossCents > BigInt(0) ? Number(totals.estimatedGrossCents) : null,
    estimatedGross: totals.estimatedGrossCents > BigInt(0) ? centsToCurrencyNumber(totals.estimatedGrossCents) : null,
  };
}

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);
  return /[",\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, "\"\"")}"` : stringValue;
}

function buildCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function pickRateForEmployee(rates: RateRecord[], propertyId: string): RateRecord | null {
  const propertySpecificRate = rates
    .filter((rate) => rate.propertyId === propertyId)
    .sort((left, right) => right.effectiveFrom.getTime() - left.effectiveFrom.getTime())[0];

  if (propertySpecificRate) {
    return propertySpecificRate;
  }

  return (
    rates
      .filter((rate) => rate.propertyId === null)
      .sort((left, right) => right.effectiveFrom.getTime() - left.effectiveFrom.getTime())[0] ?? null
  );
}

function resolveHourlyRateCents(rate: RateRecord | null): bigint | null {
  if (!rate) {
    return null;
  }

  if (rate.payType === "hourly" && rate.baseHourlyRateCents !== null) {
    return rate.baseHourlyRateCents;
  }

  if (rate.payType === "salary" && rate.annualSalaryCents !== null) {
    return BigInt(Math.round(Number(rate.annualSalaryCents) / 2080));
  }

  return rate.baseHourlyRateCents ?? null;
}

function computeGrossPayCents(minutes: number, hourlyRateCents: bigint | null, multiplier = 1): bigint {
  if (hourlyRateCents === null || minutes <= 0) {
    return BigInt(0);
  }

  return BigInt(Math.round((minutes / 60) * Number(hourlyRateCents) * multiplier));
}

async function loadPayrollSettingForMoment(propertyId: string, referenceTime: Date) {
  return prisma.propertyPayrollSetting.findFirst({
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
    include: {
      payrollCalendar: true,
      defaultOvertimePolicy: {
        select: {
          id: true,
          ot1Multiplier: true,
          ot2Multiplier: true,
          ot1WeeklyAfterMinutes: true,
        },
      },
    },
    orderBy: {
      effectiveFrom: "desc",
    },
  });
}

async function loadPayrollSettingForCalendar(propertyId: string, payrollCalendarId: string) {
  return prisma.propertyPayrollSetting.findFirst({
    where: {
      propertyId,
      payrollCalendarId,
    },
    include: {
      payrollCalendar: true,
      defaultOvertimePolicy: {
        select: {
          id: true,
          ot1Multiplier: true,
          ot2Multiplier: true,
          ot1WeeklyAfterMinutes: true,
        },
      },
    },
    orderBy: {
      effectiveFrom: "desc",
    },
  });
}

async function listPayrollSettingsForProperty(propertyId: string) {
  return prisma.propertyPayrollSetting.findMany({
    where: {
      propertyId,
    },
    include: {
      payrollCalendar: true,
      defaultOvertimePolicy: {
        select: {
          id: true,
          ot1Multiplier: true,
          ot2Multiplier: true,
          ot1WeeklyAfterMinutes: true,
        },
      },
    },
    orderBy: {
      effectiveFrom: "desc",
    },
  });
}

async function ensurePeriodForSetting(setting: NonNullable<PayrollSettingRecord>, businessDate: string) {
  const window = buildPeriodWindowForDate(setting.payrollCalendar, businessDate);

  return prisma.payrollPeriod.upsert({
    where: {
      payrollCalendarId_periodStartDate_periodEndDate: {
        payrollCalendarId: setting.payrollCalendar.id,
        periodStartDate: parseDateOnly(window.startDate),
        periodEndDate: parseDateOnly(window.endDate),
      },
    },
    update: {},
    create: {
      organizationId: setting.payrollCalendar.organizationId,
      payrollCalendarId: setting.payrollCalendar.id,
      periodStartDate: parseDateOnly(window.startDate),
      periodEndDate: parseDateOnly(window.endDate),
      status: businessDate > window.endDate ? "locked" : "open",
    },
  });
}

async function resolveApplicablePeriodForShift(
  propertyId: string,
  startedAt: Date,
  businessDate?: string | null
) {
  const setting = await loadPayrollSettingForMoment(propertyId, startedAt);

  if (!setting) {
    return null;
  }

  const resolvedBusinessDate = businessDate ?? buildDateOnlyForTimezone(startedAt, setting.payrollCalendar.timezone);
  const period = await ensurePeriodForSetting(setting, resolvedBusinessDate);

  return {
    businessDate: resolvedBusinessDate,
    period,
    setting,
  };
}

async function loadRatesByEmployee(
  organizationId: string,
  propertyId: string,
  employeeIds: string[],
  referenceTime: Date
) {
  const uniqueEmployeeIds = Array.from(new Set(employeeIds));

  if (uniqueEmployeeIds.length === 0) {
    return new Map<string, RateRecord | null>();
  }

  const rates = await prisma.employeePayRate.findMany({
    where: {
      organizationId,
      employeeId: {
        in: uniqueEmployeeIds,
      },
      effectiveFrom: {
        lte: referenceTime,
      },
      AND: [
        {
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
        {
          OR: [
            {
              propertyId,
            },
            {
              propertyId: null,
            },
          ],
        },
      ],
    },
    select: {
      employeeId: true,
      propertyId: true,
      payType: true,
      title: true,
      currency: true,
      baseHourlyRateCents: true,
      annualSalaryCents: true,
      effectiveFrom: true,
    },
    orderBy: {
      effectiveFrom: "desc",
    },
  });

  const ratesByEmployeeId = new Map<string, RateRecord | null>();

  for (const employeeId of uniqueEmployeeIds) {
    ratesByEmployeeId.set(
      employeeId,
      pickRateForEmployee(
        rates.filter((rate) => rate.employeeId === employeeId),
        propertyId
      )
    );
  }

  return ratesByEmployeeId;
}

async function computePayrollData(params: {
  invalidatedEmployeeIds?: Set<string>;
  organizationId: string;
  period: {
    id: string;
    payrollCalendarId: string;
    periodEndDate: Date;
    periodStartDate: Date;
    status: string;
  };
  previousApprovals?: Map<string, ExistingApprovalSnapshot>;
  propertyId: string;
  setting: NonNullable<PayrollSettingRecord>;
}) {
  const shifts = await prisma.timeShiftSession.findMany({
    where: {
      organizationId: params.organizationId,
      propertyId: params.propertyId,
      businessDate: {
        gte: params.period.periodStartDate,
        lte: params.period.periodEndDate,
      },
      endedAt: {
        not: null,
      },
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      clockInPunch: {
        select: {
          note: true,
          occurredAt: true,
          replacedByPunchId: true,
          source: true,
          status: true,
        },
      },
      clockOutPunch: {
        select: {
          note: true,
          occurredAt: true,
          replacedByPunchId: true,
          source: true,
          status: true,
        },
      },
      adjustments: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          afterSnapshot: true,
          beforeSnapshot: true,
          createdAt: true,
          reason: true,
        },
      },
    },
    orderBy: [
      {
        employee: {
          firstName: "asc",
        },
      },
      {
        startedAt: "asc",
      },
    ],
  });
  const ratesByEmployee = await loadRatesByEmployee(
    params.organizationId,
    params.propertyId,
    shifts.map((shift) => shift.employeeId),
    params.period.periodEndDate
  );
  const thresholdMinutes =
    params.setting.defaultOvertimePolicy?.ot1WeeklyAfterMinutes ?? DEFAULT_OVERTIME_THRESHOLD_MINUTES;
  const weeklyAllocation = allocateWeeklyOvertimeMinutes({
    shifts: shifts.map((shift) => ({
      shiftId: shift.id,
      employeeId: shift.employeeId,
      businessDate: formatDateOnly(shift.businessDate),
      payableMinutes: shift.payableMinutes ?? shift.totalMinutes ?? 0,
    })),
    thresholdMinutes,
    weekAnchorDate: formatDateOnly(params.setting.payrollCalendar.anchorStartDate),
  });
  const overtimeMultiplier = params.setting.defaultOvertimePolicy?.ot1Multiplier
    ? Number(params.setting.defaultOvertimePolicy.ot1Multiplier)
    : DEFAULT_OT1_MULTIPLIER;
  const employeeAccumulator = new Map<
    string,
    {
      breakMinutes: number;
      employeeName: string;
      flagCounts: {
        autoClosed: number;
        edited: number;
        manual: number;
      };
      grossPayCents: bigint;
      overtimeMinutes: number;
      payableMinutes: number;
      rateSnapshot: Record<string, unknown>;
      regularMinutes: number;
      shiftCount: number;
      totalMinutes: number;
    }
  >();
  const computedShifts: ComputedShiftRow[] = [];

  for (const shift of shifts) {
    const totalMinutes = shift.totalMinutes ?? 0;
    const payableMinutes = shift.payableMinutes ?? totalMinutes;
    const rate = ratesByEmployee.get(shift.employeeId) ?? null;
    const hourlyRateCents = resolveHourlyRateCents(rate);
    const employeeName = `${shift.employee.firstName} ${shift.employee.lastName}`.trim();
    const existingAccumulator =
      employeeAccumulator.get(shift.employeeId) ??
      {
        breakMinutes: 0,
        employeeName,
        flagCounts: {
          autoClosed: 0,
          edited: 0,
          manual: 0,
        },
        grossPayCents: BigInt(0),
        overtimeMinutes: 0,
        payableMinutes: 0,
        rateSnapshot: {
          annualSalaryCents: rate?.annualSalaryCents ? Number(rate.annualSalaryCents) : null,
          baseHourlyRateCents: rate?.baseHourlyRateCents ? Number(rate.baseHourlyRateCents) : null,
          currency: rate?.currency ?? null,
          ot1Multiplier: params.setting.defaultOvertimePolicy?.ot1Multiplier
            ? Number(params.setting.defaultOvertimePolicy.ot1Multiplier)
            : DEFAULT_OT1_MULTIPLIER,
          ot1WeeklyAfterMinutes:
            params.setting.defaultOvertimePolicy?.ot1WeeklyAfterMinutes ?? DEFAULT_OVERTIME_THRESHOLD_MINUTES,
          ot2Multiplier: params.setting.defaultOvertimePolicy?.ot2Multiplier
            ? Number(params.setting.defaultOvertimePolicy.ot2Multiplier)
            : 2,
          payType: rate?.payType ?? null,
          resolvedHourlyRateCents: hourlyRateCents ? Number(hourlyRateCents) : null,
          title: rate?.title ?? null,
        },
        regularMinutes: 0,
        shiftCount: 0,
        totalMinutes: 0,
      };
    const allocation = weeklyAllocation.shiftAllocations.get(shift.id);
    const regularMinutes = allocation?.regularMinutes ?? payableMinutes;
    const overtimeMinutes = allocation?.overtimeMinutes ?? 0;
    const grossPayCents =
      computeGrossPayCents(regularMinutes, hourlyRateCents) +
      computeGrossPayCents(overtimeMinutes, hourlyRateCents, overtimeMultiplier);
    const actualTimestamps = resolveActualShiftTimestamps({
      adjustments: shift.adjustments,
      startedAt: shift.startedAt,
      endedAt: shift.endedAt,
    });
    const weekWindow = allocation
      ? {
          weekStartDate: allocation.weekStartDate,
          weekEndDate: allocation.weekEndDate,
        }
      : resolveWeekWindowForBusinessDate(
          formatDateOnly(params.setting.payrollCalendar.anchorStartDate),
          formatDateOnly(shift.businessDate)
        );
    const flags = {
      autoClosed: shift.status === "auto_closed",
      edited: shift.status === "edited" || shift.adjustments.length > 0,
      manual: shift.entryMode === "manual",
    };
    const punchInfo = buildShiftPunchInfo({
      actualStartedAt: actualTimestamps.actualStartedAt,
      actualEndedAt: actualTimestamps.actualEndedAt,
      editedStartedAt: shift.startedAt.toISOString(),
      editedEndedAt: shift.endedAt?.toISOString() ?? null,
      isManual: flags.manual,
      isEdited: flags.edited,
      isAutoClosed: flags.autoClosed,
      clockInReplaced: Boolean(shift.clockInPunch.replacedByPunchId),
      clockOutReplaced: Boolean(shift.clockOutPunch?.replacedByPunchId),
      latestAdjustmentReason: shift.adjustments[shift.adjustments.length - 1]?.reason ?? null,
    });

    existingAccumulator.totalMinutes += totalMinutes;
    existingAccumulator.breakMinutes += shift.breakMinutes;
    existingAccumulator.payableMinutes += payableMinutes;
    existingAccumulator.regularMinutes += regularMinutes;
    existingAccumulator.overtimeMinutes += overtimeMinutes;
    existingAccumulator.grossPayCents += grossPayCents;
    existingAccumulator.shiftCount += 1;
    existingAccumulator.flagCounts.autoClosed += flags.autoClosed ? 1 : 0;
    existingAccumulator.flagCounts.edited += flags.edited ? 1 : 0;
    existingAccumulator.flagCounts.manual += flags.manual ? 1 : 0;
    employeeAccumulator.set(shift.employeeId, existingAccumulator);

    computedShifts.push({
      shiftSessionId: shift.id,
      employeeId: shift.employeeId,
      employeeName,
      actualStartedAt: actualTimestamps.actualStartedAt,
      actualEndedAt: actualTimestamps.actualEndedAt,
      startedAt: shift.startedAt.toISOString(),
      endedAt: shift.endedAt?.toISOString() ?? null,
      businessDate: formatDateOnly(shift.businessDate),
      weekStartDate: weekWindow.weekStartDate,
      weekEndDate: weekWindow.weekEndDate,
      totalMinutes,
      breakMinutes: shift.breakMinutes,
      payableMinutes,
      regularMinutes,
      overtime1Minutes: overtimeMinutes,
      overtime2Minutes: 0,
      estimatedGrossCents: hourlyRateCents === null ? null : grossPayCents,
      departmentLabel: normalizeOptionalText(rate?.title),
      punchInfo,
      entryMode: shift.entryMode,
      status: shift.status,
      source: shift.clockInPunch.source,
      flags,
    });
  }

  const employees = Array.from(employeeAccumulator.entries())
    .map(([employeeId, accumulator]) => {
      const previousApproval = params.previousApprovals?.get(employeeId) ?? null;
      const invalidated = params.invalidatedEmployeeIds?.has(employeeId) ?? false;
      const approvalStatus = invalidated
        ? "needs_changes"
        : previousApproval?.approvalStatus ?? "pending";

      return {
        employeeId,
        name: accumulator.employeeName,
        approvalStatus,
        approvedAt:
          approvalStatus === "approved" && previousApproval?.approvedAt
            ? previousApproval.approvedAt.toISOString()
            : null,
        approvedByDisplay:
          approvalStatus === "approved" || approvalStatus === "needs_changes"
            ? previousApproval?.approvedByDisplay ?? null
            : null,
        approvedByUserId: approvalStatus === "approved" ? previousApproval?.approvedByUserId ?? null : null,
        approvalNote: invalidated ? "Underlying shift changed after review." : previousApproval?.approvalNote ?? null,
        totalMinutes: accumulator.totalMinutes,
        payableMinutes: accumulator.payableMinutes,
        regularMinutes: accumulator.regularMinutes,
        overtimeMinutes: accumulator.overtimeMinutes,
        regularHours: formatHoursFromMinutes(accumulator.regularMinutes),
        overtimeHours: formatHoursFromMinutes(accumulator.overtimeMinutes),
        totalHours: formatHoursFromMinutes(accumulator.payableMinutes),
        shiftCount: accumulator.shiftCount,
        estimatedGross: accumulator.grossPayCents > BigInt(0) ? centsToCurrencyNumber(accumulator.grossPayCents) : null,
        grossPayCents: accumulator.grossPayCents,
        flagCounts: accumulator.flagCounts,
        rateSnapshot: accumulator.rateSnapshot,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  const totals = employees.reduce(
    (accumulator, employee) => {
      accumulator.totalMinutes += employee.payableMinutes;
      accumulator.overtimeMinutes += employee.overtimeMinutes;
      accumulator.estimatedGrossCents += employee.grossPayCents;
      return accumulator;
    },
    {
      totalMinutes: 0,
      overtimeMinutes: 0,
      estimatedGrossCents: BigInt(0),
    }
  );
  const approvalSummary = buildApprovalSummaryFromEmployees(employees);

  return {
    employees,
    shifts: computedShifts.sort((left, right) => right.startedAt.localeCompare(left.startedAt)),
    approvalSummary,
    totals: {
      totalMinutes: totals.totalMinutes,
      totalHours: formatHoursFromMinutes(totals.totalMinutes),
      overtimeMinutes: totals.overtimeMinutes,
      overtimeHours: formatHoursFromMinutes(totals.overtimeMinutes),
      estimatedGrossCents:
        totals.estimatedGrossCents > BigInt(0) ? Number(totals.estimatedGrossCents) : null,
      estimatedGross:
        totals.estimatedGrossCents > BigInt(0) ? centsToCurrencyNumber(totals.estimatedGrossCents) : null,
    },
  } satisfies ComputedRunData;
}

async function loadPeriodForProperty(propertyId: string, periodId: string) {
  const settings = await listPayrollSettingsForProperty(propertyId);
  const calendarIds = settings.map((setting) => setting.payrollCalendarId);

  if (calendarIds.length === 0) {
    return null;
  }

  const period = await prisma.payrollPeriod.findFirst({
    where: {
      id: periodId,
      payrollCalendarId: {
        in: calendarIds,
      },
    },
    select: {
      id: true,
      payrollCalendarId: true,
      periodStartDate: true,
      periodEndDate: true,
      status: true,
    },
  });

  if (!period) {
    return null;
  }

  const setting = settings.find((candidate) => candidate.payrollCalendarId === period.payrollCalendarId) ?? null;

  if (!setting) {
    return null;
  }

  return {
    period,
    setting,
  };
}

async function getLatestRunForPeriod(propertyId: string, payrollPeriodId: string) {
  return prisma.payrollRun.findFirst({
    where: {
      propertyId,
      payrollPeriodId,
    },
    orderBy: {
      version: "desc",
    },
    include: {
      employeeSummaries: {
        include: {
          approvedByUser: {
            select: {
              email: true,
              fullName: true,
            },
          },
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      finalizedByUser: {
        select: {
          email: true,
          fullName: true,
        },
      },
      requestedByUser: {
        select: {
          email: true,
          fullName: true,
        },
      },
      shiftSnapshots: true,
    },
  });
}

async function getLatestRunSummaryForPeriod(propertyId: string, payrollPeriodId: string) {
  return prisma.payrollRun.findFirst({
    where: {
      propertyId,
      payrollPeriodId,
    },
    orderBy: {
      version: "desc",
    },
    select: {
      id: true,
      version: true,
      status: true,
      requestedByUserId: true,
      startedAt: true,
      completedAt: true,
      finalizedAt: true,
      finalizedByUserId: true,
      requestedByUser: {
        select: {
          email: true,
          fullName: true,
        },
      },
      finalizedByUser: {
        select: {
          email: true,
          fullName: true,
        },
      },
      employeeSummaries: {
        select: {
          approvalStatus: true,
          grossPayCents: true,
          overtime1Minutes: true,
          overtime2Minutes: true,
          payableMinutes: true,
        },
      },
    },
  });
}

function mapPeriodSummary(period: { id: string; periodEndDate: Date; periodStartDate: Date; status: string }) {
  const startDate = formatDateOnly(period.periodStartDate);
  const endDate = formatDateOnly(period.periodEndDate);

  return {
    id: period.id,
    startDate,
    endDate,
    status: period.status,
    label: buildPayrollPeriodLabel(startDate, endDate),
  };
}

function mapRunSummary(
  run: PersistedRunSummaryLike,
  totals: ComputedRunData["totals"],
  approvalSummary: ComputedRunData["approvalSummary"]
) {
  return {
    id: run.id,
    version: run.version,
    status: run.status,
    requestedByUserId: run.requestedByUserId,
    requestedByDisplay: resolveUserDisplayLabel(run.requestedByUser),
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    finalizedAt: run.finalizedAt?.toISOString() ?? null,
    finalizedByUserId: run.finalizedByUserId ?? null,
    finalizedByDisplay: resolveUserDisplayLabel(run.finalizedByUser),
    approvalSummary,
    totals,
  };
}

function mapPersistedRunSummaryData(run: NonNullable<Awaited<ReturnType<typeof getLatestRunSummaryForPeriod>>>) {
  const employees = run.employeeSummaries.map((summary) => ({
    approvalStatus: summary.approvalStatus as "approved" | "needs_changes" | "pending",
  }));

  return {
    approvalSummary: buildApprovalSummaryFromEmployees(employees),
    totals: buildRunTotalsFromEmployeeSummaries(run.employeeSummaries),
  };
}

function mapPersistedRunData(run: NonNullable<Awaited<ReturnType<typeof getLatestRunForPeriod>>>) {
  const employees = run.employeeSummaries
    .map((summary) => ({
      employeeId: summary.employeeId,
      name: `${summary.employee.firstName} ${summary.employee.lastName}`.trim(),
      approvalStatus: summary.approvalStatus as "approved" | "needs_changes" | "pending",
      approvedAt: summary.approvedAt?.toISOString() ?? null,
      approvedByDisplay: resolveUserDisplayLabel(summary.approvedByUser),
      approvedByUserId: summary.approvedByUserId ?? null,
      approvalNote: summary.approvalNote ?? null,
      totalMinutes: summary.totalMinutes,
      payableMinutes: summary.payableMinutes,
      regularMinutes: summary.regularMinutes,
      overtimeMinutes: summary.overtime1Minutes + summary.overtime2Minutes,
      regularHours: formatHoursFromMinutes(summary.regularMinutes),
      overtimeHours: formatHoursFromMinutes(summary.overtime1Minutes + summary.overtime2Minutes),
      totalHours: formatHoursFromMinutes(summary.payableMinutes),
      shiftCount: run.shiftSnapshots.filter((snapshot) => snapshot.employeeId === summary.employeeId).length,
      estimatedGross: centsToCurrencyNumber(summary.grossPayCents),
      grossPayCents: summary.grossPayCents,
      flagCounts: run.shiftSnapshots
        .filter((snapshot) => snapshot.employeeId === summary.employeeId)
        .reduce(
          (accumulator, snapshot) => {
            accumulator.manual += snapshot.isManual ? 1 : 0;
            accumulator.edited += snapshot.isEdited ? 1 : 0;
            accumulator.autoClosed += snapshot.isAutoClosed ? 1 : 0;
            return accumulator;
          },
          {
            manual: 0,
            edited: 0,
            autoClosed: 0,
          }
        ),
      rateSnapshot:
        summary.rateSnapshot && typeof summary.rateSnapshot === "object" && !Array.isArray(summary.rateSnapshot)
          ? (summary.rateSnapshot as Record<string, unknown>)
          : {},
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const shifts = run.shiftSnapshots
    .map((snapshot) => ({
      shiftSessionId: snapshot.shiftSessionId,
      employeeId: snapshot.employeeId,
      employeeName: snapshot.employeeName,
      actualStartedAt: snapshot.actualStartedAt?.toISOString() ?? snapshot.startedAt.toISOString(),
      actualEndedAt: snapshot.actualEndedAt?.toISOString() ?? snapshot.endedAt?.toISOString() ?? null,
      startedAt: snapshot.startedAt.toISOString(),
      endedAt: snapshot.endedAt?.toISOString() ?? null,
      businessDate: formatDateOnly(snapshot.businessDate),
      weekStartDate:
        snapshot.weekStartDate?.toISOString().slice(0, 10) ?? formatDateOnly(snapshot.businessDate),
      weekEndDate:
        snapshot.weekEndDate?.toISOString().slice(0, 10) ??
        formatDateOnly(addDays(snapshot.businessDate, 6)),
      totalMinutes: snapshot.totalMinutes,
      breakMinutes: snapshot.breakMinutes,
      payableMinutes: snapshot.payableMinutes,
      regularMinutes: snapshot.regularMinutes ?? snapshot.payableMinutes,
      overtime1Minutes: snapshot.overtime1Minutes ?? 0,
      overtime2Minutes: snapshot.overtime2Minutes ?? 0,
      estimatedGrossCents: snapshot.estimatedGrossCents,
      departmentLabel: snapshot.departmentLabel ?? null,
      punchInfo: snapshot.punchInfo ?? null,
      entryMode: snapshot.entryMode,
      status: snapshot.shiftStatus,
      source: snapshot.source,
      flags: {
        manual: snapshot.isManual,
        edited: snapshot.isEdited,
        autoClosed: snapshot.isAutoClosed,
      },
    }))
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  const approvalSummary = buildApprovalSummaryFromEmployees(employees);
  const estimatedGrossCents = employees.reduce((accumulator, employee) => accumulator + employee.grossPayCents, BigInt(0));
  const totalMinutes = employees.reduce((accumulator, employee) => accumulator + employee.payableMinutes, 0);
  const overtimeMinutes = employees.reduce((accumulator, employee) => accumulator + employee.overtimeMinutes, 0);

  return {
    employees,
    shifts,
    approvalSummary,
    totals: {
      totalMinutes,
      totalHours: formatHoursFromMinutes(totalMinutes),
      overtimeMinutes,
      overtimeHours: formatHoursFromMinutes(overtimeMinutes),
      estimatedGrossCents: estimatedGrossCents > BigInt(0) ? Number(estimatedGrossCents) : null,
      estimatedGross: estimatedGrossCents > BigInt(0) ? centsToCurrencyNumber(estimatedGrossCents) : null,
    },
  } satisfies ComputedRunData;
}

function buildPayrollAnalytics(
  runData: ComputedRunData,
  latestRun: Awaited<ReturnType<typeof getLatestRunForPeriod>> | null
) {
  const flaggedShifts = runData.shifts.filter(
    (shift) => shift.flags.manual || shift.flags.edited || shift.flags.autoClosed
  ).length;
  const lockedShiftCount = latestRun?.status === "finalized" ? runData.shifts.length : 0;
  const exceptionSummary = runData.shifts.reduce(
    (accumulator, shift) => {
      accumulator.manual += shift.flags.manual ? 1 : 0;
      accumulator.edited += shift.flags.edited ? 1 : 0;
      accumulator.autoClosed += shift.flags.autoClosed ? 1 : 0;
      return accumulator;
    },
    {
      manual: 0,
      edited: 0,
      autoClosed: 0,
      locked: lockedShiftCount,
    }
  );
  const dailyTrend = Array.from(
    runData.shifts.reduce((accumulator, shift) => {
      const existing = accumulator.get(shift.businessDate) ?? {
        businessDate: shift.businessDate,
        label: "",
        payableMinutes: 0,
        shiftCount: 0,
        flaggedShifts: 0,
      };

      existing.payableMinutes += shift.payableMinutes;
      existing.shiftCount += 1;
      existing.flaggedShifts += shift.flags.manual || shift.flags.edited || shift.flags.autoClosed ? 1 : 0;
      accumulator.set(shift.businessDate, existing);
      return accumulator;
    }, new Map<string, { businessDate: string; flaggedShifts: number; label: string; payableMinutes: number; shiftCount: number }>())
  )
    .map(([, value]) => ({
      businessDate: value.businessDate,
      label: new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
      }).format(parseDateOnly(value.businessDate)),
      hours: formatHoursFromMinutes(value.payableMinutes),
      shiftCount: value.shiftCount,
      flaggedShifts: value.flaggedShifts,
    }))
    .sort((left, right) => left.businessDate.localeCompare(right.businessDate));
  const topEmployees = [...runData.employees]
    .sort((left, right) => right.totalMinutes - left.totalMinutes)
    .slice(0, 5)
    .map((employee) => ({
      employeeId: employee.employeeId,
      name: employee.name,
      totalHours: employee.totalHours,
      overtimeHours: employee.overtimeHours,
      estimatedGross: employee.estimatedGross,
      shiftCount: employee.shiftCount,
    }));

  return {
    summary: {
      totalPayableHours: runData.totals.totalHours,
      overtimeHours: runData.totals.overtimeHours,
      estimatedGross: runData.totals.estimatedGross,
      employeesInPeriod: runData.employees.length,
      approvedEmployees: runData.approvalSummary.approvedEmployees,
      pendingEmployees: runData.approvalSummary.pendingEmployees,
      needsChangesEmployees: runData.approvalSummary.needsChangesEmployees,
      flaggedShifts,
    },
    dailyTrend,
    topEmployees,
    exceptionSummary,
  };
}

async function recomputePayrollRun(runId: string, invalidatedEmployeeIds?: Set<string>) {
  const run = await prisma.payrollRun.findUnique({
    where: {
      id: runId,
    },
    include: {
      payrollPeriod: {
        select: {
          id: true,
          payrollCalendarId: true,
          periodStartDate: true,
          periodEndDate: true,
          status: true,
        },
      },
      employeeSummaries: {
        select: {
          employeeId: true,
          approvalStatus: true,
          approvedAt: true,
          approvedByUserId: true,
          approvalNote: true,
          approvedByUser: {
            select: {
              email: true,
              fullName: true,
            },
          },
        },
      },
    },
  });

  if (!run) {
    throw new HttpError(404, "Payroll run not found.");
  }

  if (run.status === "finalized" || run.status === "superseded") {
    throw new HttpError(409, "This payroll run is no longer editable.");
  }

  const setting = await loadPayrollSettingForCalendar(run.propertyId, run.payrollPeriod.payrollCalendarId);

  if (!setting) {
    throw new HttpError(409, "No property payroll setting is available for this payroll period.");
  }

  const previousApprovals = new Map<string, ExistingApprovalSnapshot>(
    run.employeeSummaries.map((summary) => [
      summary.employeeId,
      {
        approvalStatus: summary.approvalStatus as "approved" | "needs_changes" | "pending",
        approvedAt: summary.approvedAt,
        approvedByDisplay: resolveUserDisplayLabel(summary.approvedByUser),
        approvedByUserId: summary.approvedByUserId,
        approvalNote: summary.approvalNote,
      },
    ])
  );
  const computed = await computePayrollData({
    organizationId: run.organizationId,
    propertyId: run.propertyId,
    period: run.payrollPeriod,
    setting,
    previousApprovals,
    invalidatedEmployeeIds,
  });
  const nextRunStatus =
    run.status === "in_review" ||
    computed.employees.some((employee) => employee.approvalStatus !== "pending")
      ? "in_review"
      : "draft";

  await prisma.$transaction(async (tx) => {
    await tx.payrollRunShiftSnapshot.deleteMany({
      where: {
        payrollRunId: run.id,
      },
    });
    await tx.payrollRunEmployeeSummary.deleteMany({
      where: {
        payrollRunId: run.id,
      },
    });

    for (const employee of computed.employees) {
      const resolvedHourlyRateCents = BigInt((employee.rateSnapshot.resolvedHourlyRateCents as number | null) ?? 0);
      const summary = await tx.payrollRunEmployeeSummary.create({
        data: {
          payrollRunId: run.id,
          employeeId: employee.employeeId,
          approvalStatus: employee.approvalStatus,
          approvedAt:
            employee.approvalStatus === "approved" && employee.approvedAt ? new Date(employee.approvedAt) : null,
          approvedByUserId: employee.approvalStatus === "approved" ? employee.approvedByUserId : null,
          approvalNote:
            employee.approvalStatus === "approved" || employee.approvalStatus === "needs_changes"
              ? employee.approvalNote
              : null,
          totalMinutes: employee.totalMinutes,
          regularMinutes: employee.regularMinutes,
          overtime1Minutes: employee.overtimeMinutes,
          overtime2Minutes: 0,
          breakMinutes: employee.totalMinutes - employee.payableMinutes,
          payableMinutes: employee.payableMinutes,
          regularPayCents: computeGrossPayCents(employee.regularMinutes, resolvedHourlyRateCents),
          overtime1PayCents: computeGrossPayCents(
            employee.overtimeMinutes,
            resolvedHourlyRateCents,
            setting.defaultOvertimePolicy?.ot1Multiplier ? Number(setting.defaultOvertimePolicy.ot1Multiplier) : DEFAULT_OT1_MULTIPLIER
          ),
          overtime2PayCents: BigInt(0),
          grossPayCents: employee.grossPayCents,
          rateSnapshot: employee.rateSnapshot as Prisma.InputJsonValue,
        },
      });

      await tx.payrollRunPropertyBreakdown.create({
        data: {
          payrollRunEmployeeSummaryId: summary.id,
          propertyId: run.propertyId,
          totalMinutes: employee.totalMinutes,
          regularMinutes: employee.regularMinutes,
          overtime1Minutes: employee.overtimeMinutes,
          overtime2Minutes: 0,
          grossPayCents: employee.grossPayCents,
        },
      });
    }

    if (computed.shifts.length > 0) {
      await tx.payrollRunShiftSnapshot.createMany({
        data: computed.shifts.map((shift) => ({
          payrollRunId: run.id,
          shiftSessionId: shift.shiftSessionId,
          employeeId: shift.employeeId,
          employeeName: shift.employeeName,
          actualStartedAt: new Date(shift.actualStartedAt),
          actualEndedAt: shift.actualEndedAt ? new Date(shift.actualEndedAt) : null,
          startedAt: new Date(shift.startedAt),
          endedAt: shift.endedAt ? new Date(shift.endedAt) : null,
          businessDate: parseDateOnly(shift.businessDate),
          weekStartDate: parseDateOnly(shift.weekStartDate),
          weekEndDate: parseDateOnly(shift.weekEndDate),
          totalMinutes: shift.totalMinutes,
          breakMinutes: shift.breakMinutes,
          payableMinutes: shift.payableMinutes,
          regularMinutes: shift.regularMinutes,
          overtime1Minutes: shift.overtime1Minutes,
          overtime2Minutes: shift.overtime2Minutes,
          estimatedGrossCents: shift.estimatedGrossCents,
          departmentLabel: shift.departmentLabel,
          punchInfo: shift.punchInfo,
          source: shift.source,
          entryMode: shift.entryMode,
          shiftStatus: shift.status,
          isManual: shift.flags.manual,
          isEdited: shift.flags.edited,
          isAutoClosed: shift.flags.autoClosed,
        })),
      });
    }

    await tx.payrollRun.update({
      where: {
        id: run.id,
      },
      data: {
        status: nextRunStatus,
        startedAt: run.startedAt ?? new Date(),
        completedAt: new Date(),
      },
    });
  });
}

function assertPayrollWriteAccess(context: PropertyRequestContext) {
  if (!context.permissions.effective.includes("payroll.write")) {
    throw new HttpError(403, "You do not have permission to manage payroll for this property.");
  }
}

function buildPeriodActions(input: {
  latestRun: { status: string } | null;
  periodEndDate: string;
  todayDate: string;
}) {
  const canCreateRun = input.todayDate > input.periodEndDate && !input.latestRun;
  const canEditRun = input.latestRun ? input.latestRun.status === "draft" || input.latestRun.status === "in_review" : false;
  const canFinalize =
    input.latestRun?.status === "draft" || input.latestRun?.status === "in_review";

  return {
    canCreateRun,
    canApproveEmployees: canEditRun,
    canResetApprovals: canEditRun,
    canFinalize,
    canReopen: input.latestRun?.status === "finalized",
    canExport: input.latestRun?.status === "finalized",
    editable: input.latestRun ? input.latestRun.status !== "finalized" && input.latestRun.status !== "superseded" : canCreateRun,
  };
}

export async function listPropertyPayrollPeriods(context: PropertyRequestContext) {
  const settings = await listPayrollSettingsForProperty(context.property.id);
  const calendarIds = settings.map((setting) => setting.payrollCalendarId);

  if (calendarIds.length === 0) {
    return {
      propertyId: context.property.id,
      periods: [],
    };
  }

  const periods = await prisma.payrollPeriod.findMany({
    where: {
      payrollCalendarId: {
        in: calendarIds,
      },
    },
    orderBy: {
      periodStartDate: "desc",
    },
    select: {
      id: true,
      payrollCalendarId: true,
      periodStartDate: true,
      periodEndDate: true,
      status: true,
    },
  });
  const todayDate = buildDateOnlyForTimezone(new Date(), context.property.timezone);
  const latestRuns = await Promise.all(
    periods.map((period) => getLatestRunSummaryForPeriod(context.property.id, period.id))
  );

  return {
    propertyId: context.property.id,
    periods: periods.map((period, index) => {
      const latestRun = latestRuns[index];
      const periodSummary = mapPeriodSummary(period);
      const runData = latestRun ? mapPersistedRunSummaryData(latestRun) : null;

      return {
        periodId: period.id,
        ...periodSummary,
        latestRun: latestRun ? mapRunSummary(latestRun, runData!.totals, runData!.approvalSummary) : null,
        approvalSummary: runData?.approvalSummary ?? {
          approvedEmployees: 0,
          needsChangesEmployees: 0,
          pendingEmployees: 0,
          totalEmployees: 0,
        },
        totals: runData?.totals ?? {
          totalMinutes: 0,
          totalHours: 0,
          overtimeMinutes: 0,
          overtimeHours: 0,
          estimatedGrossCents: null,
          estimatedGross: null,
        },
        editable: buildPeriodActions({
          latestRun,
          periodEndDate: periodSummary.endDate,
          todayDate,
        }).editable,
      };
    }),
  };
}

export async function getPropertyPayrollPeriodDetail(context: PropertyRequestContext, periodIdInput: string) {
  const periodId = normalizeOptionalText(periodIdInput);

  if (!periodId) {
    throw new HttpError(400, "periodId is required.");
  }

  const resolvedPeriod = await loadPeriodForProperty(context.property.id, periodId);

  if (!resolvedPeriod) {
    throw new HttpError(404, "Payroll period not found for this property.");
  }

  const latestRun = await getLatestRunForPeriod(context.property.id, resolvedPeriod.period.id);
  const periodSummary = mapPeriodSummary(resolvedPeriod.period);
  const todayDate = buildDateOnlyForTimezone(new Date(), context.property.timezone);
  const actions = buildPeriodActions({
    latestRun,
    periodEndDate: periodSummary.endDate,
    todayDate,
  });
  const runData = latestRun
    ? mapPersistedRunData(latestRun)
    : await computePayrollData({
        organizationId: context.property.organizationId,
        propertyId: context.property.id,
        period: resolvedPeriod.period,
        setting: resolvedPeriod.setting,
      });

  return {
    propertyId: context.property.id,
    period: {
      ...periodSummary,
      isCurrent: todayDate >= periodSummary.startDate && todayDate <= periodSummary.endDate,
    },
    latestRun: latestRun ? mapRunSummary(latestRun, runData.totals, runData.approvalSummary) : null,
    approvalSummary: runData.approvalSummary,
    employees: runData.employees.map((employee) => ({
      employeeId: employee.employeeId,
      name: employee.name,
      approvalStatus: employee.approvalStatus,
      approvedAt: employee.approvedAt,
      approvedByDisplay: employee.approvedByDisplay ?? null,
      approvedByUserId: employee.approvedByUserId,
      approvalNote: employee.approvalNote,
      reviewStatusReason:
        employee.approvalStatus === "needs_changes"
          ? employee.approvalNote ?? "Underlying shift changed after review."
          : null,
      regularHours: employee.regularHours,
      overtimeHours: employee.overtimeHours,
      totalHours: employee.totalHours,
      estimatedGross: employee.estimatedGross,
      flagCounts: employee.flagCounts,
      shiftCount: employee.shiftCount,
    })),
    includedShifts: runData.shifts.map((shift) => ({
      shiftSessionId: shift.shiftSessionId,
      employeeId: shift.employeeId,
      employeeName: shift.employeeName,
      startedAt: shift.startedAt,
      endedAt: shift.endedAt,
      businessDate: shift.businessDate,
      payableMinutes: shift.payableMinutes,
      totalMinutes: shift.totalMinutes,
      breakMinutes: shift.breakMinutes,
      entryMode: shift.entryMode,
      status: shift.status,
      source: shift.source,
      flags: {
        ...shift.flags,
        locked: latestRun?.status === "finalized",
      },
      estimatedGross: centsToCurrencyNumber(shift.estimatedGrossCents),
    })),
    analytics: buildPayrollAnalytics(runData, latestRun),
    totals: runData.totals,
    actions,
  };
}

export async function createPropertyPayrollRun(context: PropertyRequestContext, periodIdInput: string) {
  assertPayrollWriteAccess(context);
  const periodId = normalizeOptionalText(periodIdInput);

  if (!periodId) {
    throw new HttpError(400, "periodId is required.");
  }

  const resolvedPeriod = await loadPeriodForProperty(context.property.id, periodId);

  if (!resolvedPeriod) {
    throw new HttpError(404, "Payroll period not found for this property.");
  }

  const periodSummary = mapPeriodSummary(resolvedPeriod.period);
  const todayDate = buildDateOnlyForTimezone(new Date(), context.property.timezone);

  if (todayDate <= periodSummary.endDate) {
    throw new HttpError(409, "Payroll runs can only be created after the pay period has ended.");
  }

  const latestRun = await prisma.payrollRun.findFirst({
    where: {
      propertyId: context.property.id,
      payrollPeriodId: resolvedPeriod.period.id,
    },
    orderBy: {
      version: "desc",
    },
    select: {
      id: true,
      version: true,
      status: true,
    },
  });

  if (latestRun?.status === "finalized") {
    throw new HttpError(409, "This payroll period is already finalized. Reopen it to create a new version.");
  }

  const runId =
    latestRun?.id ??
    (
      await prisma.payrollRun.create({
        data: {
          organizationId: context.property.organizationId,
          propertyId: context.property.id,
          payrollPeriodId: resolvedPeriod.period.id,
          requestedByUserId: context.localUser.id,
          version: (latestRun?.version ?? 0) + 1,
          status: "draft",
          startedAt: new Date(),
        },
        select: {
          id: true,
        },
      })
    ).id;

  await recomputePayrollRun(runId);

  return getPropertyPayrollPeriodDetail(context, resolvedPeriod.period.id);
}

export async function approvePropertyPayrollEmployee(
  context: PropertyRequestContext,
  runIdInput: string,
  employeeIdInput: string,
  noteInput?: string | null
) {
  assertPayrollWriteAccess(context);
  const runId = normalizeOptionalText(runIdInput);
  const employeeId = normalizeOptionalText(employeeIdInput);

  if (!runId || !employeeId) {
    throw new HttpError(400, "runId and employeeId are required.");
  }

  const run = await prisma.payrollRun.findFirst({
    where: {
      id: runId,
      propertyId: context.property.id,
    },
    select: {
      id: true,
      status: true,
      payrollPeriodId: true,
    },
  });

  if (!run) {
    throw new HttpError(404, "Payroll run not found.");
  }

  if (run.status === "finalized" || run.status === "superseded") {
    throw new HttpError(409, "This payroll run can no longer be reviewed.");
  }

  const summary = await prisma.payrollRunEmployeeSummary.findUnique({
    where: {
      payrollRunId_employeeId: {
        payrollRunId: run.id,
        employeeId,
      },
    },
    select: {
      id: true,
    },
  });

  if (!summary) {
    throw new HttpError(404, "Employee summary not found for this payroll run.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.payrollRunEmployeeSummary.update({
      where: {
        id: summary.id,
      },
      data: {
        approvalStatus: "approved",
        approvedAt: new Date(),
        approvedByUserId: context.localUser.id,
        approvalNote: normalizeOptionalText(noteInput) ?? null,
      },
    });

    if (run.status === "draft") {
      await tx.payrollRun.update({
        where: {
          id: run.id,
        },
        data: {
          status: "in_review",
        },
      });
    }
  });

  return getPropertyPayrollPeriodDetail(context, run.payrollPeriodId);
}

export async function resetPropertyPayrollEmployeeApproval(
  context: PropertyRequestContext,
  runIdInput: string,
  employeeIdInput: string,
  noteInput?: string | null
) {
  assertPayrollWriteAccess(context);
  const runId = normalizeOptionalText(runIdInput);
  const employeeId = normalizeOptionalText(employeeIdInput);

  if (!runId || !employeeId) {
    throw new HttpError(400, "runId and employeeId are required.");
  }

  const run = await prisma.payrollRun.findFirst({
    where: {
      id: runId,
      propertyId: context.property.id,
    },
    select: {
      id: true,
      status: true,
      payrollPeriodId: true,
    },
  });

  if (!run) {
    throw new HttpError(404, "Payroll run not found.");
  }

  if (run.status === "finalized" || run.status === "superseded") {
    throw new HttpError(409, "This payroll run can no longer be reviewed.");
  }

  await prisma.payrollRunEmployeeSummary.update({
    where: {
      payrollRunId_employeeId: {
        payrollRunId: run.id,
        employeeId,
      },
    },
    data: {
      approvalStatus: "pending",
      approvedAt: null,
      approvedByUserId: null,
      approvalNote: normalizeOptionalText(noteInput) ?? null,
    },
  });

  return getPropertyPayrollPeriodDetail(context, run.payrollPeriodId);
}

export async function finalizePropertyPayrollRun(context: PropertyRequestContext, runIdInput: string) {
  assertPayrollWriteAccess(context);
  const runId = normalizeOptionalText(runIdInput);

  if (!runId) {
    throw new HttpError(400, "runId is required.");
  }

  const run = await prisma.payrollRun.findFirst({
    where: {
      id: runId,
      propertyId: context.property.id,
    },
    include: {
      employeeSummaries: {
        select: {
          approvalStatus: true,
        },
      },
    },
  });

  if (!run) {
    throw new HttpError(404, "Payroll run not found.");
  }

  if (run.status === "finalized" || run.status === "superseded") {
    throw new HttpError(409, "This payroll run can no longer be finalized.");
  }

  if (run.employeeSummaries.some((summary) => summary.approvalStatus !== "approved")) {
    throw new HttpError(409, "Every employee must be approved before finalizing payroll.");
  }

  await prisma.payrollRun.update({
    where: {
      id: run.id,
    },
    data: {
      status: "finalized",
      completedAt: new Date(),
      finalizedAt: new Date(),
      finalizedByUserId: context.localUser.id,
    },
  });

  return getPropertyPayrollPeriodDetail(context, run.payrollPeriodId);
}

export async function reopenPropertyPayrollRun(context: PropertyRequestContext, runIdInput: string) {
  assertPayrollWriteAccess(context);
  const runId = normalizeOptionalText(runIdInput);

  if (!runId) {
    throw new HttpError(400, "runId is required.");
  }

  const run = await prisma.payrollRun.findFirst({
    where: {
      id: runId,
      propertyId: context.property.id,
    },
    select: {
      id: true,
      organizationId: true,
      propertyId: true,
      payrollPeriodId: true,
      status: true,
      version: true,
    },
  });

  if (!run) {
    throw new HttpError(404, "Payroll run not found.");
  }

  if (run.status !== "finalized") {
    throw new HttpError(409, "Only finalized payroll runs can be reopened.");
  }

  const reopenedRun = await prisma.$transaction(async (tx) => {
    const createdRun = await tx.payrollRun.create({
      data: {
        organizationId: run.organizationId,
        propertyId: run.propertyId,
        payrollPeriodId: run.payrollPeriodId,
        requestedByUserId: context.localUser.id,
        version: run.version + 1,
        status: "draft",
        startedAt: new Date(),
        notes: `Reopened from run ${run.id}`,
      },
      select: {
        id: true,
      },
    });

    await tx.payrollRun.update({
      where: {
        id: run.id,
      },
      data: {
        status: "superseded",
        supersededByPayrollRunId: createdRun.id,
      },
    });

    return createdRun;
  });

  await recomputePayrollRun(reopenedRun.id);

  return getPropertyPayrollPeriodDetail(context, run.payrollPeriodId);
}

export async function exportPropertyPayrollSummaryCsv(context: PropertyRequestContext, runIdInput: string) {
  const runId = normalizeOptionalText(runIdInput);

  if (!runId) {
    throw new HttpError(400, "runId is required.");
  }

  const run = await loadFinalizedPayrollRunForExport(prisma, context.property.id, runId);
  const rows: Array<Array<string | number | null>> = [
    [
      "Employee",
      "Approval Status",
      "Approved At",
      "Regular Hours",
      "Overtime Hours",
      "Total Hours",
      "Gross Pay",
    ],
  ];

  for (const summary of run.employeeSummaries) {
    rows.push([
      `${summary.employee.firstName} ${summary.employee.lastName}`.trim(),
      summary.approvalStatus,
      summary.approvedAt?.toISOString() ?? null,
      formatHoursFromMinutes(summary.regularMinutes),
      formatHoursFromMinutes(summary.overtime1Minutes + summary.overtime2Minutes),
      formatHoursFromMinutes(summary.payableMinutes),
      centsToCurrencyNumber(summary.grossPayCents),
    ]);
  }

  return {
    filename: `property-payroll-summary-${formatDateOnly(run.payrollPeriod.periodStartDate)}-${formatDateOnly(run.payrollPeriod.periodEndDate)}.csv`,
    content: buildCsv(rows),
  };
}

export async function exportPropertyPayrollShiftsCsv(context: PropertyRequestContext, runIdInput: string) {
  const runId = normalizeOptionalText(runIdInput);

  if (!runId) {
    throw new HttpError(400, "runId is required.");
  }

  const run = await loadFinalizedPayrollRunForExport(prisma, context.property.id, runId);
  const rows: Array<Array<string | number | null>> = [
    [
      "Employee",
      "Business Date",
      "Started At",
      "Ended At",
      "Total Hours",
      "Break Hours",
      "Payable Hours",
      "Entry Mode",
      "Source",
      "Status",
      "Manual",
      "Edited",
      "Auto Closed",
      "Estimated Gross",
    ],
  ];

  for (const snapshot of run.shiftSnapshots.sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime())) {
    rows.push([
      snapshot.employeeName,
      formatDateOnly(snapshot.businessDate),
      snapshot.startedAt.toISOString(),
      snapshot.endedAt?.toISOString() ?? null,
      formatHoursFromMinutes(snapshot.totalMinutes),
      formatHoursFromMinutes(snapshot.breakMinutes),
      formatHoursFromMinutes(snapshot.payableMinutes),
      snapshot.entryMode,
      snapshot.source,
      snapshot.shiftStatus,
      snapshot.isManual ? "yes" : "no",
      snapshot.isEdited ? "yes" : "no",
      snapshot.isAutoClosed ? "yes" : "no",
      centsToCurrencyNumber(snapshot.estimatedGrossCents),
    ]);
  }

  return {
    filename: `property-payroll-shifts-${formatDateOnly(run.payrollPeriod.periodStartDate)}-${formatDateOnly(run.payrollPeriod.periodEndDate)}.csv`,
    content: buildCsv(rows),
  };
}

export async function exportPropertyPayrollDetailPdf(context: PropertyRequestContext, runIdInput: string) {
  const runId = normalizeOptionalText(runIdInput);

  if (!runId) {
    throw new HttpError(400, "runId is required.");
  }

  const run = await loadFinalizedPayrollRunForExport(prisma, context.property.id, runId);
  const report = assemblePropertyPayrollDetailReport(run);
  const content = await renderPropertyPayrollDetailPdf(report);

  return {
    filename: `property-payroll-detail-${formatDateOnly(run.payrollPeriod.periodStartDate)}-${formatDateOnly(run.payrollPeriod.periodEndDate)}-v${run.version}.pdf`,
    content,
  };
}

export async function collectPayrollRunIdsForShiftMutation(input: ShiftPayrollMutationInput) {
  const runIds = new Set<string>();
  const seenPeriodIds = new Set<string>();

  for (const candidate of [input.before ?? null, input.after ?? null]) {
    if (!candidate) {
      continue;
    }

    const resolved = await resolveApplicablePeriodForShift(input.propertyId, candidate.startedAt, candidate.businessDate);

    if (!resolved || seenPeriodIds.has(resolved.period.id)) {
      continue;
    }

    seenPeriodIds.add(resolved.period.id);
    const latestRun = await prisma.payrollRun.findFirst({
      where: {
        propertyId: input.propertyId,
        payrollPeriodId: resolved.period.id,
      },
      orderBy: {
        version: "desc",
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!latestRun) {
      continue;
    }

    if (latestRun.status === "finalized") {
      throw new HttpError(409, "This shift belongs to a finalized payroll run. Reopen payroll before editing time.");
    }

    if (latestRun.status === "draft" || latestRun.status === "in_review") {
      runIds.add(latestRun.id);
    }
  }

  return Array.from(runIds);
}

export async function revalidatePayrollRunsForShiftMutation(runIds: string[], employeeId: string) {
  if (runIds.length === 0) {
    return;
  }

  const invalidatedEmployeeIds = new Set([employeeId]);

  for (const runId of runIds) {
    await recomputePayrollRun(runId, invalidatedEmployeeIds);
  }
}

export async function getPayrollImpactForShifts(
  propertyId: string,
  shifts: Array<{
    businessDate: string;
    shiftSessionId: string;
    startedAt: Date;
  }>
) {
  const impactByShiftId = new Map<string, ShiftPayrollImpact>();

  for (const shift of shifts) {
    const resolved = await resolveApplicablePeriodForShift(propertyId, shift.startedAt, shift.businessDate);

    if (!resolved) {
      impactByShiftId.set(shift.shiftSessionId, {
        payrollPeriodId: null,
        payrollRunId: null,
        payrollRunStatus: null,
        payrollRunVersion: null,
        locked: false,
      });
      continue;
    }

    const latestRun = await prisma.payrollRun.findFirst({
      where: {
        propertyId,
        payrollPeriodId: resolved.period.id,
      },
      orderBy: {
        version: "desc",
      },
      select: {
        id: true,
        status: true,
        version: true,
      },
    });

    impactByShiftId.set(shift.shiftSessionId, {
      payrollPeriodId: resolved.period.id,
      payrollRunId: latestRun?.id ?? null,
      payrollRunStatus: latestRun?.status ?? null,
      payrollRunVersion: latestRun?.version ?? null,
      locked: latestRun?.status === "finalized",
    });
  }

  return impactByShiftId;
}
