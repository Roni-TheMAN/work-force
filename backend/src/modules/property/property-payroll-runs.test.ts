import assert from "node:assert/strict";
import test from "node:test";

import {
  allocateWeeklyOvertimeMinutes,
  buildApprovalSummaryFromEmployees,
  buildRunTotalsFromEmployeeSummaries,
} from "./property-payroll-runs";

test("allocateWeeklyOvertimeMinutes keeps a 40 hour week at zero overtime", () => {
  const allocation = allocateWeeklyOvertimeMinutes({
    weekAnchorDate: "2026-04-06",
    thresholdMinutes: 40 * 60,
    shifts: [
      { shiftId: "shift-1", employeeId: "employee-1", businessDate: "2026-04-06", payableMinutes: 8 * 60 },
      { shiftId: "shift-2", employeeId: "employee-1", businessDate: "2026-04-07", payableMinutes: 8 * 60 },
      { shiftId: "shift-3", employeeId: "employee-1", businessDate: "2026-04-08", payableMinutes: 8 * 60 },
      { shiftId: "shift-4", employeeId: "employee-1", businessDate: "2026-04-09", payableMinutes: 8 * 60 },
      { shiftId: "shift-5", employeeId: "employee-1", businessDate: "2026-04-10", payableMinutes: 8 * 60 },
    ],
  });

  assert.deepEqual(allocation.employeeTotals.get("employee-1"), {
    payableMinutes: 40 * 60,
    regularMinutes: 40 * 60,
    overtimeMinutes: 0,
  });
});

test("allocateWeeklyOvertimeMinutes assigns overtime only after the weekly threshold", () => {
  const allocation = allocateWeeklyOvertimeMinutes({
    weekAnchorDate: "2026-04-06",
    thresholdMinutes: 40 * 60,
    shifts: [
      { shiftId: "shift-1", employeeId: "employee-1", businessDate: "2026-04-06", payableMinutes: 8 * 60 },
      { shiftId: "shift-2", employeeId: "employee-1", businessDate: "2026-04-07", payableMinutes: 8 * 60 },
      { shiftId: "shift-3", employeeId: "employee-1", businessDate: "2026-04-08", payableMinutes: 8 * 60 },
      { shiftId: "shift-4", employeeId: "employee-1", businessDate: "2026-04-09", payableMinutes: 8 * 60 },
      { shiftId: "shift-5", employeeId: "employee-1", businessDate: "2026-04-10", payableMinutes: 8 * 60 },
      { shiftId: "shift-6", employeeId: "employee-1", businessDate: "2026-04-11", payableMinutes: 5 * 60 },
    ],
  });

  assert.deepEqual(allocation.employeeTotals.get("employee-1"), {
    payableMinutes: 45 * 60,
    regularMinutes: 40 * 60,
    overtimeMinutes: 5 * 60,
  });
  assert.deepEqual(allocation.shiftAllocations.get("shift-6"), {
    shiftId: "shift-6",
    employeeId: "employee-1",
    businessDate: "2026-04-11",
    payableMinutes: 5 * 60,
    regularMinutes: 0,
    overtimeMinutes: 5 * 60,
    weekStartDate: "2026-04-06",
    weekEndDate: "2026-04-12",
  });
});

test("allocateWeeklyOvertimeMinutes resets overtime when the next week starts inside a biweekly period", () => {
  const allocation = allocateWeeklyOvertimeMinutes({
    weekAnchorDate: "2026-04-06",
    thresholdMinutes: 40 * 60,
    shifts: [
      { shiftId: "week-1-day-1", employeeId: "employee-1", businessDate: "2026-04-06", payableMinutes: 8 * 60 },
      { shiftId: "week-1-day-2", employeeId: "employee-1", businessDate: "2026-04-07", payableMinutes: 8 * 60 },
      { shiftId: "week-1-day-3", employeeId: "employee-1", businessDate: "2026-04-08", payableMinutes: 8 * 60 },
      { shiftId: "week-1-day-4", employeeId: "employee-1", businessDate: "2026-04-09", payableMinutes: 8 * 60 },
      { shiftId: "week-1-day-5", employeeId: "employee-1", businessDate: "2026-04-10", payableMinutes: 8 * 60 },
      { shiftId: "week-2-day-1", employeeId: "employee-1", businessDate: "2026-04-13", payableMinutes: 8 * 60 },
      { shiftId: "week-2-day-2", employeeId: "employee-1", businessDate: "2026-04-14", payableMinutes: 8 * 60 },
      { shiftId: "week-2-day-3", employeeId: "employee-1", businessDate: "2026-04-15", payableMinutes: 8 * 60 },
      { shiftId: "week-2-day-4", employeeId: "employee-1", businessDate: "2026-04-16", payableMinutes: 8 * 60 },
      { shiftId: "week-2-day-5", employeeId: "employee-1", businessDate: "2026-04-17", payableMinutes: 8 * 60 },
    ],
  });

  assert.equal(allocation.employeeTotals.get("employee-1")?.overtimeMinutes, 0);
  assert.equal(allocation.shiftAllocations.get("week-2-day-5")?.weekStartDate, "2026-04-13");
});

test("allocateWeeklyOvertimeMinutes handles multiple overtime weeks in longer periods", () => {
  const allocation = allocateWeeklyOvertimeMinutes({
    weekAnchorDate: "2026-04-06",
    thresholdMinutes: 40 * 60,
    shifts: [
      { shiftId: "w1-1", employeeId: "employee-1", businessDate: "2026-04-06", payableMinutes: 9 * 60 },
      { shiftId: "w1-2", employeeId: "employee-1", businessDate: "2026-04-07", payableMinutes: 9 * 60 },
      { shiftId: "w1-3", employeeId: "employee-1", businessDate: "2026-04-08", payableMinutes: 9 * 60 },
      { shiftId: "w1-4", employeeId: "employee-1", businessDate: "2026-04-09", payableMinutes: 9 * 60 },
      { shiftId: "w1-5", employeeId: "employee-1", businessDate: "2026-04-10", payableMinutes: 9 * 60 },
      { shiftId: "w2-1", employeeId: "employee-1", businessDate: "2026-04-13", payableMinutes: 9 * 60 },
      { shiftId: "w2-2", employeeId: "employee-1", businessDate: "2026-04-14", payableMinutes: 9 * 60 },
      { shiftId: "w2-3", employeeId: "employee-1", businessDate: "2026-04-15", payableMinutes: 9 * 60 },
      { shiftId: "w2-4", employeeId: "employee-1", businessDate: "2026-04-16", payableMinutes: 9 * 60 },
      { shiftId: "w2-5", employeeId: "employee-1", businessDate: "2026-04-17", payableMinutes: 9 * 60 },
    ],
  });

  assert.deepEqual(allocation.employeeTotals.get("employee-1"), {
    payableMinutes: 90 * 60,
    regularMinutes: 80 * 60,
    overtimeMinutes: 10 * 60,
  });
});

test("allocateWeeklyOvertimeMinutes keeps separate employee totals and stores raw day minutes for charts", () => {
  const allocation = allocateWeeklyOvertimeMinutes({
    weekAnchorDate: "2026-04-06",
    thresholdMinutes: 40 * 60,
    shifts: [
      { shiftId: "a-1", employeeId: "employee-a", businessDate: "2026-04-06", payableMinutes: 20 },
      { shiftId: "a-2", employeeId: "employee-a", businessDate: "2026-04-06", payableMinutes: 20 },
      { shiftId: "a-3", employeeId: "employee-a", businessDate: "2026-04-06", payableMinutes: 20 },
      { shiftId: "b-1", employeeId: "employee-b", businessDate: "2026-04-07", payableMinutes: 60 },
    ],
  });

  assert.deepEqual(allocation.employeeTotals.get("employee-a"), {
    payableMinutes: 60,
    regularMinutes: 60,
    overtimeMinutes: 0,
  });
  assert.deepEqual(allocation.employeeTotals.get("employee-b"), {
    payableMinutes: 60,
    regularMinutes: 60,
    overtimeMinutes: 0,
  });
  assert.deepEqual(allocation.dailyMinutes.get("2026-04-06"), {
    payableMinutes: 60,
    regularMinutes: 60,
    overtimeMinutes: 0,
  });
});

test("buildApprovalSummaryFromEmployees counts pending and invalidated reviews", () => {
  const summary = buildApprovalSummaryFromEmployees([
    { approvalStatus: "approved" },
    { approvalStatus: "approved" },
    { approvalStatus: "needs_changes" },
    { approvalStatus: "pending" },
  ]);

  assert.deepEqual(summary, {
    approvedEmployees: 2,
    needsChangesEmployees: 1,
    pendingEmployees: 1,
    totalEmployees: 4,
  });
});

test("buildRunTotalsFromEmployeeSummaries aggregates gross and overtime from stored summaries", () => {
  const totals = buildRunTotalsFromEmployeeSummaries([
    {
      approvalStatus: "approved",
      grossPayCents: BigInt(12345),
      overtime1Minutes: 90,
      overtime2Minutes: 30,
      payableMinutes: 480,
    },
    {
      approvalStatus: "pending",
      grossPayCents: BigInt(5000),
      overtime1Minutes: 0,
      overtime2Minutes: 60,
      payableMinutes: 240,
    },
  ]);

  assert.deepEqual(totals, {
    totalMinutes: 720,
    totalHours: 12,
    overtimeMinutes: 180,
    overtimeHours: 3,
    estimatedGrossCents: 17345,
    estimatedGross: 173.45,
  });
});
