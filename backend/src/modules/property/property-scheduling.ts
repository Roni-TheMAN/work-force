import { HttpError } from "../../lib/http-error";
import { PERMISSIONS } from "../../lib/permissions";
import { prisma } from "../../lib/prisma";
import { hasPropertyScopeBypassPermission } from "../../lib/rbac";
import { hasEffectivePropertyPermission, type PropertyRequestContext } from "./property.middleware";

type SchedulingStatus = "draft" | "published";
type SchedulingShiftStatus = "cancelled" | "open" | "scheduled";
type OrganizationSchedulingPropertyStatus = "draft" | "not_started" | "published";
type ScheduleTemplateApplySkipReason = "employee_inactive" | "employee_not_assigned" | "employee_terminated";

type WeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6;

type ScheduleRecordLike = {
  createdAt: Date;
  id: string;
  propertyId: string;
  publishedAt: Date | null;
  publishedByUser: {
    email: string | null;
    fullName: string | null;
    id: string;
  } | null;
  publishedByUserId: string | null;
  status: string;
  updatedAt: Date;
  weekStartDate: Date;
};

type ScheduleTemplateShiftRecordLike = {
  breakMinutes: number;
  createdAt: Date;
  dayIndex: number;
  employee: {
    employmentStatus: string;
    firstName: string;
    id: string;
    lastName: string;
  } | null;
  employeeId: string | null;
  endMinutes: number;
  id: string;
  isOvernight: boolean;
  notes: string | null;
  positionLabel: string | null;
  startMinutes: number;
  status: string;
};

type ScheduleTemplateRecordLike = {
  createdAt: Date;
  id: string;
  name: string;
  shifts: ScheduleTemplateShiftRecordLike[];
  slotIndex: number;
  updatedAt: Date;
};

type SchedulingPrisma = typeof prisma & {
  scheduleTemplate: {
    create: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
    findFirst: (args: unknown) => Promise<ScheduleTemplateRecordLike | null>;
    findMany: (args: unknown) => Promise<ScheduleTemplateRecordLike[]>;
    findUnique: (args: unknown) => Promise<{ id: string } | null>;
    update: (args: unknown) => Promise<unknown>;
  };
  scheduleTemplateShift: {
    createMany: (args: unknown) => Promise<unknown>;
    deleteMany: (args: unknown) => Promise<unknown>;
  };
  shift: typeof prisma.shift & {
    deleteMany: (args: unknown) => Promise<unknown>;
  };
};

type SchedulingDependencies = {
  now: () => Date;
  prisma: SchedulingPrisma;
};

type CreatePropertyShiftInput = {
  breakMinutes?: number;
  date?: string;
  employeeId?: string | null;
  endTime?: string;
  notes?: string | null;
  positionLabel?: string | null;
  startTime?: string;
  status?: SchedulingShiftStatus;
};

type UpdatePropertyShiftInput = CreatePropertyShiftInput;

type CreatePropertyScheduleTemplateInput = {
  name?: string | null;
  slotIndex?: number;
  sourceWeekStartDate?: string | null;
};

type ScheduleTemplateShiftInput = {
  breakMinutes?: number;
  dayIndex?: number;
  employeeId?: string | null;
  endMinutes?: number;
  id?: string;
  isOvernight?: boolean;
  notes?: string | null;
  positionLabel?: string | null;
  startMinutes?: number;
  status?: SchedulingShiftStatus;
};

type UpdatePropertyScheduleTemplateInput = {
  name?: string | null;
  shifts?: ScheduleTemplateShiftInput[] | null;
  sourceWeekStartDate?: string | null;
};

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
  status: SchedulingShiftStatus;
  timeLabel: string;
  updatedAt: string;
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
  status: SchedulingStatus;
  weekEndDate: string;
  weekLabel: string;
  weekStartDate: string;
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
  status: SchedulingShiftStatus;
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
      reason: ScheduleTemplateApplySkipReason;
      startTime: string;
      templateShiftId: string;
    }>;
    skippedShiftCount: number;
  };
  week: PropertyScheduleWeek;
};

export type OrganizationSchedulingSummary = {
  generatedAt: string;
  organizationId: string;
  properties: Array<{
    propertyId: string;
    propertyName: string;
    publishedAt: string | null;
    scheduledShiftCount: number;
    status: OrganizationSchedulingPropertyStatus;
    timezone: string;
    weekEndDate: string;
    weekStartDate: string;
  }>;
  summary: {
    draftProperties: number;
    notStartedProperties: number;
    propertyCount: number;
    publishedProperties: number;
    scheduledShiftCount: number;
    unpublishedProperties: number;
  };
};

const defaultDependencies: SchedulingDependencies = {
  prisma: prisma as SchedulingPrisma,
  now: () => new Date(),
};

const QUICK_TIME_PRESETS: ScheduleQuickTimePreset[] = [
  {
    endMinutes: 15 * 60,
    endTime: "15:00",
    id: "07-15",
    isOvernight: false,
    label: "7am - 3pm",
    startMinutes: 7 * 60,
    startTime: "07:00",
  },
  {
    endMinutes: 23 * 60,
    endTime: "23:00",
    id: "15-23",
    isOvernight: false,
    label: "3pm - 11pm",
    startMinutes: 15 * 60,
    startTime: "15:00",
  },
  {
    endMinutes: 7 * 60,
    endTime: "07:00",
    id: "23-07",
    isOvernight: true,
    label: "11pm - 7am",
    startMinutes: 23 * 60,
    startTime: "23:00",
  },
  {
    endMinutes: 14 * 60,
    endTime: "14:00",
    id: "06-14",
    isOvernight: false,
    label: "6am - 2pm",
    startMinutes: 6 * 60,
    startTime: "06:00",
  },
  {
    endMinutes: 16 * 60,
    endTime: "16:00",
    id: "08-16",
    isOvernight: false,
    label: "8am - 4pm",
    startMinutes: 8 * 60,
    startTime: "08:00",
  },
  {
    endMinutes: 17 * 60,
    endTime: "17:00",
    id: "09-17",
    isOvernight: false,
    label: "9am - 5pm",
    startMinutes: 9 * 60,
    startTime: "09:00",
  },
];

const QUICK_POSITION_PRESETS: ScheduleQuickPositionPreset[] = [
  {
    id: "housekeeping",
    label: "Housekeeping",
    positionLabel: "Housekeeping",
  },
  {
    id: "front-desk",
    label: "Front Desk",
    positionLabel: "Front Desk",
  },
  {
    id: "sales",
    label: "Sales",
    positionLabel: "Sales",
  },
  {
    id: "breakfast",
    label: "Breakfast",
    positionLabel: "Breakfast",
  },
  {
    id: "maintenance",
    label: "Maintenance",
    positionLabel: "Maintenance",
  },
  {
    id: "night-audit",
    label: "Night Audit",
    positionLabel: "Night Audit",
  },
  {
    id: "management",
    label: "Management",
    positionLabel: "Management",
  },
];

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function assertScheduleReadAccess(context: PropertyRequestContext) {
  if (!hasEffectivePropertyPermission(context, PERMISSIONS.SCHEDULE_READ)) {
    throw new HttpError(403, "You do not have permission to view schedules for this property.");
  }
}

function assertScheduleWriteAccess(context: PropertyRequestContext) {
  if (!hasEffectivePropertyPermission(context, PERMISSIONS.SCHEDULE_WRITE)) {
    throw new HttpError(403, "You do not have permission to manage schedules for this property.");
  }
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

function validateDateOnly(value: string, fieldName: string): string {
  const normalizedValue = normalizeOptionalText(value);

  if (!normalizedValue) {
    throw new HttpError(400, `${fieldName} is required.`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    throw new HttpError(400, `${fieldName} must be in YYYY-MM-DD format.`);
  }

  const parsedValue = parseDateOnly(normalizedValue);

  if (Number.isNaN(parsedValue.getTime()) || formatDateOnly(parsedValue) !== normalizedValue) {
    throw new HttpError(400, `${fieldName} must be a valid date.`);
  }

  return normalizedValue;
}

function validateTimeValue(value: string, fieldName: string): string {
  const normalizedValue = normalizeOptionalText(value);

  if (!normalizedValue) {
    throw new HttpError(400, `${fieldName} is required.`);
  }

  if (!/^\d{2}:\d{2}$/.test(normalizedValue)) {
    throw new HttpError(400, `${fieldName} must be in HH:mm format.`);
  }

  const [hours, minutes] = normalizedValue.split(":").map((segment) => Number.parseInt(segment, 10));

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new HttpError(400, `${fieldName} must be a valid time.`);
  }

  return normalizedValue;
}

function readTimeParts(value: string) {
  const [hours, minutes] = value.split(":").map((segment) => Number.parseInt(segment, 10));

  return {
    hours,
    minutes,
    totalMinutes: hours * 60 + minutes,
  };
}

function buildQuickPresetCatalog(): PropertyScheduleQuickPresets {
  return {
    positions: QUICK_POSITION_PRESETS,
    times: QUICK_TIME_PRESETS,
  };
}

function buildDefaultTemplateName(slotIndex: number) {
  return `Template ${slotIndex}`;
}

function normalizeTemplateName(value: string | null | undefined, slotIndex: number) {
  return normalizeOptionalText(value) ?? buildDefaultTemplateName(slotIndex);
}

function normalizeTemplateSlotIndex(value: number | undefined): number {
  const normalizedValue = value;

  if (normalizedValue === undefined || !Number.isInteger(normalizedValue) || normalizedValue < 1 || normalizedValue > 3) {
    throw new HttpError(400, "slotIndex must be an integer between 1 and 3.");
  }

  return normalizedValue;
}

function normalizeTemplateDayIndex(value: number | undefined): number {
  const normalizedValue = value;

  if (normalizedValue === undefined || !Number.isInteger(normalizedValue) || normalizedValue < 0 || normalizedValue > 6) {
    throw new HttpError(400, "dayIndex must be an integer between 0 and 6.");
  }

  return normalizedValue;
}

function normalizeMinutesValue(value: number | undefined, fieldName: string): number {
  const normalizedValue = value;

  if (normalizedValue === undefined || !Number.isInteger(normalizedValue) || normalizedValue < 0 || normalizedValue > 1439) {
    throw new HttpError(400, `${fieldName} must be an integer between 0 and 1439.`);
  }

  return normalizedValue;
}

function buildTimeValueFromMinutes(value: number) {
  const hours = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (value % 60).toString().padStart(2, "0");

  return `${hours}:${minutes}`;
}

function buildTimeLabelFromMinutes(value: number) {
  const date = new Date(Date.UTC(1970, 0, 1, Math.floor(value / 60), value % 60, 0));

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function buildTemplateTimeLabel(startMinutes: number, endMinutes: number, isOvernight: boolean) {
  const suffix = isOvernight ? " next day" : "";
  return `${buildTimeLabelFromMinutes(startMinutes)} - ${buildTimeLabelFromMinutes(endMinutes)}${suffix}`;
}

function normalizeBreakMinutes(value: number | undefined, shiftDurationMinutes: number): number {
  const normalizedValue = value ?? 0;

  if (!Number.isInteger(normalizedValue) || normalizedValue < 0) {
    throw new HttpError(400, "breakMinutes must be a non-negative integer.");
  }

  if (normalizedValue > shiftDurationMinutes) {
    throw new HttpError(400, "breakMinutes cannot exceed the shift duration.");
  }

  return normalizedValue;
}

function normalizeWeekStartsOn(value: number | null | undefined): WeekStartsOn {
  return value === 0 || value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6
    ? value
    : 1;
}

function getDatePartsInTimezone(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  return {
    day: parts.find((part) => part.type === "day")?.value ?? "01",
    month: parts.find((part) => part.type === "month")?.value ?? "01",
    year: parts.find((part) => part.type === "year")?.value ?? "0000",
  };
}

function getDateTimePartsInTimezone(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);

  return {
    day: Number.parseInt(parts.find((part) => part.type === "day")?.value ?? "1", 10),
    hour: Number.parseInt(parts.find((part) => part.type === "hour")?.value ?? "0", 10),
    minute: Number.parseInt(parts.find((part) => part.type === "minute")?.value ?? "0", 10),
    month: Number.parseInt(parts.find((part) => part.type === "month")?.value ?? "1", 10),
    second: Number.parseInt(parts.find((part) => part.type === "second")?.value ?? "0", 10),
    year: Number.parseInt(parts.find((part) => part.type === "year")?.value ?? "0", 10),
  };
}

function buildDateOnlyForTimezone(value: Date, timezone: string): string {
  const parts = getDatePartsInTimezone(value, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function buildTimeKeyForTimezone(value: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";

  return `${hour}:${minute}`;
}

function buildTimeLabelForTimezone(value: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function buildWeekLabel(weekStartDate: string, weekEndDate: string): string {
  const startDate = parseDateOnly(weekStartDate);
  const endDate = parseDateOnly(weekEndDate);
  const startLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(startDate);
  const endLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: startDate.getUTCFullYear() === endDate.getUTCFullYear() ? undefined : "numeric",
  }).format(endDate);

  return `${startLabel} - ${endLabel}`;
}

function formatEmployeeName(employee: { firstName: string; lastName: string }) {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

function buildLocalDateTimeInTimezone(dateOnly: string, timeValue: string, timezone: string): Date {
  const [year, month, day] = dateOnly.split("-").map((segment) => Number.parseInt(segment, 10));
  const { hours, minutes } = readTimeParts(timeValue);
  const targetUtcEquivalent = Date.UTC(year, month - 1, day, hours, minutes, 0);
  let utcGuess = targetUtcEquivalent;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const zonedParts = getDateTimePartsInTimezone(new Date(utcGuess), timezone);
    const zonedUtcEquivalent = Date.UTC(
      zonedParts.year,
      zonedParts.month - 1,
      zonedParts.day,
      zonedParts.hour,
      zonedParts.minute,
      zonedParts.second
    );
    const diff = targetUtcEquivalent - zonedUtcEquivalent;

    if (diff === 0) {
      const resolvedDate = new Date(utcGuess);

      if (
        buildDateOnlyForTimezone(resolvedDate, timezone) !== dateOnly ||
        buildTimeKeyForTimezone(resolvedDate, timezone) !== timeValue
      ) {
        throw new HttpError(400, `The local time ${dateOnly} ${timeValue} is not valid in ${timezone}.`);
      }

      return resolvedDate;
    }

    utcGuess += diff;
  }

  throw new HttpError(400, `Unable to resolve ${dateOnly} ${timeValue} in ${timezone}.`);
}

function resolveWeekStartDate(dateOnly: string, weekStartsOn: WeekStartsOn): string {
  const parsedDate = parseDateOnly(dateOnly);
  const currentWeekday = parsedDate.getUTCDay();
  const offset = (currentWeekday - weekStartsOn + 7) % 7;

  return formatDateOnly(addDays(parsedDate, -offset));
}

function normalizeShiftStatus(value: SchedulingShiftStatus | null | undefined): SchedulingShiftStatus {
  if (!value) {
    return "scheduled";
  }

  if (value === "cancelled" || value === "open" || value === "scheduled") {
    return value;
  }

  throw new HttpError(400, "status must be one of scheduled, open, or cancelled.");
}

function getShiftStatusForValidation(status: SchedulingShiftStatus, employeeId: string | null) {
  if (!employeeId && status !== "open") {
    throw new HttpError(400, "employeeId is required unless the shift is marked as open.");
  }

  if (employeeId && status === "open") {
    throw new HttpError(400, "Open shifts cannot be assigned to an employee.");
  }

  return {
    requiresEmployeeValidation: Boolean(employeeId) && status !== "cancelled",
    status,
  };
}

async function loadWeekStartsOn(
  dependencies: SchedulingDependencies,
  propertyId: string,
  referenceDate: string,
  timezone: string
): Promise<WeekStartsOn> {
  const referenceMoment = buildLocalDateTimeInTimezone(referenceDate, "12:00", timezone);
  const activeSetting = await dependencies.prisma.propertyPayrollSetting.findFirst({
    where: {
      propertyId,
      effectiveFrom: {
        lte: referenceMoment,
      },
      OR: [
        {
          effectiveTo: null,
        },
        {
          effectiveTo: {
            gte: referenceMoment,
          },
        },
      ],
    },
    orderBy: {
      effectiveFrom: "desc",
    },
    select: {
      payrollCalendar: {
        select: {
          weekStartsOn: true,
        },
      },
    },
  });

  return normalizeWeekStartsOn(activeSetting?.payrollCalendar.weekStartsOn);
}

async function resolveRequestedWeekStartDate(
  dependencies: SchedulingDependencies,
  property: Pick<PropertyRequestContext["property"], "id" | "timezone">,
  requestedDate: string | null | undefined
) {
  const referenceDate = requestedDate ? validateDateOnly(requestedDate, "weekStartDate") : buildDateOnlyForTimezone(dependencies.now(), property.timezone);
  const weekStartsOn = await loadWeekStartsOn(dependencies, property.id, referenceDate, property.timezone);
  const weekStartDate = resolveWeekStartDate(referenceDate, weekStartsOn);

  return {
    weekEndDate: formatDateOnly(addDays(parseDateOnly(weekStartDate), 6)),
    weekStartDate,
    weekStartsOn,
  };
}

function getPublishedByDisplayName(user: {
  email: string | null;
  fullName: string | null;
} | null) {
  return user?.fullName?.trim() || user?.email || null;
}

async function findScheduleRecord(
  db: typeof prisma,
  propertyId: string,
  weekStartDate: string
): Promise<ScheduleRecordLike | null> {
  return db.schedule.findUnique({
    where: {
      propertyId_weekStartDate: {
        propertyId,
        weekStartDate: parseDateOnly(weekStartDate),
      },
    },
    select: {
      createdAt: true,
      id: true,
      propertyId: true,
      publishedAt: true,
      publishedByUser: {
        select: {
          email: true,
          fullName: true,
          id: true,
        },
      },
      publishedByUserId: true,
      status: true,
      updatedAt: true,
      weekStartDate: true,
    },
  });
}

async function ensureScheduleRecord(
  db: typeof prisma,
  context: PropertyRequestContext,
  weekStartDate: string
): Promise<ScheduleRecordLike> {
  return db.schedule.upsert({
    where: {
      propertyId_weekStartDate: {
        propertyId: context.property.id,
        weekStartDate: parseDateOnly(weekStartDate),
      },
    },
    update: {},
    create: {
      organizationId: context.property.organizationId,
      propertyId: context.property.id,
      status: "draft",
      weekStartDate: parseDateOnly(weekStartDate),
    },
    select: {
      createdAt: true,
      id: true,
      propertyId: true,
      publishedAt: true,
      publishedByUser: {
        select: {
          email: true,
          fullName: true,
          id: true,
        },
      },
      publishedByUserId: true,
      status: true,
      updatedAt: true,
      weekStartDate: true,
    },
  });
}

async function markScheduleDraft(db: typeof prisma, scheduleId: string) {
  await db.schedule.update({
    where: {
      id: scheduleId,
    },
    data: {
      publishedAt: null,
      publishedByUserId: null,
      status: "draft",
    },
  });
}

async function resolvePositionLabel(
  db: typeof prisma,
  context: PropertyRequestContext,
  employeeId: string | null,
  startAt: Date,
  preferredLabel: string | null
): Promise<string | null> {
  if (preferredLabel !== null) {
    return preferredLabel;
  }

  if (!employeeId) {
    return null;
  }

  const propertyRate = await db.employeePayRate.findFirst({
    where: {
      employeeId,
      organizationId: context.property.organizationId,
      propertyId: context.property.id,
      effectiveFrom: {
        lte: startAt,
      },
      OR: [
        {
          effectiveTo: null,
        },
        {
          effectiveTo: {
            gte: startAt,
          },
        },
      ],
    },
    orderBy: {
      effectiveFrom: "desc",
    },
    select: {
      title: true,
    },
  });

  if (normalizeOptionalText(propertyRate?.title) !== null) {
    return normalizeOptionalText(propertyRate?.title);
  }

  const organizationRate = await db.employeePayRate.findFirst({
    where: {
      employeeId,
      organizationId: context.property.organizationId,
      propertyId: null,
      effectiveFrom: {
        lte: startAt,
      },
      OR: [
        {
          effectiveTo: null,
        },
        {
          effectiveTo: {
            gte: startAt,
          },
        },
      ],
    },
    orderBy: {
      effectiveFrom: "desc",
    },
    select: {
      title: true,
    },
  });

  return normalizeOptionalText(organizationRate?.title);
}

async function validateEmployeeAssignment(
  db: typeof prisma,
  context: PropertyRequestContext,
  input: {
    employeeId: string;
    endAt: Date;
    excludeShiftId?: string;
    startAt: Date;
  }
) {
  const employee = await db.employee.findFirst({
    where: {
      id: input.employeeId,
      organizationId: context.property.organizationId,
    },
    select: {
      employmentStatus: true,
      firstName: true,
      id: true,
      lastName: true,
      terminatedAt: true,
    },
  });

  if (!employee) {
    throw new HttpError(404, "Employee not found for this organization.");
  }

  if (employee.employmentStatus.trim().toLowerCase() !== "active") {
    throw new HttpError(409, "Inactive or terminated employees cannot be scheduled.");
  }

  if (employee.terminatedAt && employee.terminatedAt.getTime() <= input.endAt.getTime()) {
    throw new HttpError(409, "Inactive or terminated employees cannot be scheduled.");
  }

  const assignment = await db.employeePropertyAssignment.findUnique({
    where: {
      employeeId_propertyId: {
        employeeId: input.employeeId,
        propertyId: context.property.id,
      },
    },
    select: {
      activeFrom: true,
      activeTo: true,
    },
  });

  if (!assignment) {
    throw new HttpError(409, "This employee is not assigned to the selected property.");
  }

  if ((assignment.activeFrom && assignment.activeFrom.getTime() > input.startAt.getTime()) || (assignment.activeTo && assignment.activeTo.getTime() < input.endAt.getTime())) {
    throw new HttpError(409, "This employee is not assigned to the selected property for the scheduled time.");
  }

  const overlappingShift = await db.shift.findFirst({
    where: {
      employeeId: input.employeeId,
      id: input.excludeShiftId
        ? {
            not: input.excludeShiftId,
          }
        : undefined,
      organizationId: context.property.organizationId,
      startAt: {
        lt: input.endAt,
      },
      endAt: {
        gt: input.startAt,
      },
      status: {
        not: "cancelled",
      },
    },
    select: {
      id: true,
    },
  });

  if (overlappingShift) {
    throw new HttpError(409, "This employee already has an overlapping shift.");
  }

  return {
    employeeId: employee.id,
    employeeName: formatEmployeeName(employee),
    employmentStatus: employee.employmentStatus,
  };
}

function resolveShiftWindow(input: {
  date: string;
  endTime: string;
  startTime: string;
  timezone: string;
}) {
  const startDate = validateDateOnly(input.date, "date");
  const normalizedStartTime = validateTimeValue(input.startTime, "startTime");
  const normalizedEndTime = validateTimeValue(input.endTime, "endTime");
  const startTimeParts = readTimeParts(normalizedStartTime);
  const endTimeParts = readTimeParts(normalizedEndTime);
  const overnight = endTimeParts.totalMinutes <= startTimeParts.totalMinutes;
  const endDate = overnight ? formatDateOnly(addDays(parseDateOnly(startDate), 1)) : startDate;
  const startAt = buildLocalDateTimeInTimezone(startDate, normalizedStartTime, input.timezone);
  const endAt = buildLocalDateTimeInTimezone(endDate, normalizedEndTime, input.timezone);

  if (startAt.getTime() >= endAt.getTime()) {
    throw new HttpError(400, "startTime must be earlier than endTime.");
  }

  return {
    date: startDate,
    endAt,
    endTime: normalizedEndTime,
    overnight,
    startAt,
    startTime: normalizedStartTime,
  };
}

type NormalizedScheduleTemplateShiftInput = {
  breakMinutes: number;
  dayIndex: number;
  employeeId: string | null;
  endMinutes: number;
  id?: string;
  isOvernight: boolean;
  notes: string | null;
  positionLabel: string | null;
  startMinutes: number;
  status: SchedulingShiftStatus;
};

function normalizeScheduleTemplateShiftInput(
  input: ScheduleTemplateShiftInput,
  index: number
): NormalizedScheduleTemplateShiftInput {
  const dayIndex = normalizeTemplateDayIndex(input.dayIndex);
  const startMinutes = normalizeMinutesValue(input.startMinutes, `shifts[${index}].startMinutes`);
  const endMinutes = normalizeMinutesValue(input.endMinutes, `shifts[${index}].endMinutes`);
  const isOvernight = Boolean(input.isOvernight);
  const breakMinutes = normalizeBreakMinutes(input.breakMinutes, isOvernight ? 1440 - startMinutes + endMinutes : endMinutes - startMinutes);

  if (!isOvernight && endMinutes <= startMinutes) {
    throw new HttpError(400, `shifts[${index}] endMinutes must be later than startMinutes for same-day shifts.`);
  }

  if (isOvernight && endMinutes === startMinutes) {
    throw new HttpError(400, `shifts[${index}] overnight shifts cannot start and end at the same minute.`);
  }

  if (isOvernight && endMinutes > startMinutes) {
    throw new HttpError(400, `shifts[${index}] overnight shifts must end on the next day.`);
  }

  return {
    breakMinutes,
    dayIndex,
    employeeId: normalizeOptionalText(input.employeeId ?? null),
    endMinutes,
    id: normalizeOptionalText(input.id) ?? undefined,
    isOvernight,
    notes: normalizeOptionalText(input.notes),
    positionLabel: normalizeOptionalText(input.positionLabel),
    startMinutes,
    status: normalizeShiftStatus(input.status),
  };
}

function buildTemplateShiftTimelineRange(input: Pick<NormalizedScheduleTemplateShiftInput, "dayIndex" | "endMinutes" | "isOvernight" | "startMinutes">) {
  const start = input.dayIndex * 1440 + input.startMinutes;
  const end = (input.dayIndex + (input.isOvernight ? 1 : 0)) * 1440 + input.endMinutes;

  return {
    end,
    start,
  };
}

async function validateTemplateEmployeeSelection(
  db: typeof prisma,
  context: PropertyRequestContext,
  dependencies: SchedulingDependencies,
  employeeId: string
) {
  const employee = await db.employee.findFirst({
    where: {
      id: employeeId,
      organizationId: context.property.organizationId,
    },
    select: {
      employmentStatus: true,
      firstName: true,
      id: true,
      lastName: true,
      terminatedAt: true,
    },
  });

  if (!employee) {
    throw new HttpError(404, "Employee not found for this organization.");
  }

  if (employee.employmentStatus.trim().toLowerCase() !== "active") {
    throw new HttpError(409, "Inactive or terminated employees cannot be saved into templates.");
  }

  if (employee.terminatedAt && employee.terminatedAt.getTime() <= dependencies.now().getTime()) {
    throw new HttpError(409, "Inactive or terminated employees cannot be saved into templates.");
  }

  const assignment = await db.employeePropertyAssignment.findUnique({
    where: {
      employeeId_propertyId: {
        employeeId,
        propertyId: context.property.id,
      },
    },
    select: {
      activeFrom: true,
      activeTo: true,
    },
  });

  if (!assignment) {
    throw new HttpError(409, "This employee is not assigned to the selected property.");
  }

  if (
    (assignment.activeFrom && assignment.activeFrom.getTime() > dependencies.now().getTime()) ||
    (assignment.activeTo && assignment.activeTo.getTime() < dependencies.now().getTime())
  ) {
    throw new HttpError(409, "This employee is not assigned to the selected property.");
  }

  return employee;
}

async function validateScheduleTemplateShiftCollection(
  context: PropertyRequestContext,
  dependencies: SchedulingDependencies,
  shifts: NormalizedScheduleTemplateShiftInput[]
) {
  for (const shift of shifts) {
    if (!shift.employeeId && shift.status !== "open") {
      throw new HttpError(400, "employeeId is required unless the template shift is marked as open.");
    }

    if (shift.employeeId && shift.status === "open") {
      throw new HttpError(400, "Open template shifts cannot be assigned to an employee.");
    }

    if (shift.employeeId) {
      await validateTemplateEmployeeSelection(dependencies.prisma, context, dependencies, shift.employeeId);
    }
  }

  const activeEmployeeShifts = shifts.filter((shift) => shift.employeeId && shift.status !== "cancelled");

  for (let index = 0; index < activeEmployeeShifts.length; index += 1) {
    const currentShift = activeEmployeeShifts[index]!;
    const currentRange = buildTemplateShiftTimelineRange(currentShift);

    for (let compareIndex = index + 1; compareIndex < activeEmployeeShifts.length; compareIndex += 1) {
      const compareShift = activeEmployeeShifts[compareIndex]!;

      if (compareShift.employeeId !== currentShift.employeeId) {
        continue;
      }

      const compareRange = buildTemplateShiftTimelineRange(compareShift);

      if (currentRange.start < compareRange.end && compareRange.start < currentRange.end) {
        throw new HttpError(409, "Template shifts for the same employee cannot overlap.");
      }
    }
  }
}

function buildTemplateShiftWindowForWeek(
  weekStartDate: string,
  timezone: string,
  shift: Pick<NormalizedScheduleTemplateShiftInput, "dayIndex" | "endMinutes" | "isOvernight" | "startMinutes">
) {
  const shiftDate = formatDateOnly(addDays(parseDateOnly(weekStartDate), shift.dayIndex));
  const endDate = shift.isOvernight ? formatDateOnly(addDays(parseDateOnly(shiftDate), 1)) : shiftDate;
  const startTime = buildTimeValueFromMinutes(shift.startMinutes);
  const endTime = buildTimeValueFromMinutes(shift.endMinutes);

  return {
    date: shiftDate,
    endAt: buildLocalDateTimeInTimezone(endDate, endTime, timezone),
    endTime,
    startAt: buildLocalDateTimeInTimezone(shiftDate, startTime, timezone),
    startTime,
  };
}

async function resolveTemplateApplyEmployeeOutcome(
  db: typeof prisma,
  context: PropertyRequestContext,
  input: {
    employeeId: string;
    endAt: Date;
    startAt: Date;
  }
): Promise<{
  employeeName: string | null;
  skipReason: ScheduleTemplateApplySkipReason | null;
}> {
  const employee = await db.employee.findFirst({
    where: {
      id: input.employeeId,
      organizationId: context.property.organizationId,
    },
    select: {
      employmentStatus: true,
      firstName: true,
      id: true,
      lastName: true,
      terminatedAt: true,
    },
  });

  if (!employee) {
    return {
      employeeName: null,
      skipReason: "employee_not_assigned",
    };
  }

  if (employee.employmentStatus.trim().toLowerCase() !== "active") {
    return {
      employeeName: formatEmployeeName(employee),
      skipReason: "employee_inactive",
    };
  }

  if (employee.terminatedAt && employee.terminatedAt.getTime() <= input.endAt.getTime()) {
    return {
      employeeName: formatEmployeeName(employee),
      skipReason: "employee_terminated",
    };
  }

  const assignment = await db.employeePropertyAssignment.findUnique({
    where: {
      employeeId_propertyId: {
        employeeId: input.employeeId,
        propertyId: context.property.id,
      },
    },
    select: {
      activeFrom: true,
      activeTo: true,
    },
  });

  if (
    !assignment ||
    (assignment.activeFrom && assignment.activeFrom.getTime() > input.startAt.getTime()) ||
    (assignment.activeTo && assignment.activeTo.getTime() < input.endAt.getTime())
  ) {
    return {
      employeeName: formatEmployeeName(employee),
      skipReason: "employee_not_assigned",
    };
  }

  const overlappingShift = await db.shift.findFirst({
    where: {
      employeeId: input.employeeId,
      organizationId: context.property.organizationId,
      startAt: {
        lt: input.endAt,
      },
      endAt: {
        gt: input.startAt,
      },
      status: {
        not: "cancelled",
      },
    },
    select: {
      id: true,
    },
  });

  if (overlappingShift) {
    throw new HttpError(409, "This employee already has an overlapping shift.");
  }

  return {
    employeeName: formatEmployeeName(employee),
    skipReason: null,
  };
}

function buildPropertyScheduleTemplateShiftResponse(shift: {
  breakMinutes: number;
  dayIndex: number;
  employee: {
    employmentStatus: string;
    firstName: string;
    id: string;
    lastName: string;
  } | null;
  employeeId: string | null;
  endMinutes: number;
  id: string;
  isOvernight: boolean;
  notes: string | null;
  positionLabel: string | null;
  startMinutes: number;
  status: string;
}) {
  return {
    breakMinutes: shift.breakMinutes,
    dayIndex: shift.dayIndex,
    employee: shift.employee
      ? {
          employmentStatus: shift.employee.employmentStatus,
          id: shift.employee.id,
          name: formatEmployeeName(shift.employee),
        }
      : null,
    employeeId: shift.employeeId,
    employeeName: shift.employee ? formatEmployeeName(shift.employee) : null,
    endMinutes: shift.endMinutes,
    endTime: buildTimeValueFromMinutes(shift.endMinutes),
    id: shift.id,
    isOvernight: shift.isOvernight,
    notes: shift.notes,
    positionLabel: shift.positionLabel,
    startMinutes: shift.startMinutes,
    startTime: buildTimeValueFromMinutes(shift.startMinutes),
    status: normalizeShiftStatus(shift.status as SchedulingShiftStatus),
    timeLabel: buildTemplateTimeLabel(shift.startMinutes, shift.endMinutes, shift.isOvernight),
  } satisfies PropertyScheduleTemplateShift;
}

async function findScheduleTemplateRecord(
  db: SchedulingPrisma,
  context: PropertyRequestContext,
  templateId: string
): Promise<ScheduleTemplateRecordLike | null> {
  return db.scheduleTemplate.findFirst({
    where: {
      id: templateId,
      organizationId: context.property.organizationId,
      propertyId: context.property.id,
    },
    include: {
      shifts: {
        include: {
          employee: {
            select: {
              employmentStatus: true,
              firstName: true,
              id: true,
              lastName: true,
            },
          },
        },
        orderBy: [
          {
            dayIndex: "asc",
          },
          {
            startMinutes: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      },
    },
  });
}

async function buildPropertyScheduleTemplatesResponse(
  context: PropertyRequestContext,
  dependencies: SchedulingDependencies
): Promise<PropertyScheduleTemplatesResponse> {
  const templates = (await dependencies.prisma.scheduleTemplate.findMany({
    where: {
      organizationId: context.property.organizationId,
      propertyId: context.property.id,
    },
    include: {
      shifts: {
        include: {
          employee: {
            select: {
              employmentStatus: true,
              firstName: true,
              id: true,
              lastName: true,
            },
          },
        },
        orderBy: [
          {
            dayIndex: "asc",
          },
          {
            startMinutes: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      },
    },
    orderBy: {
      slotIndex: "asc",
    },
  })) as ScheduleTemplateRecordLike[];

  return {
    quickPresets: buildQuickPresetCatalog(),
    templates: templates.map((template: ScheduleTemplateRecordLike) => ({
      createdAt: template.createdAt.toISOString(),
      id: template.id,
      name: template.name,
      shiftCount: template.shifts.length,
      shifts: template.shifts.map((shift: ScheduleTemplateShiftRecordLike) => buildPropertyScheduleTemplateShiftResponse(shift)),
      slotIndex: template.slotIndex,
      updatedAt: template.updatedAt.toISOString(),
    })),
  };
}

async function loadWeekSourceTemplateShifts(
  context: PropertyRequestContext,
  dependencies: SchedulingDependencies,
  sourceWeekStartDate: string
): Promise<NormalizedScheduleTemplateShiftInput[]> {
  const schedule = await findScheduleRecord(dependencies.prisma, context.property.id, sourceWeekStartDate);

  if (!schedule) {
    return [];
  }

  const weekShifts = await dependencies.prisma.shift.findMany({
    where: {
      scheduleId: schedule.id,
    },
    orderBy: [
      {
        date: "asc",
      },
      {
        startAt: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
  });

  return weekShifts.map((shift) => {
    const shiftDate = formatDateOnly(shift.date);
    const dayIndex = Math.round((parseDateOnly(shiftDate).getTime() - parseDateOnly(sourceWeekStartDate).getTime()) / 86_400_000);
    const startTime = buildTimeKeyForTimezone(shift.startAt, context.property.timezone);
    const endTime = buildTimeKeyForTimezone(shift.endAt, context.property.timezone);
    const endDate = buildDateOnlyForTimezone(shift.endAt, context.property.timezone);

    return {
      breakMinutes: shift.breakMinutes,
      dayIndex,
      employeeId: shift.employeeId,
      endMinutes: readTimeParts(endTime).totalMinutes,
      id: shift.id,
      isOvernight: endDate !== shiftDate,
      notes: shift.notes,
      positionLabel: shift.positionLabel,
      startMinutes: readTimeParts(startTime).totalMinutes,
      status: normalizeShiftStatus(shift.status as SchedulingShiftStatus),
    };
  });
}

async function buildPropertyScheduleWeekResponse(
  context: PropertyRequestContext,
  weekStartDate: string,
  dependencies: SchedulingDependencies
): Promise<PropertyScheduleWeek> {
  const resolvedWeekEndDate = formatDateOnly(addDays(parseDateOnly(weekStartDate), 6));
  const schedule = await findScheduleRecord(dependencies.prisma, context.property.id, weekStartDate);
  const shifts = schedule
    ? await dependencies.prisma.shift.findMany({
        where: {
          scheduleId: schedule.id,
        },
        include: {
          employee: {
            select: {
              employmentStatus: true,
              firstName: true,
              id: true,
              lastName: true,
            },
          },
        },
        orderBy: [
          {
            date: "asc",
          },
          {
            startAt: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      })
    : [];

  return {
    days: Array.from({ length: 7 }, (_, index) => {
      const currentDate = addDays(parseDateOnly(weekStartDate), index);
      const date = formatDateOnly(currentDate);

      return {
        date,
        isToday: date === buildDateOnlyForTimezone(dependencies.now(), context.property.timezone),
        label: new Intl.DateTimeFormat("en-US", {
          timeZone: "UTC",
          month: "short",
          day: "numeric",
          weekday: "long",
        }).format(currentDate),
        shortLabel: new Intl.DateTimeFormat("en-US", {
          timeZone: "UTC",
          month: "short",
          day: "numeric",
          weekday: "short",
        }).format(currentDate),
      };
    }),
    organizationId: context.property.organizationId,
    property: {
      id: context.property.id,
      name: context.property.name,
      timezone: context.property.timezone,
    },
    publishedBy: {
      displayName: getPublishedByDisplayName(schedule?.publishedByUser ?? null),
      userId: schedule?.publishedByUserId ?? null,
    },
    publishedAt: schedule?.publishedAt?.toISOString() ?? null,
    quickPresets: buildQuickPresetCatalog(),
    scheduleId: schedule?.id ?? null,
    shifts: shifts.map((shift) => {
      const startTime = buildTimeKeyForTimezone(shift.startAt, context.property.timezone);
      const endTime = buildTimeKeyForTimezone(shift.endAt, context.property.timezone);
      const shiftDate = formatDateOnly(shift.date);
      const endDate = buildDateOnlyForTimezone(shift.endAt, context.property.timezone);

      return {
        breakMinutes: shift.breakMinutes,
        date: shiftDate,
        employee: shift.employee
          ? {
              employmentStatus: shift.employee.employmentStatus,
              id: shift.employee.id,
              name: formatEmployeeName(shift.employee),
            }
          : null,
        employeeId: shift.employeeId,
        employeeName: shift.employee ? formatEmployeeName(shift.employee) : null,
        endAt: shift.endAt.toISOString(),
        endTime,
        id: shift.id,
        isOvernight: endDate !== shiftDate,
        notes: shift.notes,
        positionLabel: shift.positionLabel,
        scheduleId: shift.scheduleId,
        startAt: shift.startAt.toISOString(),
        startTime,
        status: normalizeShiftStatus(shift.status as SchedulingShiftStatus),
        timeLabel: `${buildTimeLabelForTimezone(shift.startAt, context.property.timezone)} - ${buildTimeLabelForTimezone(
          shift.endAt,
          context.property.timezone
        )}`,
        updatedAt: shift.updatedAt.toISOString(),
      };
    }),
    status: schedule?.status === "published" ? "published" : "draft",
    weekEndDate: resolvedWeekEndDate,
    weekLabel: buildWeekLabel(weekStartDate, resolvedWeekEndDate),
    weekStartDate,
  };
}

export async function getPropertyScheduleWeek(
  context: PropertyRequestContext,
  requestedWeekStartDate?: string | null,
  overrides?: Partial<SchedulingDependencies>
) {
  assertScheduleReadAccess(context);

  const dependencies = {
    ...defaultDependencies,
    ...overrides,
  };
  const resolvedWeek = await resolveRequestedWeekStartDate(dependencies, context.property, requestedWeekStartDate);

  return buildPropertyScheduleWeekResponse(context, resolvedWeek.weekStartDate, dependencies);
}

export async function createPropertyShift(
  context: PropertyRequestContext,
  input: CreatePropertyShiftInput,
  overrides?: Partial<SchedulingDependencies>
) {
  assertScheduleWriteAccess(context);

  const dependencies = {
    ...defaultDependencies,
    ...overrides,
  };
  const rawEmployeeId = normalizeOptionalText(input.employeeId ?? null);
  const resolvedStatus = normalizeShiftStatus(input.status);
  const shiftWindow = resolveShiftWindow({
    date: input.date ?? "",
    endTime: input.endTime ?? "",
    startTime: input.startTime ?? "",
    timezone: context.property.timezone,
  });
  const shiftDurationMinutes = Math.round((shiftWindow.endAt.getTime() - shiftWindow.startAt.getTime()) / 60_000);
  const breakMinutes = normalizeBreakMinutes(input.breakMinutes, shiftDurationMinutes);
  const { requiresEmployeeValidation } = getShiftStatusForValidation(resolvedStatus, rawEmployeeId);
  const weekStartDate = (await resolveRequestedWeekStartDate(dependencies, context.property, shiftWindow.date)).weekStartDate;
  const normalizedNotes = normalizeOptionalText(input.notes);
  const preferredPositionLabel = normalizeOptionalText(input.positionLabel);

  await dependencies.prisma.$transaction(async (tx) => {
    const schedule = await ensureScheduleRecord(tx as SchedulingPrisma, context, weekStartDate);

    if (schedule.status === "published") {
      await markScheduleDraft(tx as SchedulingPrisma, schedule.id);
    }

    if (requiresEmployeeValidation && rawEmployeeId) {
      await validateEmployeeAssignment(tx as SchedulingPrisma, context, {
        employeeId: rawEmployeeId,
        endAt: shiftWindow.endAt,
        startAt: shiftWindow.startAt,
      });
    }

    const positionLabel = await resolvePositionLabel(
      tx as SchedulingPrisma,
      context,
      rawEmployeeId,
      shiftWindow.startAt,
      preferredPositionLabel
    );

    // Future warning aggregation, labor costing, and shift audit logging will attach at this mutation boundary.
    await (tx as SchedulingPrisma).shift.create({
      data: {
        breakMinutes,
        createdByUserId: context.localUser.id,
        date: parseDateOnly(shiftWindow.date),
        employeeId: rawEmployeeId,
        endAt: shiftWindow.endAt,
        notes: normalizedNotes,
        organizationId: context.property.organizationId,
        positionLabel,
        propertyId: context.property.id,
        scheduleId: schedule.id,
        startAt: shiftWindow.startAt,
        status: resolvedStatus,
        updatedByUserId: context.localUser.id,
      },
    });
  });

  return buildPropertyScheduleWeekResponse(context, weekStartDate, dependencies);
}

export async function updatePropertyShift(
  context: PropertyRequestContext,
  shiftIdInput: string,
  input: UpdatePropertyShiftInput,
  overrides?: Partial<SchedulingDependencies>
) {
  assertScheduleWriteAccess(context);

  const shiftId = normalizeOptionalText(shiftIdInput);

  if (!shiftId) {
    throw new HttpError(400, "shiftId is required.");
  }

  const dependencies = {
    ...defaultDependencies,
    ...overrides,
  };
  const existingShift = await dependencies.prisma.shift.findFirst({
    where: {
      id: shiftId,
      organizationId: context.property.organizationId,
      propertyId: context.property.id,
    },
    include: {
      schedule: {
        select: {
          id: true,
          status: true,
          weekStartDate: true,
        },
      },
    },
  });

  if (!existingShift || !existingShift.schedule) {
    throw new HttpError(404, "Shift not found for this property.");
  }

  const nextEmployeeId = input.employeeId === undefined ? existingShift.employeeId : normalizeOptionalText(input.employeeId ?? null);
  const nextStatus = input.status === undefined ? normalizeShiftStatus(existingShift.status as SchedulingShiftStatus) : normalizeShiftStatus(input.status);
  const existingDate = formatDateOnly(existingShift.date);
  const existingStartTime = buildTimeKeyForTimezone(existingShift.startAt, context.property.timezone);
  const existingEndTime = buildTimeKeyForTimezone(existingShift.endAt, context.property.timezone);
  const shiftWindow = resolveShiftWindow({
    date: input.date ?? existingDate,
    endTime: input.endTime ?? existingEndTime,
    startTime: input.startTime ?? existingStartTime,
    timezone: context.property.timezone,
  });
  const shiftDurationMinutes = Math.round((shiftWindow.endAt.getTime() - shiftWindow.startAt.getTime()) / 60_000);
  const breakMinutes = normalizeBreakMinutes(input.breakMinutes ?? existingShift.breakMinutes, shiftDurationMinutes);
  const { requiresEmployeeValidation } = getShiftStatusForValidation(nextStatus, nextEmployeeId);
  const targetWeekStartDate = (await resolveRequestedWeekStartDate(dependencies, context.property, shiftWindow.date)).weekStartDate;
  const normalizedNotes = input.notes === undefined ? existingShift.notes : normalizeOptionalText(input.notes);
  const preferredPositionLabel =
    input.positionLabel !== undefined
      ? normalizeOptionalText(input.positionLabel)
      : nextEmployeeId !== existingShift.employeeId
        ? null
        : existingShift.positionLabel;

  await dependencies.prisma.$transaction(async (tx) => {
    if (existingShift.schedule.status === "published") {
      await markScheduleDraft(tx as SchedulingPrisma, existingShift.schedule.id);
    }

    const targetSchedule = await ensureScheduleRecord(tx as SchedulingPrisma, context, targetWeekStartDate);

    if (targetSchedule.id !== existingShift.schedule.id && targetSchedule.status === "published") {
      await markScheduleDraft(tx as SchedulingPrisma, targetSchedule.id);
    }

    if (requiresEmployeeValidation && nextEmployeeId) {
      await validateEmployeeAssignment(tx as SchedulingPrisma, context, {
        employeeId: nextEmployeeId,
        endAt: shiftWindow.endAt,
        excludeShiftId: existingShift.id,
        startAt: shiftWindow.startAt,
      });
    }

    const positionLabel = await resolvePositionLabel(
      tx as SchedulingPrisma,
      context,
      nextEmployeeId,
      shiftWindow.startAt,
      preferredPositionLabel
    );

    // Future warning aggregation, labor costing, and shift audit logging will attach at this mutation boundary.
    await (tx as SchedulingPrisma).shift.update({
      where: {
        id: existingShift.id,
      },
      data: {
        breakMinutes,
        date: parseDateOnly(shiftWindow.date),
        employeeId: nextEmployeeId,
        endAt: shiftWindow.endAt,
        notes: normalizedNotes,
        positionLabel,
        scheduleId: targetSchedule.id,
        startAt: shiftWindow.startAt,
        status: nextStatus,
        updatedByUserId: context.localUser.id,
      },
    });
  });

  return buildPropertyScheduleWeekResponse(context, targetWeekStartDate, dependencies);
}

export async function deletePropertyShift(
  context: PropertyRequestContext,
  shiftIdInput: string,
  overrides?: Partial<SchedulingDependencies>
) {
  assertScheduleWriteAccess(context);

  const shiftId = normalizeOptionalText(shiftIdInput);

  if (!shiftId) {
    throw new HttpError(400, "shiftId is required.");
  }

  const dependencies = {
    ...defaultDependencies,
    ...overrides,
  };
  const existingShift = await dependencies.prisma.shift.findFirst({
    where: {
      id: shiftId,
      organizationId: context.property.organizationId,
      propertyId: context.property.id,
    },
    include: {
      schedule: {
        select: {
          id: true,
          status: true,
          weekStartDate: true,
        },
      },
    },
  });

  if (!existingShift || !existingShift.schedule) {
    throw new HttpError(404, "Shift not found for this property.");
  }

  const sourceWeekStartDate = formatDateOnly(existingShift.schedule.weekStartDate);

  await dependencies.prisma.$transaction(async (tx) => {
    if (existingShift.schedule.status === "published") {
      await markScheduleDraft(tx as SchedulingPrisma, existingShift.schedule.id);
    }

    // Future warning aggregation, labor costing, and shift audit logging will attach at this mutation boundary.
    await (tx as SchedulingPrisma).shift.delete({
      where: {
        id: existingShift.id,
      },
    });
  });

  return buildPropertyScheduleWeekResponse(context, sourceWeekStartDate, dependencies);
}

export async function publishPropertySchedule(
  context: PropertyRequestContext,
  requestedWeekStartDate?: string | null,
  overrides?: Partial<SchedulingDependencies>
) {
  assertScheduleWriteAccess(context);

  const dependencies = {
    ...defaultDependencies,
    ...overrides,
  };
  const resolvedWeek = await resolveRequestedWeekStartDate(dependencies, context.property, requestedWeekStartDate);
  const publishedAt = dependencies.now();

  await dependencies.prisma.$transaction(async (tx) => {
    const schedule = await ensureScheduleRecord(tx as SchedulingPrisma, context, resolvedWeek.weekStartDate);

    // Future publish-time warning aggregation, labor costing, and audit logging can extend this atomic update.
    await (tx as SchedulingPrisma).schedule.update({
      where: {
        id: schedule.id,
      },
      data: {
        publishedAt,
        publishedByUserId: context.localUser.id,
        status: "published",
      },
    });
  });

  return buildPropertyScheduleWeekResponse(context, resolvedWeek.weekStartDate, dependencies);
}

export async function listPropertyScheduleTemplates(
  context: PropertyRequestContext,
  overrides?: Partial<SchedulingDependencies>
) {
  assertScheduleReadAccess(context);

  const dependencies = {
    ...defaultDependencies,
    ...overrides,
  };

  return buildPropertyScheduleTemplatesResponse(context, dependencies);
}

export async function createPropertyScheduleTemplate(
  context: PropertyRequestContext,
  input: CreatePropertyScheduleTemplateInput,
  overrides?: Partial<SchedulingDependencies>
) {
  assertScheduleWriteAccess(context);

  const dependencies = {
    ...defaultDependencies,
    ...overrides,
  };
  const slotIndex = normalizeTemplateSlotIndex(input.slotIndex);
  const existingTemplate = await dependencies.prisma.scheduleTemplate.findUnique({
    where: {
      propertyId_slotIndex: {
        propertyId: context.property.id,
        slotIndex,
      },
    },
    select: {
      id: true,
    },
  });

  if (existingTemplate) {
    throw new HttpError(409, "A template already exists in that slot.");
  }

  const sourceWeekStartDate = input.sourceWeekStartDate
    ? (await resolveRequestedWeekStartDate(dependencies, context.property, input.sourceWeekStartDate)).weekStartDate
    : null;
  const normalizedShifts = sourceWeekStartDate
    ? await loadWeekSourceTemplateShifts(context, dependencies, sourceWeekStartDate)
    : [];
  await validateScheduleTemplateShiftCollection(context, dependencies, normalizedShifts);

  await dependencies.prisma.scheduleTemplate.create({
    data: {
      createdByUserId: context.localUser.id,
      name: normalizeTemplateName(input.name, slotIndex),
      organizationId: context.property.organizationId,
      propertyId: context.property.id,
      shifts: normalizedShifts.length
        ? {
            create: normalizedShifts.map((shift) => ({
              breakMinutes: shift.breakMinutes,
              dayIndex: shift.dayIndex,
              employeeId: shift.employeeId,
              endMinutes: shift.endMinutes,
              isOvernight: shift.isOvernight,
              notes: shift.notes,
              organizationId: context.property.organizationId,
              positionLabel: shift.positionLabel,
              propertyId: context.property.id,
              startMinutes: shift.startMinutes,
              status: shift.status,
            })),
          }
        : undefined,
      slotIndex,
      updatedByUserId: context.localUser.id,
    },
  });

  return buildPropertyScheduleTemplatesResponse(context, dependencies);
}

export async function updatePropertyScheduleTemplate(
  context: PropertyRequestContext,
  templateIdInput: string,
  input: UpdatePropertyScheduleTemplateInput,
  overrides?: Partial<SchedulingDependencies>
) {
  assertScheduleWriteAccess(context);

  const templateId = normalizeOptionalText(templateIdInput);

  if (!templateId) {
    throw new HttpError(400, "templateId is required.");
  }

  const dependencies = {
    ...defaultDependencies,
    ...overrides,
  };
  const existingTemplate = await findScheduleTemplateRecord(dependencies.prisma, context, templateId);

  if (!existingTemplate) {
    throw new HttpError(404, "Template not found for this property.");
  }

  if (input.sourceWeekStartDate && input.shifts) {
    throw new HttpError(400, "Provide either sourceWeekStartDate or shifts when updating a template.");
  }

  if (input.name === undefined && input.sourceWeekStartDate === undefined && input.shifts === undefined) {
    throw new HttpError(400, "Provide a template name, sourceWeekStartDate, or shifts to update.");
  }

  const sourceWeekStartDate = input.sourceWeekStartDate
    ? (await resolveRequestedWeekStartDate(dependencies, context.property, input.sourceWeekStartDate)).weekStartDate
    : null;
  const normalizedShifts =
    sourceWeekStartDate !== null
      ? await loadWeekSourceTemplateShifts(context, dependencies, sourceWeekStartDate)
      : input.shifts !== undefined
        ? (input.shifts ?? []).map((shift, index) => normalizeScheduleTemplateShiftInput(shift, index))
        : null;

  if (normalizedShifts !== null) {
    await validateScheduleTemplateShiftCollection(context, dependencies, normalizedShifts);
  }

  await dependencies.prisma.$transaction(async (tx) => {
    await (tx as SchedulingPrisma).scheduleTemplate.update({
      where: {
        id: existingTemplate.id,
      },
      data: {
        name:
          input.name === undefined
            ? existingTemplate.name
            : normalizeTemplateName(input.name, existingTemplate.slotIndex),
        updatedByUserId: context.localUser.id,
      },
    });

    if (normalizedShifts !== null) {
      await (tx as SchedulingPrisma).scheduleTemplateShift.deleteMany({
        where: {
          templateId: existingTemplate.id,
        },
      });

      if (normalizedShifts.length > 0) {
        await (tx as SchedulingPrisma).scheduleTemplateShift.createMany({
          data: normalizedShifts.map((shift) => ({
            breakMinutes: shift.breakMinutes,
            dayIndex: shift.dayIndex,
            employeeId: shift.employeeId,
            endMinutes: shift.endMinutes,
            isOvernight: shift.isOvernight,
            notes: shift.notes,
            organizationId: context.property.organizationId,
            positionLabel: shift.positionLabel,
            propertyId: context.property.id,
            startMinutes: shift.startMinutes,
            status: shift.status,
            templateId: existingTemplate.id,
          })),
        });
      }
    }
  });

  return buildPropertyScheduleTemplatesResponse(context, dependencies);
}

export async function deletePropertyScheduleTemplate(
  context: PropertyRequestContext,
  templateIdInput: string,
  overrides?: Partial<SchedulingDependencies>
) {
  assertScheduleWriteAccess(context);

  const templateId = normalizeOptionalText(templateIdInput);

  if (!templateId) {
    throw new HttpError(400, "templateId is required.");
  }

  const dependencies = {
    ...defaultDependencies,
    ...overrides,
  };
  const existingTemplate = await findScheduleTemplateRecord(dependencies.prisma, context, templateId);

  if (!existingTemplate) {
    throw new HttpError(404, "Template not found for this property.");
  }

  await dependencies.prisma.scheduleTemplate.delete({
    where: {
      id: existingTemplate.id,
    },
  });

  return buildPropertyScheduleTemplatesResponse(context, dependencies);
}

export async function applyPropertyScheduleTemplate(
  context: PropertyRequestContext,
  templateIdInput: string,
  requestedWeekStartDate?: string | null,
  overrides?: Partial<SchedulingDependencies>
): Promise<ApplyPropertyScheduleTemplateResult> {
  assertScheduleWriteAccess(context);

  const templateId = normalizeOptionalText(templateIdInput);

  if (!templateId) {
    throw new HttpError(400, "templateId is required.");
  }

  const dependencies = {
    ...defaultDependencies,
    ...overrides,
  };
  const existingTemplate = await findScheduleTemplateRecord(dependencies.prisma, context, templateId);

  if (!existingTemplate) {
    throw new HttpError(404, "Template not found for this property.");
  }

  const resolvedWeek = await resolveRequestedWeekStartDate(dependencies, context.property, requestedWeekStartDate);
  const summary: ApplyPropertyScheduleTemplateResult["summary"] = {
    appliedShiftCount: 0,
    skippedItems: [],
    skippedShiftCount: 0,
  };

  await dependencies.prisma.$transaction(async (tx) => {
    const schedule = await ensureScheduleRecord(tx as SchedulingPrisma, context, resolvedWeek.weekStartDate);

    if (schedule.status === "published") {
      await markScheduleDraft(tx as SchedulingPrisma, schedule.id);
    }

    await (tx as SchedulingPrisma).shift.deleteMany({
      where: {
        scheduleId: schedule.id,
      },
    });

    for (const templateShift of existingTemplate.shifts) {
      const shiftWindow = buildTemplateShiftWindowForWeek(resolvedWeek.weekStartDate, context.property.timezone, {
        dayIndex: templateShift.dayIndex,
        endMinutes: templateShift.endMinutes,
        isOvernight: templateShift.isOvernight,
        startMinutes: templateShift.startMinutes,
      });

      if (templateShift.employeeId) {
      const employeeOutcome = await resolveTemplateApplyEmployeeOutcome(tx as SchedulingPrisma, context, {
          employeeId: templateShift.employeeId,
          endAt: shiftWindow.endAt,
          startAt: shiftWindow.startAt,
        });

        if (employeeOutcome.skipReason) {
          summary.skippedItems.push({
            dayIndex: templateShift.dayIndex,
            employeeId: templateShift.employeeId,
            employeeName: employeeOutcome.employeeName,
            endTime: buildTimeValueFromMinutes(templateShift.endMinutes),
            positionLabel: templateShift.positionLabel,
            reason: employeeOutcome.skipReason,
            startTime: buildTimeValueFromMinutes(templateShift.startMinutes),
            templateShiftId: templateShift.id,
          });
          summary.skippedShiftCount += 1;
          continue;
        }
      }

      const positionLabel = await resolvePositionLabel(
        tx as SchedulingPrisma,
        context,
        templateShift.employeeId,
        shiftWindow.startAt,
        normalizeOptionalText(templateShift.positionLabel)
      );

      // Future warning aggregation, labor costing, and shift audit logging will attach at this template-apply boundary.
      await (tx as SchedulingPrisma).shift.create({
        data: {
          breakMinutes: templateShift.breakMinutes,
          createdByUserId: context.localUser.id,
          date: parseDateOnly(shiftWindow.date),
          employeeId: templateShift.employeeId,
          endAt: shiftWindow.endAt,
          notes: templateShift.notes,
          organizationId: context.property.organizationId,
          positionLabel,
          propertyId: context.property.id,
          scheduleId: schedule.id,
          startAt: shiftWindow.startAt,
          status: normalizeShiftStatus(templateShift.status as SchedulingShiftStatus),
          updatedByUserId: context.localUser.id,
        },
      });

      summary.appliedShiftCount += 1;
    }
  });

  return {
    summary,
    week: await buildPropertyScheduleWeekResponse(context, resolvedWeek.weekStartDate, dependencies),
  };
}

export async function getOrganizationSchedulingSummary(
  input: {
    organizationId: string;
    userId: string;
  },
  overrides?: Partial<SchedulingDependencies>
): Promise<OrganizationSchedulingSummary> {
  const dependencies = {
    ...defaultDependencies,
    ...overrides,
  };
  const membership = await dependencies.prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: input.organizationId,
        userId: input.userId,
      },
    },
    include: {
      role: {
        include: {
          permissions: true,
        },
      },
    },
  });

  if (!membership || membership.status !== "active") {
    throw new HttpError(403, "You do not have access to that organization.");
  }

  const permissionKeys = membership.role.permissions.map((permission) => permission.key);

  if (!permissionKeys.includes(PERMISSIONS.SCHEDULE_READ)) {
    throw new HttpError(403, "You do not have permission to view scheduling for this organization.");
  }

  const canBypassPropertyScope = hasPropertyScopeBypassPermission(permissionKeys);
  const properties = await dependencies.prisma.property.findMany({
    where: {
      organizationId: input.organizationId,
      ...(canBypassPropertyScope
        ? {}
        : {
            userRoles: {
              some: {
                userId: input.userId,
              },
            },
          }),
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      timezone: true,
      payrollSettings: {
        where: {
          effectiveFrom: {
            lte: dependencies.now(),
          },
          OR: [
            {
              effectiveTo: null,
            },
            {
              effectiveTo: {
                gte: dependencies.now(),
              },
            },
          ],
        },
        orderBy: {
          effectiveFrom: "desc",
        },
        take: 1,
        select: {
          payrollCalendar: {
            select: {
              weekStartsOn: true,
            },
          },
        },
      },
    },
  });

  const weekPairs = properties.map((property) => {
    const referenceDate = buildDateOnlyForTimezone(dependencies.now(), property.timezone);
    const weekStartsOn = normalizeWeekStartsOn(property.payrollSettings[0]?.payrollCalendar.weekStartsOn);
    const weekStartDate = resolveWeekStartDate(referenceDate, weekStartsOn);

    return {
      propertyId: property.id,
      propertyName: property.name,
      timezone: property.timezone,
      weekEndDate: formatDateOnly(addDays(parseDateOnly(weekStartDate), 6)),
      weekStartDate,
    };
  });

  const schedules = weekPairs.length
    ? await dependencies.prisma.schedule.findMany({
        where: {
          organizationId: input.organizationId,
          OR: weekPairs.map((pair) => ({
            propertyId: pair.propertyId,
            weekStartDate: parseDateOnly(pair.weekStartDate),
          })),
        },
        select: {
          _count: {
            select: {
              shifts: true,
            },
          },
          propertyId: true,
          publishedAt: true,
          status: true,
          weekStartDate: true,
        },
      })
    : [];

  const schedulesByKey = schedules.reduce<Map<string, (typeof schedules)[number]>>((accumulator, schedule) => {
    accumulator.set(`${schedule.propertyId}:${formatDateOnly(schedule.weekStartDate)}`, schedule);
    return accumulator;
  }, new Map<string, (typeof schedules)[number]>());

  const propertyRows = weekPairs.map((pair) => {
    const schedule = schedulesByKey.get(`${pair.propertyId}:${pair.weekStartDate}`) ?? null;
    const status: OrganizationSchedulingPropertyStatus =
      schedule?.status === "published" ? "published" : schedule ? "draft" : "not_started";

    return {
      propertyId: pair.propertyId,
      propertyName: pair.propertyName,
      publishedAt: schedule?.publishedAt?.toISOString() ?? null,
      scheduledShiftCount: schedule?._count.shifts ?? 0,
      status,
      timezone: pair.timezone,
      weekEndDate: pair.weekEndDate,
      weekStartDate: pair.weekStartDate,
    };
  });

  const summary = propertyRows.reduce(
    (accumulator, row) => {
      accumulator.propertyCount += 1;
      accumulator.scheduledShiftCount += row.scheduledShiftCount;

      if (row.status === "published") {
        accumulator.publishedProperties += 1;
      } else {
        accumulator.unpublishedProperties += 1;
      }

      if (row.status === "draft") {
        accumulator.draftProperties += 1;
      }

      if (row.status === "not_started") {
        accumulator.notStartedProperties += 1;
      }

      return accumulator;
    },
    {
      draftProperties: 0,
      notStartedProperties: 0,
      propertyCount: 0,
      publishedProperties: 0,
      scheduledShiftCount: 0,
      unpublishedProperties: 0,
    }
  );

  return {
    generatedAt: dependencies.now().toISOString(),
    organizationId: input.organizationId,
    properties: propertyRows,
    summary,
  };
}

export type DeviceSchedulingProperty = {
  id: string;
  organizationId: string;
  name: string;
  timezone: string;
};

export async function getPropertyScheduleWeekForDevice(
  property: DeviceSchedulingProperty,
  requestedWeekStartDate?: string | null,
  overrides?: Partial<SchedulingDependencies>
): Promise<PropertyScheduleWeek> {
  const dependencies = {
    ...defaultDependencies,
    ...overrides,
  };
  const resolvedWeek = await resolveRequestedWeekStartDate(dependencies, property, requestedWeekStartDate);
  const syntheticContext = {
    property: {
      id: property.id,
      organizationId: property.organizationId,
      name: property.name,
      timezone: property.timezone,
    },
  } as PropertyRequestContext;

  return buildPropertyScheduleWeekResponse(syntheticContext, resolvedWeek.weekStartDate, dependencies);
}

export const propertySchedulingInternals = {
  buildDateOnlyForTimezone,
  buildLocalDateTimeInTimezone,
  buildTimeKeyForTimezone,
  normalizeWeekStartsOn,
  resolveWeekStartDate,
};
