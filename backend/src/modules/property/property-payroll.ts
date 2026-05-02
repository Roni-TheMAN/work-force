import { HttpError } from "../../lib/http-error";
import { prisma } from "../../lib/prisma";
import type { PropertyRequestContext } from "./property.middleware";
import { allocateWeeklyOvertimeMinutes } from "./property-payroll-runs";

const DEFAULT_AUTO_CLOSE_AFTER_HOURS = 12;
const DEFAULT_OVERTIME_THRESHOLD_MINUTES = 40 * 60;
const DEFAULT_WEEK_ANCHOR_DATE = "1970-01-05";

type UiPayrollFrequency = "biweekly" | "custom_days" | "monthly" | "quarterly" | "weekly";
type PersistedPayrollFrequency = "biweekly" | "custom" | "monthly" | "quarterly" | "semimonthly" | "weekly";

type UpdatePropertyPayrollInput = {
  frequency: UiPayrollFrequency;
  anchorStartDate: string;
  customDayInterval?: number | null;
  autoCloseAfterHours?: number | null;
};

type UpdatePropertyOperationalSettingsInput = {
  name: string;
  timezone: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  payroll?: UpdatePropertyPayrollInput | null;
};

type EmployeeAssignmentRecord = {
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

type ShiftMinuteSummary = {
  breakMinutes: number;
  payableMinutes: number;
  totalMinutes: number;
};

type DashboardShiftRecord = {
  id: string;
  employeeId: string;
  status: string;
  startedAt: Date;
  endedAt: Date | null;
  businessDate: Date;
  totalMinutes: number | null;
  breakMinutes: number;
  payableMinutes: number | null;
};

type DashboardBreakRecord = {
  id: string;
  shiftSessionId: string;
  paid: boolean;
  startedAt: Date;
  endedAt: Date | null;
  durationMinutes: number | null;
};

type EmployeeRateRecord = {
  employeeId: string;
  propertyId: string | null;
  payType: string;
  currency: string;
  baseHourlyRateCents: bigint | null;
  annualSalaryCents: bigint | null;
  effectiveFrom: Date;
};

type PeriodWindow = {
  endDate: string;
  startDate: string;
};

type PayPeriodSummary = {
  endDate: string;
  id: string;
  label: string;
  startDate: string;
  status: string;
};

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeCountryCode(value: string | null | undefined): string | null {
  const normalizedValue = normalizeOptionalText(value);
  return normalizedValue ? normalizedValue.toUpperCase() : null;
}

function normalizePayrollFrequency(value: string | null | undefined): UiPayrollFrequency {
  if (value === "weekly" || value === "biweekly" || value === "monthly" || value === "quarterly" || value === "custom_days") {
    return value;
  }

  throw new HttpError(400, "frequency must be weekly, biweekly, monthly, quarterly, or custom_days.");
}

function normalizeDateOnly(value: string | null | undefined, fieldName: string): string {
  const normalizedValue = normalizeOptionalText(value);

  if (!normalizedValue) {
    throw new HttpError(400, `${fieldName} is required.`);
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

function normalizeCustomDayInterval(value: number | null | undefined, frequency: UiPayrollFrequency): number | null {
  if (frequency !== "custom_days") {
    return null;
  }

  if (!Number.isInteger(value) || (value ?? 0) <= 0) {
    throw new HttpError(400, "customDayInterval must be a positive integer when frequency is custom_days.");
  }

  return value ?? null;
}

function normalizeAutoCloseAfterHours(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw new HttpError(400, "autoCloseAfterHours must be a positive whole number.");
  }

  return value;
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

function diffDays(left: Date, right: Date): number {
  return Math.floor((left.getTime() - right.getTime()) / 86_400_000);
}

function floorDivide(value: number, divisor: number): number {
  return Math.floor(value / divisor);
}

function buildDateOnlyForTimezone(timestamp: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(timestamp);
}

function formatTimeInTimezone(timestamp: Date, timezone: string): string {
  return timestamp.toLocaleTimeString(undefined, {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateTimeInTimezone(timestamp: Date, timezone: string): string {
  return timestamp.toLocaleString(undefined, {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatHoursFromMinutes(minutes: number): number {
  return Number((minutes / 60).toFixed(1));
}

function formatEmployeeName(employee: Pick<EmployeeAssignmentRecord, "firstName" | "lastName">): string {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

function mapPersistedFrequencyToUi(frequency: string): UiPayrollFrequency {
  if (frequency === "weekly" || frequency === "biweekly" || frequency === "monthly" || frequency === "quarterly") {
    return frequency;
  }

  return "custom_days";
}

function mapUiFrequencyToPersisted(frequency: UiPayrollFrequency): PersistedPayrollFrequency {
  if (frequency === "custom_days") {
    return "custom";
  }

  return frequency;
}

function readCustomDayInterval(configJson: unknown): number | null {
  if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) {
    return null;
  }

  const daysInterval = (configJson as { daysInterval?: unknown }).daysInterval;

  if (typeof daysInterval !== "number" || !Number.isInteger(daysInterval) || daysInterval <= 0) {
    return null;
  }

  return daysInterval;
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

function buildOperationalConfig(activeSetting: {
  autoCloseAfterHours: number | null;
  defaultOvertimePolicy: { ot1WeeklyAfterMinutes: number | null } | null;
} | null) {
  const overtimeThresholdMinutes = activeSetting?.defaultOvertimePolicy?.ot1WeeklyAfterMinutes ?? DEFAULT_OVERTIME_THRESHOLD_MINUTES;

  return {
    overtimeHours: formatHoursFromMinutes(overtimeThresholdMinutes),
    autoClockOutHours: activeSetting?.autoCloseAfterHours ?? DEFAULT_AUTO_CLOSE_AFTER_HOURS,
    schedulingEnabled: true,
  };
}

function buildPayPeriodSummary(period: {
  id: string;
  periodStartDate: Date;
  periodEndDate: Date;
  status: string;
}): PayPeriodSummary {
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
    frequency: string;
    configJson: unknown;
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

  const fallbackStartDate = formatDateOnly(anchorDate);
  return {
    startDate: fallbackStartDate,
    endDate: fallbackStartDate,
  };
}

function buildNextPeriodWindow(
  calendar: {
    anchorStartDate: Date;
    frequency: string;
    configJson: unknown;
  },
  currentStartDate: string
): PeriodWindow {
  const currentStart = parseDateOnly(currentStartDate);
  const persistedFrequency = calendar.frequency as PersistedPayrollFrequency;

  if (persistedFrequency === "weekly" || persistedFrequency === "biweekly" || persistedFrequency === "custom") {
    const intervalDays =
      persistedFrequency === "weekly"
        ? 7
        : persistedFrequency === "biweekly"
          ? 14
          : readCustomDayInterval(calendar.configJson) ?? 14;
    const nextStartDate = addDays(currentStart, intervalDays);

    return {
      startDate: formatDateOnly(nextStartDate),
      endDate: formatDateOnly(addDays(nextStartDate, intervalDays - 1)),
    };
  }

  const monthSpan = persistedFrequency === "quarterly" ? 3 : 1;
  const nextStartDate = addMonthsClamped(currentStart, monthSpan);
  const nextNextStartDate = addMonthsClamped(nextStartDate, monthSpan);

  return {
    startDate: formatDateOnly(nextStartDate),
    endDate: formatDateOnly(addDays(nextNextStartDate, -1)),
  };
}

function computeShiftMinutes(
  shift: DashboardShiftRecord,
  breaks: DashboardBreakRecord[],
  asOf: Date
): ShiftMinuteSummary {
  if (shift.endedAt && shift.totalMinutes !== null && shift.payableMinutes !== null) {
    return {
      totalMinutes: shift.totalMinutes,
      breakMinutes: shift.breakMinutes,
      payableMinutes: shift.payableMinutes,
    };
  }

  const effectiveEndAt = shift.endedAt ?? asOf;
  const totalMinutes = Math.max(0, Math.floor((effectiveEndAt.getTime() - shift.startedAt.getTime()) / 60_000));
  let breakMinutes = 0;
  let unpaidBreakMinutes = 0;

  for (const segment of breaks) {
    const segmentEndedAt = segment.endedAt ?? asOf;

    if (segmentEndedAt < segment.startedAt) {
      continue;
    }

    const durationMinutes =
      segment.durationMinutes ?? Math.max(0, Math.floor((segmentEndedAt.getTime() - segment.startedAt.getTime()) / 60_000));

    breakMinutes += durationMinutes;

    if (!segment.paid) {
      unpaidBreakMinutes += durationMinutes;
    }
  }

  return {
    totalMinutes,
    breakMinutes,
    payableMinutes: Math.max(0, totalMinutes - unpaidBreakMinutes),
  };
}

function pickRateForEmployee(rates: EmployeeRateRecord[], propertyId: string): EmployeeRateRecord | null {
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

async function listPropertyEmployees(propertyId: string): Promise<EmployeeAssignmentRecord[]> {
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

async function loadActivePropertyPayrollSetting(propertyId: string, referenceTime = new Date()) {
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
          ot1WeeklyAfterMinutes: true,
        },
      },
    },
    orderBy: {
      effectiveFrom: "desc",
    },
  });
}

async function ensureDefaultOvertimePolicy(organizationId: string) {
  const existingPolicy = await prisma.overtimePolicy.findFirst({
    where: {
      organizationId,
      propertyId: null,
      status: "active",
    },
    orderBy: {
      effectiveFrom: "desc",
    },
    select: {
      id: true,
    },
  });

  if (existingPolicy) {
    return existingPolicy.id;
  }

  const createdPolicy = await prisma.overtimePolicy.create({
    data: {
      organizationId,
      propertyId: null,
      name: "Standard overtime",
      status: "active",
      ot1Multiplier: "1.5",
      ot2Multiplier: "2.0",
      ot1WeeklyAfterMinutes: DEFAULT_OVERTIME_THRESHOLD_MINUTES,
      effectiveFrom: new Date(),
    },
    select: {
      id: true,
    },
  });

  return createdPolicy.id;
}

async function upsertPayrollPeriod(
  calendar: {
    id: string;
    organizationId: string;
  },
  window: PeriodWindow,
  status: string
) {
  return prisma.payrollPeriod.upsert({
    where: {
      payrollCalendarId_periodStartDate_periodEndDate: {
        payrollCalendarId: calendar.id,
        periodStartDate: parseDateOnly(window.startDate),
        periodEndDate: parseDateOnly(window.endDate),
      },
    },
    update: {
      status,
    },
    create: {
      organizationId: calendar.organizationId,
      payrollCalendarId: calendar.id,
      periodStartDate: parseDateOnly(window.startDate),
      periodEndDate: parseDateOnly(window.endDate),
      status,
    },
  });
}

async function ensureCurrentAndNextPeriods(
  activeSetting: NonNullable<Awaited<ReturnType<typeof loadActivePropertyPayrollSetting>>>,
  todayDate: string
) {
  let currentPeriod = await prisma.payrollPeriod.findFirst({
    where: {
      payrollCalendarId: activeSetting.payrollCalendarId,
      status: "open",
    },
    orderBy: {
      periodStartDate: "desc",
    },
  });

  if (!currentPeriod) {
    const currentWindow = buildPeriodWindowForDate(activeSetting.payrollCalendar, todayDate);
    currentPeriod = await upsertPayrollPeriod(
      {
        id: activeSetting.payrollCalendar.id,
        organizationId: activeSetting.payrollCalendar.organizationId,
      },
      currentWindow,
      "open"
    );
  }

  const nextWindow = buildNextPeriodWindow(activeSetting.payrollCalendar, formatDateOnly(currentPeriod.periodStartDate));
  const nextPeriod = await upsertPayrollPeriod(
    {
      id: activeSetting.payrollCalendar.id,
      organizationId: activeSetting.payrollCalendar.organizationId,
    },
    nextWindow,
    "locked"
  );

  return {
    currentPeriod: buildPayPeriodSummary(currentPeriod),
    nextPeriod: buildPayPeriodSummary(nextPeriod),
  };
}

function activeSettingMatchesStructure(
  activeSetting: NonNullable<Awaited<ReturnType<typeof loadActivePropertyPayrollSetting>>>,
  input: UpdatePropertyPayrollInput
) {
  return (
    mapPersistedFrequencyToUi(activeSetting.payrollCalendar.frequency) === input.frequency &&
    formatDateOnly(activeSetting.payrollCalendar.anchorStartDate) === input.anchorStartDate &&
    (readCustomDayInterval(activeSetting.payrollCalendar.configJson) ?? null) === (input.customDayInterval ?? null)
  );
}

async function createActivePayrollSetting(
  property: {
    id: string;
    organizationId: string;
    timezone: string;
  },
  payrollInput: UpdatePropertyPayrollInput,
  createdAt: Date
) {
  const defaultOvertimePolicyId = await ensureDefaultOvertimePolicy(property.organizationId);
  const payrollCalendar = await prisma.payrollCalendar.create({
    data: {
      organizationId: property.organizationId,
      name: `property:${property.id}:payroll:${createdAt.getTime()}`,
      frequency: mapUiFrequencyToPersisted(payrollInput.frequency),
      timezone: property.timezone,
      anchorStartDate: parseDateOnly(payrollInput.anchorStartDate),
      payDelayDays: 0,
      status: "active",
      ...(payrollInput.customDayInterval ? { configJson: { daysInterval: payrollInput.customDayInterval } } : {}),
    },
  });

  const activeSetting = await prisma.propertyPayrollSetting.create({
    data: {
      propertyId: property.id,
      payrollCalendarId: payrollCalendar.id,
      defaultOvertimePolicyId,
      roundingIncrementMinutes: 1,
      roundingMode: "nearest",
      autoCloseAfterHours: payrollInput.autoCloseAfterHours ?? DEFAULT_AUTO_CLOSE_AFTER_HOURS,
      mealBreakDeductionMinutes: null,
      effectiveFrom: createdAt,
    },
    include: {
      payrollCalendar: true,
      defaultOvertimePolicy: {
        select: {
          id: true,
          ot1WeeklyAfterMinutes: true,
        },
      },
    },
  });

  const todayDate = buildDateOnlyForTimezone(createdAt, property.timezone);
  await ensureCurrentAndNextPeriods(activeSetting, todayDate);

  return activeSetting;
}

async function loadDashboardShifts(
  propertyId: string,
  currentPeriod: PayPeriodSummary | null,
  todayDate: string
) {
  const [openShifts, todayShifts, currentPeriodShifts] = await Promise.all([
    prisma.timeShiftSession.findMany({
      where: {
        propertyId,
        status: "open",
      },
      orderBy: {
        startedAt: "asc",
      },
      select: {
        id: true,
        employeeId: true,
        status: true,
        startedAt: true,
        endedAt: true,
        businessDate: true,
        totalMinutes: true,
        breakMinutes: true,
        payableMinutes: true,
      },
    }),
    prisma.timeShiftSession.findMany({
      where: {
        propertyId,
        businessDate: parseDateOnly(todayDate),
      },
      orderBy: {
        startedAt: "desc",
      },
      select: {
        id: true,
        employeeId: true,
        status: true,
        startedAt: true,
        endedAt: true,
        businessDate: true,
        totalMinutes: true,
        breakMinutes: true,
        payableMinutes: true,
      },
    }),
    currentPeriod
      ? prisma.timeShiftSession.findMany({
          where: {
            propertyId,
            businessDate: {
              gte: parseDateOnly(currentPeriod.startDate),
              lte: parseDateOnly(currentPeriod.endDate),
            },
          },
          orderBy: {
            startedAt: "desc",
          },
          select: {
            id: true,
            employeeId: true,
            status: true,
            startedAt: true,
            endedAt: true,
            businessDate: true,
            totalMinutes: true,
            breakMinutes: true,
            payableMinutes: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const dedupedShifts = new Map<string, DashboardShiftRecord>();

  for (const shift of [...openShifts, ...todayShifts, ...currentPeriodShifts]) {
    dedupedShifts.set(shift.id, shift);
  }

  const allShiftIds = Array.from(dedupedShifts.keys());
  const breaks = allShiftIds.length
    ? await prisma.shiftBreakSegment.findMany({
        where: {
          shiftSessionId: {
            in: allShiftIds,
          },
        },
        select: {
          id: true,
          shiftSessionId: true,
          paid: true,
          startedAt: true,
          endedAt: true,
          durationMinutes: true,
        },
      })
    : [];

  return {
    openShifts,
    todayShifts,
    currentPeriodShifts,
    breaks,
  };
}

async function loadEmployeeRates(
  organizationId: string,
  propertyId: string,
  employeeIds: string[],
  referenceTime: Date
) {
  if (employeeIds.length === 0) {
    return new Map<string, EmployeeRateRecord | null>();
  }

  const rates = await prisma.employeePayRate.findMany({
    where: {
      organizationId,
      employeeId: {
        in: employeeIds,
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
      currency: true,
      baseHourlyRateCents: true,
      annualSalaryCents: true,
      effectiveFrom: true,
    },
    orderBy: {
      effectiveFrom: "desc",
    },
  });

  const ratesByEmployeeId = new Map<string, EmployeeRateRecord | null>();

  for (const employeeId of employeeIds) {
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

export async function buildPropertyDashboardMetrics(context: PropertyRequestContext) {
  const referenceTime = new Date();
  const employees = await listPropertyEmployees(context.property.id);
  const activeSetting = await loadActivePropertyPayrollSetting(context.property.id, referenceTime);
  const todayDate = buildDateOnlyForTimezone(referenceTime, context.property.timezone);
  const payPeriodState = activeSetting ? await ensureCurrentAndNextPeriods(activeSetting, todayDate) : { currentPeriod: null, nextPeriod: null };
  const { openShifts, todayShifts, currentPeriodShifts, breaks } = await loadDashboardShifts(
    context.property.id,
    payPeriodState.currentPeriod,
    todayDate
  );
  const breaksByShiftId = new Map<string, DashboardBreakRecord[]>();

  for (const segment of breaks) {
    const existingSegments = breaksByShiftId.get(segment.shiftSessionId) ?? [];
    existingSegments.push(segment);
    breaksByShiftId.set(segment.shiftSessionId, existingSegments);
  }

  const ratesByEmployeeId = await loadEmployeeRates(
    context.property.organizationId,
    context.property.id,
    employees.map((employee) => employee.id),
    referenceTime
  );
  const openShiftByEmployeeId = new Map<string, DashboardShiftRecord>();
  const currentPeriodMinutesByEmployeeId = new Map<string, number>();
  const todayMinutesByEmployeeId = new Map<string, number>();
  const latestShiftByEmployeeId = new Map<string, DashboardShiftRecord>();
  const reviewShifts = currentPeriodShifts.filter((shift) => shift.status === "auto_closed" || shift.status === "edited");

  for (const shift of openShifts) {
    openShiftByEmployeeId.set(shift.employeeId, shift);
  }

  for (const shift of currentPeriodShifts) {
    const shiftMinutes = computeShiftMinutes(shift, breaksByShiftId.get(shift.id) ?? [], referenceTime);
    currentPeriodMinutesByEmployeeId.set(
      shift.employeeId,
      (currentPeriodMinutesByEmployeeId.get(shift.employeeId) ?? 0) + shiftMinutes.payableMinutes
    );

    if (!latestShiftByEmployeeId.has(shift.employeeId)) {
      latestShiftByEmployeeId.set(shift.employeeId, shift);
    }
  }

  for (const shift of todayShifts) {
    const shiftMinutes = computeShiftMinutes(shift, breaksByShiftId.get(shift.id) ?? [], referenceTime);
    todayMinutesByEmployeeId.set(shift.employeeId, (todayMinutesByEmployeeId.get(shift.employeeId) ?? 0) + shiftMinutes.payableMinutes);

    if (!latestShiftByEmployeeId.has(shift.employeeId)) {
      latestShiftByEmployeeId.set(shift.employeeId, shift);
    }
  }

  const overtimeThresholdMinutes = activeSetting?.defaultOvertimePolicy?.ot1WeeklyAfterMinutes ?? DEFAULT_OVERTIME_THRESHOLD_MINUTES;
  const currentPeriodOvertimeAllocation = allocateWeeklyOvertimeMinutes({
    shifts: currentPeriodShifts.map((shift) => {
      const shiftMinutes = computeShiftMinutes(shift, breaksByShiftId.get(shift.id) ?? [], referenceTime);

      return {
        shiftId: shift.id,
        employeeId: shift.employeeId,
        businessDate: formatDateOnly(shift.businessDate),
        payableMinutes: shiftMinutes.payableMinutes,
      };
    }),
    thresholdMinutes: overtimeThresholdMinutes,
    weekAnchorDate: activeSetting ? formatDateOnly(activeSetting.payrollCalendar.anchorStartDate) : DEFAULT_WEEK_ANCHOR_DATE,
  });
  const workforce = employees.map((employee) => {
    const openShift = openShiftByEmployeeId.get(employee.id) ?? null;
    const latestShift = latestShiftByEmployeeId.get(employee.id) ?? null;
    const currentPeriodMinutes = currentPeriodMinutesByEmployeeId.get(employee.id) ?? 0;
    const todayMinutes = todayMinutesByEmployeeId.get(employee.id) ?? 0;
    const rate = ratesByEmployeeId.get(employee.id) ?? null;
    const estimatedHourlyRate =
      rate && rate.payType === "hourly" && rate.baseHourlyRateCents !== null
        ? Number((Number(rate.baseHourlyRateCents) / 100).toFixed(2))
        : null;
    const shiftLabel = openShift
      ? `${formatTimeInTimezone(openShift.startedAt, context.property.timezone)} - Live`
      : latestShift && latestShift.endedAt
        ? `${formatTimeInTimezone(latestShift.startedAt, context.property.timezone)} - ${formatTimeInTimezone(
            latestShift.endedAt,
            context.property.timezone
          )}`
        : "No active shift";

    return {
      id: employee.id,
      userId: employee.userId,
      employeeCode: employee.employeeCode,
      name: formatEmployeeName(employee),
      email: employee.email,
      phone: employee.phone,
      employmentStatus: employee.employmentStatus,
      attendanceStatus:
        employee.employmentStatus.toLowerCase() !== "active"
          ? "inactive"
          : openShift
            ? "clocked-in"
            : todayMinutes > 0
              ? "off-shift"
              : "off-shift",
      todayHours: formatHoursFromMinutes(todayMinutes),
      weeklyHours: formatHoursFromMinutes(currentPeriodMinutes),
      overtimeHours: formatHoursFromMinutes(
        currentPeriodOvertimeAllocation.employeeTotals.get(employee.id)?.overtimeMinutes ?? 0
      ),
      shiftLabel,
      estimatedHourlyRate,
      isPrimary: employee.isPrimary,
      activeFrom: employee.activeFrom?.toISOString() ?? null,
      activeTo: employee.activeTo?.toISOString() ?? null,
    };
  });

  const payrollEmployees = workforce
    .map((employee) => {
      const estimatedWages =
        employee.estimatedHourlyRate === null ? null : Number((employee.weeklyHours * employee.estimatedHourlyRate).toFixed(0));

      return {
        id: employee.id,
        name: employee.name,
        weeklyHours: employee.weeklyHours,
        overtimeHours: employee.overtimeHours,
        estimatedHourlyRate: employee.estimatedHourlyRate,
        estimatedWages,
        shiftLabel: employee.shiftLabel,
      };
    })
    .sort((left, right) => right.weeklyHours - left.weeklyHours);

  const totalEstimatedWages = payrollEmployees.reduce((sum, employee) => sum + (employee.estimatedWages ?? 0), 0);
  const hasAnyWages = payrollEmployees.some((employee) => employee.estimatedWages !== null);

  return {
    property: {
      ...context.property,
      operationalConfig: buildOperationalConfig(activeSetting),
    },
    payrollConfig: {
      isConfigured: Boolean(activeSetting),
      frequency: activeSetting ? mapPersistedFrequencyToUi(activeSetting.payrollCalendar.frequency) : "weekly",
      anchorStartDate: activeSetting ? formatDateOnly(activeSetting.payrollCalendar.anchorStartDate) : null,
      customDayInterval: activeSetting ? readCustomDayInterval(activeSetting.payrollCalendar.configJson) : null,
      autoCloseAfterHours: activeSetting?.autoCloseAfterHours ?? DEFAULT_AUTO_CLOSE_AFTER_HOURS,
    },
    currentPayPeriod: payPeriodState.currentPeriod,
    nextPayPeriod: payPeriodState.nextPeriod,
    overview: {
      activeEmployees: workforce.filter((employee) => employee.attendanceStatus === "clocked-in").length,
      hoursToday: Number(workforce.reduce((sum, employee) => sum + employee.todayHours, 0).toFixed(1)),
      alerts: [
        {
          id: "clock-exceptions",
          title: "Clock exceptions",
          count: reviewShifts.length,
          severity: reviewShifts.length > 0 ? "warning" : "info",
        },
        {
          id: "overtime-warnings",
          title: "Overtime warnings",
          count: workforce.filter((employee) => employee.overtimeHours > 0).length,
          severity: workforce.some((employee) => employee.overtimeHours > 0) ? "warning" : "info",
        },
        {
          id: "payroll-setup",
          title: "Payroll setup",
          count: activeSetting ? 0 : 1,
          severity: activeSetting ? "info" : "warning",
        },
      ],
    },
    workforce,
    time: {
      timeline: workforce
        .filter((employee) => employee.todayHours > 0 || employee.attendanceStatus === "clocked-in")
        .sort((left, right) => right.todayHours - left.todayHours)
        .map((employee) => ({
          id: employee.id,
          employeeName: employee.name,
          status: employee.attendanceStatus,
          shiftLabel: employee.shiftLabel,
          todayHours: employee.todayHours,
        })),
      openShifts: openShifts.map((shift) => {
        const employee = workforce.find((candidate) => candidate.id === shift.employeeId);

        return {
          id: shift.id,
          employeeName: employee?.name ?? "Unknown employee",
          start: formatDateTimeInTimezone(shift.startedAt, context.property.timezone),
          end: "Live",
          status: shift.status,
        };
      }),
      weeklyHours: workforce
        .filter((employee) => employee.weeklyHours > 0)
        .sort((left, right) => right.weeklyHours - left.weeklyHours)
        .map((employee) => ({
          employeeId: employee.id,
          employeeName: employee.name,
          hours: employee.weeklyHours,
        })),
      currentPeriodLabel: payPeriodState.currentPeriod?.label ?? null,
      reviewItems: reviewShifts.map((shift) => {
        const employee = workforce.find((candidate) => candidate.id === shift.employeeId);

        return {
          id: shift.id,
          employeeName: employee?.name ?? "Unknown employee",
          status: shift.status,
          startedAt: formatDateTimeInTimezone(shift.startedAt, context.property.timezone),
        };
      }),
    },
    scheduling: {
      enabled: true,
      days: [],
    },
    payroll: {
      currentPeriod: payPeriodState.currentPeriod,
      nextPeriod: payPeriodState.nextPeriod,
      totalHours: Number(workforce.reduce((sum, employee) => sum + employee.weeklyHours, 0).toFixed(1)),
      estimatedWages: hasAnyWages ? totalEstimatedWages : null,
      overtimeHours: Number(workforce.reduce((sum, employee) => sum + employee.overtimeHours, 0).toFixed(1)),
      requiresAttentionCount: reviewShifts.length,
      canAdvancePeriod:
        Boolean(payPeriodState.currentPeriod) &&
        todayDate > (payPeriodState.currentPeriod?.endDate ?? todayDate),
      employees: payrollEmployees,
    },
  };
}

export async function updatePropertyOperationalSettings(
  context: PropertyRequestContext,
  input: UpdatePropertyOperationalSettingsInput
) {
  const nextProperty = await prisma.property.update({
    where: {
      id: context.property.id,
    },
    data: {
      name: input.name.trim(),
      timezone: input.timezone.trim(),
      addressLine1: normalizeOptionalText(input.addressLine1),
      addressLine2: normalizeOptionalText(input.addressLine2),
      city: normalizeOptionalText(input.city),
      stateRegion: normalizeOptionalText(input.stateRegion),
      postalCode: normalizeOptionalText(input.postalCode),
      countryCode: normalizeCountryCode(input.countryCode),
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      code: true,
      timezone: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      stateRegion: true,
      postalCode: true,
      countryCode: true,
      status: true,
    },
  });

  let activeSetting = await loadActivePropertyPayrollSetting(context.property.id);

  if (input.payroll) {
    const normalizedFrequency = normalizePayrollFrequency(input.payroll.frequency);
    const payrollInput: UpdatePropertyPayrollInput = {
      frequency: normalizedFrequency,
      anchorStartDate: normalizeDateOnly(input.payroll.anchorStartDate, "anchorStartDate"),
      customDayInterval: normalizeCustomDayInterval(input.payroll.customDayInterval, normalizedFrequency),
      autoCloseAfterHours: normalizeAutoCloseAfterHours(input.payroll.autoCloseAfterHours) ?? DEFAULT_AUTO_CLOSE_AFTER_HOURS,
    };
    const settingsChanged = !activeSetting || !activeSettingMatchesStructure(activeSetting, payrollInput);

    if (activeSetting && settingsChanged) {
      await prisma.propertyPayrollSetting.update({
        where: {
          id: activeSetting.id,
        },
        data: {
          effectiveTo: new Date(),
        },
      });

      await prisma.payrollCalendar.update({
        where: {
          id: activeSetting.payrollCalendarId,
        },
        data: {
          status: "inactive",
        },
      });

      activeSetting = null;
    }

    if (!activeSetting) {
      activeSetting = await createActivePayrollSetting(
        {
          id: nextProperty.id,
          organizationId: nextProperty.organizationId,
          timezone: nextProperty.timezone,
        },
        payrollInput,
        new Date()
      );
    } else {
      activeSetting = await prisma.propertyPayrollSetting.update({
        where: {
          id: activeSetting.id,
        },
        data: {
          autoCloseAfterHours: payrollInput.autoCloseAfterHours ?? DEFAULT_AUTO_CLOSE_AFTER_HOURS,
        },
        include: {
          payrollCalendar: true,
          defaultOvertimePolicy: {
            select: {
              id: true,
              ot1WeeklyAfterMinutes: true,
            },
          },
        },
      });

      await prisma.payrollCalendar.update({
        where: {
          id: activeSetting.payrollCalendarId,
        },
        data: {
          timezone: nextProperty.timezone,
          status: "active",
        },
      });

      const todayDate = buildDateOnlyForTimezone(new Date(), nextProperty.timezone);
      await ensureCurrentAndNextPeriods(activeSetting, todayDate);
    }
  }

  return {
    property: {
      ...nextProperty,
      operationalConfig: buildOperationalConfig(activeSetting),
    },
  };
}

export async function advancePropertyPayrollPeriod(context: PropertyRequestContext) {
  const activeSetting = await loadActivePropertyPayrollSetting(context.property.id);

  if (!activeSetting) {
    throw new HttpError(409, "Configure payroll settings for this property before starting a new payroll period.");
  }

  const todayDate = buildDateOnlyForTimezone(new Date(), context.property.timezone);
  const { currentPeriod } = await ensureCurrentAndNextPeriods(activeSetting, todayDate);

  if (todayDate <= currentPeriod.endDate) {
    throw new HttpError(409, "The current pay period has not ended yet.");
  }

  await prisma.payrollPeriod.update({
    where: {
      id: currentPeriod.id,
    },
    data: {
      status: "locked",
    },
  });

  const nextWindow = buildNextPeriodWindow(activeSetting.payrollCalendar, currentPeriod.startDate);
  const nextPeriod = await upsertPayrollPeriod(
    {
      id: activeSetting.payrollCalendar.id,
      organizationId: activeSetting.payrollCalendar.organizationId,
    },
    nextWindow,
    "open"
  );
  const followingWindow = buildNextPeriodWindow(activeSetting.payrollCalendar, formatDateOnly(nextPeriod.periodStartDate));

  await upsertPayrollPeriod(
    {
      id: activeSetting.payrollCalendar.id,
      organizationId: activeSetting.payrollCalendar.organizationId,
    },
    followingWindow,
    "locked"
  );
}
