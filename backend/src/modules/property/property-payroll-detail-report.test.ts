import assert from "node:assert/strict";
import test from "node:test";

import {
  assemblePropertyPayrollDetailReport,
  loadFinalizedPayrollRunForExport,
  type FinalizedPayrollRunForExport,
} from "./property-payroll-detail-report";
import { renderPropertyPayrollDetailPdf } from "./property-payroll-detail-pdf";

function buildFinalizedRunFixture(): FinalizedPayrollRunForExport {
  return {
    id: "run-1",
    organizationId: "org-1",
    propertyId: "property-1",
    payrollPeriodId: "period-1",
    requestedByUserId: "user-1",
    version: 3,
    status: "finalized",
    startedAt: new Date("2026-01-19T00:10:00.000Z"),
    completedAt: new Date("2026-01-19T00:12:00.000Z"),
    finalizedAt: new Date("2026-01-19T00:15:00.000Z"),
    finalizedByUserId: "manager-1",
    supersededByPayrollRunId: null,
    notes: null,
    createdAt: new Date("2026-01-19T00:10:00.000Z"),
    property: {
      name: "Sample Suites",
      timezone: "America/Indianapolis",
    },
    finalizedByUser: {
      id: "manager-1",
      fullName: "Payroll Admin",
      email: "admin@example.com",
    },
    payrollPeriod: {
      periodStartDate: new Date("2026-01-04T00:00:00.000Z"),
      periodEndDate: new Date("2026-01-17T00:00:00.000Z"),
      payrollCalendar: {
        anchorStartDate: new Date("2026-01-04T00:00:00.000Z"),
        frequency: "weekly",
      },
    },
    employeeSummaries: [
      {
        id: "summary-1",
        payrollRunId: "run-1",
        employeeId: "employee-1",
        approvalStatus: "approved",
        approvedAt: new Date("2026-01-19T00:34:00.000Z"),
        approvedByUserId: "manager-1",
        approvalNote: "Verified against posted shifts.",
        totalMinutes: 3000,
        regularMinutes: 2880,
        overtime1Minutes: 120,
        overtime2Minutes: 0,
        breakMinutes: 0,
        payableMinutes: 3000,
        regularPayCents: BigInt(96000),
        overtime1PayCents: BigInt(6000),
        overtime2PayCents: BigInt(0),
        grossPayCents: BigInt(102000),
        rateSnapshot: {
          resolvedHourlyRateCents: 2000,
          ot1Multiplier: 1.5,
          ot2Multiplier: 2,
          ot1WeeklyAfterMinutes: 2400,
          title: "FD",
        },
        createdAt: new Date("2026-01-19T00:10:00.000Z"),
        employee: {
          firstName: "Crystal",
          lastName: "Cantu",
        },
        approvedByUser: {
          id: "manager-1",
          fullName: "Payroll Admin",
          email: "admin@example.com",
        },
      },
    ],
    shiftSnapshots: [
      {
        id: "snap-1",
        payrollRunId: "run-1",
        shiftSessionId: "shift-1",
        employeeId: "employee-1",
        employeeName: "Crystal Cantu",
        actualStartedAt: new Date("2026-01-04T15:00:00.000Z"),
        actualEndedAt: new Date("2026-01-04T23:00:00.000Z"),
        startedAt: new Date("2026-01-04T15:00:00.000Z"),
        endedAt: new Date("2026-01-04T23:00:00.000Z"),
        businessDate: new Date("2026-01-04T00:00:00.000Z"),
        weekStartDate: new Date("2026-01-04T00:00:00.000Z"),
        weekEndDate: new Date("2026-01-10T00:00:00.000Z"),
        totalMinutes: 480,
        breakMinutes: 0,
        payableMinutes: 480,
        regularMinutes: 480,
        overtime1Minutes: 0,
        overtime2Minutes: 0,
        estimatedGrossCents: BigInt(16000),
        departmentLabel: "FD",
        punchInfo: null,
        source: "mobile",
        entryMode: "punch",
        shiftStatus: "closed",
        isManual: false,
        isEdited: false,
        isAutoClosed: false,
        createdAt: new Date("2026-01-19T00:10:00.000Z"),
      },
      {
        id: "snap-2",
        payrollRunId: "run-1",
        shiftSessionId: "shift-2",
        employeeId: "employee-1",
        employeeName: "Crystal Cantu",
        actualStartedAt: new Date("2026-01-05T15:00:00.000Z"),
        actualEndedAt: new Date("2026-01-05T23:00:00.000Z"),
        startedAt: new Date("2026-01-05T15:00:00.000Z"),
        endedAt: new Date("2026-01-05T23:00:00.000Z"),
        businessDate: new Date("2026-01-05T00:00:00.000Z"),
        weekStartDate: new Date("2026-01-04T00:00:00.000Z"),
        weekEndDate: new Date("2026-01-10T00:00:00.000Z"),
        totalMinutes: 480,
        breakMinutes: 0,
        payableMinutes: 480,
        regularMinutes: 480,
        overtime1Minutes: 0,
        overtime2Minutes: 0,
        estimatedGrossCents: BigInt(16000),
        departmentLabel: "FD",
        punchInfo: null,
        source: "mobile",
        entryMode: "punch",
        shiftStatus: "closed",
        isManual: false,
        isEdited: false,
        isAutoClosed: false,
        createdAt: new Date("2026-01-19T00:10:00.000Z"),
      },
      {
        id: "snap-3",
        payrollRunId: "run-1",
        shiftSessionId: "shift-3",
        employeeId: "employee-1",
        employeeName: "Crystal Cantu",
        actualStartedAt: new Date("2026-01-06T15:00:00.000Z"),
        actualEndedAt: new Date("2026-01-06T23:00:00.000Z"),
        startedAt: new Date("2026-01-06T15:00:00.000Z"),
        endedAt: new Date("2026-01-06T23:00:00.000Z"),
        businessDate: new Date("2026-01-06T00:00:00.000Z"),
        weekStartDate: new Date("2026-01-04T00:00:00.000Z"),
        weekEndDate: new Date("2026-01-10T00:00:00.000Z"),
        totalMinutes: 480,
        breakMinutes: 0,
        payableMinutes: 480,
        regularMinutes: 480,
        overtime1Minutes: 0,
        overtime2Minutes: 0,
        estimatedGrossCents: BigInt(16000),
        departmentLabel: "FD",
        punchInfo: null,
        source: "mobile",
        entryMode: "punch",
        shiftStatus: "closed",
        isManual: false,
        isEdited: false,
        isAutoClosed: false,
        createdAt: new Date("2026-01-19T00:10:00.000Z"),
      },
      {
        id: "snap-4",
        payrollRunId: "run-1",
        shiftSessionId: "shift-4",
        employeeId: "employee-1",
        employeeName: "Crystal Cantu",
        actualStartedAt: new Date("2026-01-07T15:00:00.000Z"),
        actualEndedAt: new Date("2026-01-07T23:00:00.000Z"),
        startedAt: new Date("2026-01-07T15:00:00.000Z"),
        endedAt: new Date("2026-01-07T23:00:00.000Z"),
        businessDate: new Date("2026-01-07T00:00:00.000Z"),
        weekStartDate: new Date("2026-01-04T00:00:00.000Z"),
        weekEndDate: new Date("2026-01-10T00:00:00.000Z"),
        totalMinutes: 480,
        breakMinutes: 0,
        payableMinutes: 480,
        regularMinutes: 480,
        overtime1Minutes: 0,
        overtime2Minutes: 0,
        estimatedGrossCents: BigInt(16000),
        departmentLabel: "FD",
        punchInfo: null,
        source: "mobile",
        entryMode: "punch",
        shiftStatus: "closed",
        isManual: false,
        isEdited: false,
        isAutoClosed: false,
        createdAt: new Date("2026-01-19T00:10:00.000Z"),
      },
      {
        id: "snap-5",
        payrollRunId: "run-1",
        shiftSessionId: "shift-5",
        employeeId: "employee-1",
        employeeName: "Crystal Cantu",
        actualStartedAt: new Date("2026-01-08T15:00:00.000Z"),
        actualEndedAt: new Date("2026-01-08T23:00:00.000Z"),
        startedAt: new Date("2026-01-08T15:00:00.000Z"),
        endedAt: new Date("2026-01-08T23:00:00.000Z"),
        businessDate: new Date("2026-01-08T00:00:00.000Z"),
        weekStartDate: new Date("2026-01-04T00:00:00.000Z"),
        weekEndDate: new Date("2026-01-10T00:00:00.000Z"),
        totalMinutes: 480,
        breakMinutes: 0,
        payableMinutes: 480,
        regularMinutes: 480,
        overtime1Minutes: 0,
        overtime2Minutes: 0,
        estimatedGrossCents: BigInt(16000),
        departmentLabel: "FD",
        punchInfo: null,
        source: "mobile",
        entryMode: "punch",
        shiftStatus: "closed",
        isManual: false,
        isEdited: false,
        isAutoClosed: false,
        createdAt: new Date("2026-01-19T00:10:00.000Z"),
      },
      {
        id: "snap-6",
        payrollRunId: "run-1",
        shiftSessionId: "shift-6",
        employeeId: "employee-1",
        employeeName: "Crystal Cantu",
        actualStartedAt: new Date("2026-01-09T20:00:00.000Z"),
        actualEndedAt: new Date("2026-01-09T22:00:00.000Z"),
        startedAt: new Date("2026-01-09T20:00:00.000Z"),
        endedAt: new Date("2026-01-09T22:00:00.000Z"),
        businessDate: new Date("2026-01-09T00:00:00.000Z"),
        weekStartDate: new Date("2026-01-04T00:00:00.000Z"),
        weekEndDate: new Date("2026-01-10T00:00:00.000Z"),
        totalMinutes: 120,
        breakMinutes: 0,
        payableMinutes: 120,
        regularMinutes: 0,
        overtime1Minutes: 120,
        overtime2Minutes: 0,
        estimatedGrossCents: BigInt(6000),
        departmentLabel: "FD",
        punchInfo: "Edited, Out corrected",
        source: "admin",
        entryMode: "punch",
        shiftStatus: "edited",
        isManual: false,
        isEdited: true,
        isAutoClosed: false,
        createdAt: new Date("2026-01-19T00:10:00.000Z"),
      },
      {
        id: "snap-7",
        payrollRunId: "run-1",
        shiftSessionId: "shift-7",
        employeeId: "employee-1",
        employeeName: "Crystal Cantu",
        actualStartedAt: new Date("2026-01-12T23:06:00.000Z"),
        actualEndedAt: new Date("2026-01-13T07:05:00.000Z"),
        startedAt: new Date("2026-01-12T23:06:00.000Z"),
        endedAt: new Date("2026-01-13T07:15:00.000Z"),
        businessDate: new Date("2026-01-12T00:00:00.000Z"),
        weekStartDate: new Date("2026-01-11T00:00:00.000Z"),
        weekEndDate: new Date("2026-01-17T00:00:00.000Z"),
        totalMinutes: 480,
        breakMinutes: 0,
        payableMinutes: 480,
        regularMinutes: 480,
        overtime1Minutes: 0,
        overtime2Minutes: 0,
        estimatedGrossCents: BigInt(16000),
        departmentLabel: "FD",
        punchInfo: "Edited, Out corrected",
        source: "mobile",
        entryMode: "punch",
        shiftStatus: "edited",
        isManual: false,
        isEdited: true,
        isAutoClosed: false,
        createdAt: new Date("2026-01-19T00:10:00.000Z"),
      },
    ],
    batchRuns: [],
    requestedByUser: null,
    supersededByPayrollRun: null,
    supersededPayrollRuns: [],
    employeeSummariesRelation: undefined,
    shiftSnapshotsRelation: undefined,
    batchRunsRelation: undefined,
    organization: undefined,
    payrollPeriodRelation: undefined,
    propertyRelation: undefined,
  } as unknown as FinalizedPayrollRunForExport;
}

test("loadFinalizedPayrollRunForExport enforces finalized-run-only queries", async () => {
  let recordedStatus: string | undefined;
  const fakeClient = {
    payrollRun: {
      findFirst: async (args: { where?: { status?: string } }) => {
        recordedStatus = args.where?.status;
        return null;
      },
    },
  };

  await assert.rejects(
    () => loadFinalizedPayrollRunForExport(fakeClient as never, "property-1", "run-1"),
    /Finalized payroll run not found/
  );
  assert.equal(recordedStatus, "finalized");
});

test("assemblePropertyPayrollDetailReport builds employee rows, weekly subtotals, and pay-period totals", () => {
  const report = assemblePropertyPayrollDetailReport(buildFinalizedRunFixture(), new Date("2026-01-19T00:38:00.000Z"));
  const employee = report.employees[0];

  assert.equal(report.coverSummary.employeeCount, 1);
  assert.equal(report.coverSummary.regularHoursLabel, "48.00");
  assert.equal(report.coverSummary.overtimeHoursLabel, "2.00");
  assert.equal(report.coverSummary.estimatedGrossLabel, "$1,020.00");
  assert.equal(employee.rows.filter((row) => row.kind === "weekly_total").length, 2);
  assert.equal(employee.rows.at(-1)?.kind, "period_total");
  assert.equal(employee.rows.at(-1)?.inOutHours, "50.00");
  assert.equal(employee.rows.at(-1)?.dailyRegHours, "48.00");
  assert.equal(employee.rows.at(-1)?.dailyOtHours, "2.00");
  assert.deepEqual(
    employee.paySummaryRows.map((row) => [row.payType, row.hoursLabel, row.amountLabel]),
    [
      ["OT15", "2.00", "$60.00"],
      ["OT2", "0.00", "$0.00"],
      ["REG", "48.00", "$960.00"],
    ]
  );
});

test("assemblePropertyPayrollDetailReport preserves approval metadata", () => {
  const report = assemblePropertyPayrollDetailReport(buildFinalizedRunFixture(), new Date("2026-01-19T00:38:00.000Z"));
  const employee = report.employees[0];

  assert.equal(employee.approvalStatusLabel, "Approved");
  assert.equal(employee.approvedByLabel, "Payroll Admin");
  assert.match(employee.approvedAtLabel ?? "", /1\/18\/2026|1\/19\/2026/);
  assert.equal(employee.employeeGroupLabel, "FD");
});

test("assemblePropertyPayrollDetailReport formats cross-midnight edited punches", () => {
  const report = assemblePropertyPayrollDetailReport(buildFinalizedRunFixture(), new Date("2026-01-19T00:38:00.000Z"));
  const employee = report.employees[0];
  const crossMidnightRow = employee.rows.find((row) => row.kind === "shift" && row.businessDateLabel.includes("1/12/2026"));

  assert.ok(crossMidnightRow);
  assert.match(crossMidnightRow.actualOutDisplay, /\(Tue\)/);
  assert.match(crossMidnightRow.actualOutDisplay, /02:05 AM/);
  assert.match(crossMidnightRow.editedOutDisplay, /02:15 AM/);
});

test("renderPropertyPayrollDetailPdf generates a searchable PDF buffer", async () => {
  const report = assemblePropertyPayrollDetailReport(buildFinalizedRunFixture(), new Date("2026-01-19T00:38:00.000Z"));
  const pdf = await renderPropertyPayrollDetailPdf(report);
  const decoded = pdf.toString("latin1");

  assert.ok(pdf.subarray(0, 4).equals(Buffer.from("%PDF")));
  assert.match(decoded, /DETAIL PAYROLL REPORT/);
  assert.match(decoded, /Crystal Cantu/);
  assert.match(decoded, /Pay Period Totals/);
});
