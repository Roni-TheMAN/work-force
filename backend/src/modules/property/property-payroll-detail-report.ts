import { HttpError } from "../../lib/http-error";
import { Prisma } from "../../../generated/prisma-rbac";

const DEFAULT_OVERTIME_THRESHOLD_MINUTES = 40 * 60;

const finalizedPayrollRunExportArgs = Prisma.validator<Prisma.PayrollRunDefaultArgs>()({
  include: {
    property: {
      select: {
        name: true,
        timezone: true,
      },
    },
    finalizedByUser: {
      select: {
        id: true,
        fullName: true,
        email: true,
      },
    },
    employeeSummaries: {
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        approvedByUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    },
    shiftSnapshots: {
      orderBy: [{ employeeName: "asc" }, { businessDate: "asc" }, { startedAt: "asc" }],
    },
    payrollPeriod: {
      select: {
        periodStartDate: true,
        periodEndDate: true,
        payrollCalendar: {
          select: {
            anchorStartDate: true,
            frequency: true,
          },
        },
      },
    },
  },
});

export type FinalizedPayrollRunForExport = Prisma.PayrollRunGetPayload<typeof finalizedPayrollRunExportArgs>;

type ExportLoaderClient = {
  payrollRun: {
    findFirst(args: Prisma.PayrollRunFindFirstArgs): Promise<unknown>;
  };
};

type ReportRowBase = {
  dailyOtHours: string;
  dailyRegHours: string;
  departmentLabel: string;
  inOutHours: string;
  punchInfo: string;
  weeklyTotalHours: string;
};

type ShiftReportRow = ReportRowBase & {
  actualInDisplay: string;
  actualOutDisplay: string;
  businessDateLabel: string;
  editedInDisplay: string;
  editedOutDisplay: string;
  kind: "shift";
};

type TotalReportRow = ReportRowBase & {
  actualInDisplay: "";
  actualOutDisplay: "";
  businessDateLabel: string;
  editedInDisplay: "";
  editedOutDisplay: "";
  kind: "period_total" | "weekly_total";
};

type UserDisplay = {
  email: string | null;
  fullName: string | null;
  id: string;
};

export type PropertyPayrollDetailPdfReport = {
  coverSummary: {
    employeeCount: number;
    estimatedGrossLabel: string;
    overtimeHoursLabel: string;
    propertyName: string;
    regularHoursLabel: string;
    versionLabel: string;
  };
  employees: Array<{
    approvalStatusLabel: string;
    approvedAtLabel: string | null;
    approvedByLabel: string | null;
    employeeGroupLabel: string | null;
    employeeId: string;
    name: string;
    payClassLabel: string;
    payPeriodFromLabel: string;
    payPeriodToLabel: string;
    paySummaryRows: Array<{
      amountLabel: string;
      appliedAs: "OT" | "REG";
      hourlyRateLabel: string;
      hoursLabel: string;
      payType: "OT15" | "OT2" | "REG";
      rateModifierLabel: string;
    }>;
    paySummaryTotals: {
      amountLabel: string;
      hoursLabel: string;
    };
    rows: Array<ShiftReportRow | TotalReportRow>;
  }>;
  generatedAtLabel: string;
  legend: Array<{
    code: string;
    description: string;
  }>;
  payClassLabel: string;
  payPeriodLabel: string;
  propertyName: string;
  reportTitle: "DETAIL PAYROLL REPORT";
  versionLabel: string;
};

type ShiftFallbackAllocation = {
  overtimeMinutes: number;
  regularMinutes: number;
  weekEndDate: string;
  weekStartDate: string;
};

type RateSnapshotRecord = Record<string, unknown>;

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

function formatHoursFromMinutes(minutes: number | null | undefined): string {
  const safeMinutes = Math.max(0, minutes ?? 0);
  return (safeMinutes / 60).toFixed(2);
}

function formatRateFromCents(cents: number | null): string {
  if (cents === null) {
    return "";
  }

  return (cents / 100).toFixed(2);
}

function formatCurrencyFromCents(cents: bigint | null | number | undefined): string {
  if (cents === null || cents === undefined) {
    return "$0.00";
  }

  const asNumber = typeof cents === "bigint" ? Number(cents) : cents;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(asNumber / 100);
}

function formatDateForPeriodBoundary(value: Date, endOfDay = false): string {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "numeric",
    day: "numeric",
    year: "numeric",
  }).format(value);

  return `${label} ${endOfDay ? "11:59 PM" : "12:00 AM"}`;
}

function formatDateTimeInTimezone(value: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function formatBusinessDateLabel(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "numeric",
    day: "numeric",
    year: "numeric",
  }).format(value);
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

function formatTimeCell(timestamp: Date | null, timezone: string, compareTo: Date | null = null): string {
  if (!timestamp) {
    return "";
  }

  const timeLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(timestamp);

  if (!compareTo) {
    return timeLabel;
  }

  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  if (dateFormatter.format(timestamp) === dateFormatter.format(compareTo)) {
    return timeLabel;
  }

  const dayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(timestamp);

  return `(${dayLabel})\n${timeLabel}`;
}

function titleCaseStatus(value: string): string {
  return value
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function resolveUserDisplayLabel(user: UserDisplay | null | undefined): string | null {
  if (!user) {
    return null;
  }

  return normalizeOptionalText(user.fullName) ?? normalizeOptionalText(user.email) ?? user.id;
}

function resolveFrequencyLabel(value: string): string {
  switch (value) {
    case "biweekly":
      return "BIWK";
    case "custom":
    case "custom_days":
      return "CUSTOM";
    case "monthly":
      return "MONTH";
    case "quarterly":
      return "QTR";
    case "semimonthly":
      return "SEMI";
    case "weekly":
    default:
      return "WKLY";
  }
}

function readRateSnapshot(summary: FinalizedPayrollRunForExport["employeeSummaries"][number]): RateSnapshotRecord {
  if (!summary.rateSnapshot || typeof summary.rateSnapshot !== "object" || Array.isArray(summary.rateSnapshot)) {
    return {};
  }

  return summary.rateSnapshot as RateSnapshotRecord;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? normalizeOptionalText(value) : null;
}

function buildFallbackAllocations(
  snapshots: FinalizedPayrollRunForExport["shiftSnapshots"],
  anchorDateOnly: string,
  thresholdMinutes: number
): Map<string, ShiftFallbackAllocation> {
  const employeeWeekMinutes = new Map<string, number>();
  const allocations = new Map<string, ShiftFallbackAllocation>();

  for (const snapshot of [...snapshots].sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime())) {
    const businessDate = formatDateOnly(snapshot.businessDate);
    const weekWindow =
      snapshot.weekStartDate && snapshot.weekEndDate
        ? {
            weekStartDate: formatDateOnly(snapshot.weekStartDate),
            weekEndDate: formatDateOnly(snapshot.weekEndDate),
          }
        : resolveWeekWindowForBusinessDate(anchorDateOnly, businessDate);
    const employeeWeekKey = `${snapshot.employeeId}:${weekWindow.weekStartDate}`;
    const consumedWeekMinutes = employeeWeekMinutes.get(employeeWeekKey) ?? 0;
    const remainingRegularMinutes = Math.max(0, thresholdMinutes - consumedWeekMinutes);
    const regularMinutes = Math.min(snapshot.payableMinutes, remainingRegularMinutes);
    const overtimeMinutes = Math.max(0, snapshot.payableMinutes - regularMinutes);

    employeeWeekMinutes.set(employeeWeekKey, consumedWeekMinutes + snapshot.payableMinutes);
    allocations.set(snapshot.shiftSessionId, {
      regularMinutes,
      overtimeMinutes,
      weekStartDate: weekWindow.weekStartDate,
      weekEndDate: weekWindow.weekEndDate,
    });
  }

  return allocations;
}

function buildLegacyPunchInfo(snapshot: FinalizedPayrollRunForExport["shiftSnapshots"][number]): string {
  const parts: string[] = [];

  if (snapshot.isManual) {
    parts.push("Manual");
  }

  if (snapshot.isEdited) {
    parts.push("Edited");
  }

  if (snapshot.isAutoClosed) {
    parts.push("Auto-closed");
  }

  return parts.join(", ");
}

export async function loadFinalizedPayrollRunForExport(
  client: ExportLoaderClient,
  propertyId: string,
  runId: string
): Promise<FinalizedPayrollRunForExport> {
  const run = (await client.payrollRun.findFirst({
    where: {
      id: runId,
      propertyId,
      status: "finalized",
    },
    include: finalizedPayrollRunExportArgs.include,
  })) as FinalizedPayrollRunForExport | null;

  if (!run) {
    throw new HttpError(404, "Finalized payroll run not found.");
  }

  return run;
}

export function assemblePropertyPayrollDetailReport(
  run: FinalizedPayrollRunForExport,
  generatedAt = new Date()
): PropertyPayrollDetailPdfReport {
  const propertyTimezone = run.property.timezone;
  const anchorDateOnly = formatDateOnly(run.payrollPeriod.payrollCalendar.anchorStartDate);
  const payClassLabel = resolveFrequencyLabel(run.payrollPeriod.payrollCalendar.frequency);
  const payPeriodLabel = `${new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(run.payrollPeriod.periodStartDate)} - ${new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(run.payrollPeriod.periodEndDate)}`;
  const snapshotsByEmployee = new Map<
    string,
    Array<FinalizedPayrollRunForExport["shiftSnapshots"][number]>
  >();

  for (const snapshot of run.shiftSnapshots) {
    const bucket = snapshotsByEmployee.get(snapshot.employeeId) ?? [];
    bucket.push(snapshot);
    snapshotsByEmployee.set(snapshot.employeeId, bucket);
  }

  const employees = [...run.employeeSummaries]
    .sort((left, right) =>
      `${left.employee.lastName ?? ""} ${left.employee.firstName ?? ""}`.localeCompare(
        `${right.employee.lastName ?? ""} ${right.employee.firstName ?? ""}`
      )
    )
    .map((summary) => {
      const rateSnapshot = readRateSnapshot(summary);
      const snapshots = (snapshotsByEmployee.get(summary.employeeId) ?? []).sort(
        (left, right) => left.startedAt.getTime() - right.startedAt.getTime()
      );
      const overtimeThresholdMinutes =
        readNumber(rateSnapshot.ot1WeeklyAfterMinutes) ?? DEFAULT_OVERTIME_THRESHOLD_MINUTES;
      const fallbackAllocations = buildFallbackAllocations(snapshots, anchorDateOnly, overtimeThresholdMinutes);
      const rows: Array<ShiftReportRow | TotalReportRow> = [];
      let activeWeekStartDate: string | null = null;
      let weekPayableMinutes = 0;
      let weekRegularMinutes = 0;
      let weekOvertimeMinutes = 0;
      let weekRunningMinutes = 0;

      const flushWeeklyTotals = () => {
        if (!activeWeekStartDate) {
          return;
        }

        rows.push({
          kind: "weekly_total",
          businessDateLabel: "Pay Period Weekly Totals",
          actualInDisplay: "",
          actualOutDisplay: "",
          editedInDisplay: "",
          editedOutDisplay: "",
          departmentLabel: "",
          inOutHours: formatHoursFromMinutes(weekPayableMinutes),
          dailyRegHours: formatHoursFromMinutes(weekRegularMinutes),
          dailyOtHours: formatHoursFromMinutes(weekOvertimeMinutes),
          weeklyTotalHours: "",
          punchInfo: "",
        });
      };

      for (const snapshot of snapshots) {
        const fallback = fallbackAllocations.get(snapshot.shiftSessionId);
        const weekStartDate = snapshot.weekStartDate
          ? formatDateOnly(snapshot.weekStartDate)
          : fallback?.weekStartDate ?? resolveWeekWindowForBusinessDate(anchorDateOnly, formatDateOnly(snapshot.businessDate)).weekStartDate;

        if (activeWeekStartDate !== null && activeWeekStartDate !== weekStartDate) {
          flushWeeklyTotals();
          weekPayableMinutes = 0;
          weekRegularMinutes = 0;
          weekOvertimeMinutes = 0;
          weekRunningMinutes = 0;
        }

        activeWeekStartDate = weekStartDate;

        const regularMinutes = snapshot.regularMinutes ?? fallback?.regularMinutes ?? snapshot.payableMinutes;
        const snapshotOvertimeMinutes = (snapshot.overtime1Minutes ?? 0) + (snapshot.overtime2Minutes ?? 0);
        const overtimeMinutes = snapshotOvertimeMinutes > 0 ? snapshotOvertimeMinutes : fallback?.overtimeMinutes ?? 0;
        const actualStartedAt = snapshot.actualStartedAt ?? snapshot.startedAt;
        const actualEndedAt = snapshot.actualEndedAt ?? snapshot.endedAt;
        const departmentLabel =
          normalizeOptionalText(snapshot.departmentLabel) ??
          readString(rateSnapshot.title) ??
          null;

        weekPayableMinutes += snapshot.payableMinutes;
        weekRegularMinutes += regularMinutes;
        weekOvertimeMinutes += overtimeMinutes;
        weekRunningMinutes += snapshot.payableMinutes;

        rows.push({
          kind: "shift",
          businessDateLabel: formatBusinessDateLabel(snapshot.businessDate),
          actualInDisplay: formatTimeCell(actualStartedAt, propertyTimezone),
          actualOutDisplay: formatTimeCell(actualEndedAt, propertyTimezone, actualStartedAt),
          editedInDisplay: formatTimeCell(snapshot.startedAt, propertyTimezone),
          editedOutDisplay: formatTimeCell(snapshot.endedAt, propertyTimezone, snapshot.startedAt),
          departmentLabel: departmentLabel ?? "",
          inOutHours: formatHoursFromMinutes(snapshot.payableMinutes),
          dailyRegHours: formatHoursFromMinutes(regularMinutes),
          dailyOtHours: formatHoursFromMinutes(overtimeMinutes),
          weeklyTotalHours: formatHoursFromMinutes(weekRunningMinutes),
          punchInfo: normalizeOptionalText(snapshot.punchInfo) ?? buildLegacyPunchInfo(snapshot),
        });
      }

      flushWeeklyTotals();

      rows.push({
        kind: "period_total",
        businessDateLabel: "Pay Period Totals",
        actualInDisplay: "",
        actualOutDisplay: "",
        editedInDisplay: "",
        editedOutDisplay: "",
        departmentLabel: "",
        inOutHours: formatHoursFromMinutes(summary.payableMinutes),
        dailyRegHours: formatHoursFromMinutes(summary.regularMinutes),
        dailyOtHours: formatHoursFromMinutes(summary.overtime1Minutes + summary.overtime2Minutes),
        weeklyTotalHours: "",
        punchInfo: "",
      });

      const resolvedHourlyRateCents = readNumber(rateSnapshot.resolvedHourlyRateCents);
      const ot1Multiplier = readNumber(rateSnapshot.ot1Multiplier) ?? 1.5;
      const ot2Multiplier = readNumber(rateSnapshot.ot2Multiplier) ?? 2;
      const hourlyRateLabel = formatRateFromCents(resolvedHourlyRateCents);
      const paySummaryRows: PropertyPayrollDetailPdfReport["employees"][number]["paySummaryRows"] = [
        {
          payType: "OT15",
          appliedAs: "OT",
          hourlyRateLabel,
          rateModifierLabel: ot1Multiplier.toFixed(1),
          hoursLabel: formatHoursFromMinutes(summary.overtime1Minutes),
          amountLabel: formatCurrencyFromCents(summary.overtime1PayCents),
        },
        {
          payType: "OT2",
          appliedAs: "OT",
          hourlyRateLabel,
          rateModifierLabel: ot2Multiplier.toFixed(1),
          hoursLabel: formatHoursFromMinutes(summary.overtime2Minutes),
          amountLabel: formatCurrencyFromCents(summary.overtime2PayCents),
        },
        {
          payType: "REG",
          appliedAs: "REG",
          hourlyRateLabel,
          rateModifierLabel: "1.0",
          hoursLabel: formatHoursFromMinutes(summary.regularMinutes),
          amountLabel: formatCurrencyFromCents(summary.regularPayCents),
        },
      ];

      return {
        employeeId: summary.employeeId,
        name: `${summary.employee.firstName} ${summary.employee.lastName}`.trim(),
        employeeGroupLabel:
          readString(rateSnapshot.title) ??
          normalizeOptionalText(snapshots.find((candidate) => candidate.departmentLabel)?.departmentLabel) ??
          null,
        approvalStatusLabel: titleCaseStatus(summary.approvalStatus),
        approvedByLabel: resolveUserDisplayLabel(summary.approvedByUser as UserDisplay | null),
        approvedAtLabel: summary.approvedAt ? formatDateTimeInTimezone(summary.approvedAt, propertyTimezone) : null,
        payClassLabel,
        payPeriodFromLabel: formatDateForPeriodBoundary(run.payrollPeriod.periodStartDate),
        payPeriodToLabel: formatDateForPeriodBoundary(run.payrollPeriod.periodEndDate, true),
        rows,
        paySummaryRows,
        paySummaryTotals: {
          hoursLabel: formatHoursFromMinutes(summary.payableMinutes),
          amountLabel: formatCurrencyFromCents(summary.grossPayCents),
        },
      };
    });

  const totalRegularMinutes = run.employeeSummaries.reduce((sum, summary) => sum + summary.regularMinutes, 0);
  const totalOvertimeMinutes = run.employeeSummaries.reduce(
    (sum, summary) => sum + summary.overtime1Minutes + summary.overtime2Minutes,
    0
  );
  const totalGrossPayCents = run.employeeSummaries.reduce((sum, summary) => sum + summary.grossPayCents, BigInt(0));

  return {
    reportTitle: "DETAIL PAYROLL REPORT",
    propertyName: run.property.name,
    payPeriodLabel,
    payClassLabel,
    versionLabel: `Version ${run.version}`,
    generatedAtLabel: formatDateTimeInTimezone(generatedAt, propertyTimezone),
    coverSummary: {
      propertyName: run.property.name,
      versionLabel: `Version ${run.version}`,
      employeeCount: employees.length,
      regularHoursLabel: formatHoursFromMinutes(totalRegularMinutes),
      overtimeHoursLabel: formatHoursFromMinutes(totalOvertimeMinutes),
      estimatedGrossLabel: formatCurrencyFromCents(totalGrossPayCents),
    },
    legend: [
      { code: "Manual", description: "Shift was created manually." },
      { code: "Edited", description: "A saved shift was adjusted after the original punch set." },
      { code: "Auto-closed", description: "Shift was closed automatically by payroll rules." },
    ],
    employees,
  };
}
