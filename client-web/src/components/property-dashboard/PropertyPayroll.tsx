import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { PropertyDashboardData, PropertyPayrollPeriodDetail } from "@/api/property";
import { ShiftFlagBadges } from "@/components/property-dashboard/property-shift-state";
import { formatCurrency, formatHours } from "@/components/dashboard/dashboard-formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useApprovePropertyPayrollEmployee,
  useCreatePropertyPayrollRun,
  useDownloadPropertyPayrollExport,
  useFinalizePropertyPayrollRun,
  usePropertyPayrollPeriodDetail,
  usePropertyPayrollPeriods,
  useReopenPropertyPayrollRun,
  useResetPropertyPayrollEmployeeApproval,
} from "@/hooks/useProperty";

type PropertyPayrollProps = {
  currentPayPeriod: PropertyDashboardData["currentPayPeriod"];
  isAdvancing: boolean;
  onAdvancePeriod: () => void;
  payroll: PropertyDashboardData["payroll"];
  propertyId: string;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

function formatCurrencyOrDash(value: number | null) {
  return value === null ? "—" : formatCurrency(value);
}

function getRunBadgeVariant(status: string) {
  if (status === "finalized") {
    return "default";
  }

  if (status === "in_review") {
    return "secondary";
  }

  return "outline";
}

function getApprovalBadgeVariant(status: string) {
  if (status === "approved") {
    return "default";
  }

  if (status === "needs_changes") {
    return "secondary";
  }

  return "outline";
}

function getApprovalStatusLabel(status: string) {
  switch (status) {
    case "needs_changes":
      return "needs changes";
    default:
      return status;
  }
}

function buildEmployeeReviewMessage(employee: PropertyPayrollPeriodDetail["employees"][number]) {
  if (employee.approvalStatus === "approved") {
    const approvedBy = employee.approvedByDisplay ?? "Unknown reviewer";
    const approvedAt = formatDateTime(employee.approvedAt);

    return `Approved by ${approvedBy} on ${approvedAt}.`;
  }

  if (employee.approvalStatus === "needs_changes") {
    return employee.reviewStatusReason ?? "Source time changed after review. Re-review this employee before finalization.";
  }

  return "Awaiting payroll review for this employee.";
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-4">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function PayrollTrendChart({
  trend,
}: {
  trend: Array<{ hours: number; label: string }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily payroll hours</CardTitle>
        <CardDescription>Period-based payable hours using the employee clock-in payroll rule.</CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        {trend.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={(value) => formatHours(Number(value))} />
              <Tooltip formatter={(value) => formatHours(Number(value))} />
              <Bar dataKey="hours" radius={[10, 10, 0, 0]} fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No shifts are included in this payroll period.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ApprovalProgressCard({ detail }: { detail: PropertyPayrollPeriodDetail }) {
  const total = Math.max(detail.approvalSummary.totalEmployees, 1);
  const approvedWidth = (detail.approvalSummary.approvedEmployees / total) * 100;
  const reviewWidth = (detail.approvalSummary.needsChangesEmployees / total) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval progress</CardTitle>
        <CardDescription>Every employee must be approved before finalization.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-full bg-muted">
          <div className="flex h-3">
            <div className="bg-primary" style={{ width: `${approvedWidth}%` }} />
            <div className="bg-amber-500" style={{ width: `${reviewWidth}%` }} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Approved</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{detail.approvalSummary.approvedEmployees}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{detail.approvalSummary.pendingEmployees}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Needs changes</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{detail.approvalSummary.needsChangesEmployees}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TopEmployeesCard({ detail }: { detail: PropertyPayrollPeriodDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top employees</CardTitle>
        <CardDescription>Highest-hour employees in the selected payroll window.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {detail.analytics.topEmployees.length > 0 ? (
          detail.analytics.topEmployees.map((employee) => (
            <div key={employee.employeeId} className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{employee.name}</p>
                <p className="text-sm text-muted-foreground">{employee.shiftCount} shifts</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{formatHours(employee.totalHours)}</p>
                <p className="text-sm text-muted-foreground">{formatCurrencyOrDash(employee.estimatedGross)}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No payroll activity is available yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function PayrollEmployeeRows({
  detail,
  onApprove,
  onResetApproval,
  pendingEmployeeId,
}: {
  detail: PropertyPayrollPeriodDetail;
  onApprove: (runId: string, employeeId: string) => void;
  onResetApproval: (runId: string, employeeId: string) => void;
  pendingEmployeeId: string | null;
}) {
  const [expandedEmployeeIds, setExpandedEmployeeIds] = useState<string[]>([]);
  const run = detail.latestRun;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee review</CardTitle>
        <CardDescription>
          Expand an employee to inspect the included shifts, flags, and payroll review status.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {detail.employees.length > 0 ? (
          detail.employees.map((employee) => {
            const isExpanded = expandedEmployeeIds.includes(employee.employeeId);
            const employeeShifts = detail.includedShifts.filter((shift) => shift.employeeId === employee.employeeId);

            return (
              <div key={employee.employeeId} className="rounded-3xl border border-border bg-card">
                <button
                  type="button"
                  className="w-full px-5 py-5 text-left"
                  onClick={() =>
                    setExpandedEmployeeIds((current) =>
                      current.includes(employee.employeeId)
                        ? current.filter((value) => value !== employee.employeeId)
                        : [...current, employee.employeeId]
                    )
                  }
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-foreground">{employee.name}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant={getApprovalBadgeVariant(employee.approvalStatus)}>
                          {getApprovalStatusLabel(employee.approvalStatus)}
                        </Badge>
                        {employee.flagCounts.manual > 0 ? <Badge variant="outline">{employee.flagCounts.manual} manual</Badge> : null}
                        {employee.flagCounts.edited > 0 ? <Badge variant="secondary">{employee.flagCounts.edited} edited</Badge> : null}
                        {employee.flagCounts.autoClosed > 0 ? (
                          <Badge variant="secondary">{employee.flagCounts.autoClosed} auto-closed</Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Regular</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{formatHours(employee.regularHours)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Overtime</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{formatHours(employee.overtimeHours)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{formatHours(employee.totalHours)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Shifts</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{employee.shiftCount}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Estimated gross</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{formatCurrencyOrDash(employee.estimatedGross)}</p>
                      </div>
                    </div>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="space-y-4 border-t border-border px-5 py-5">
                    <div className="rounded-2xl border border-border bg-background px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={getApprovalBadgeVariant(employee.approvalStatus)}>
                          {getApprovalStatusLabel(employee.approvalStatus)}
                        </Badge>
                        {employee.approvedByDisplay ? <Badge variant="outline">Reviewed by {employee.approvedByDisplay}</Badge> : null}
                        {employee.approvedAt ? <Badge variant="outline">{formatDateTime(employee.approvedAt)}</Badge> : null}
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">{buildEmployeeReviewMessage(employee)}</p>
                      {employee.reviewStatusReason ? (
                        <div className="mt-3 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                          {employee.reviewStatusReason}
                        </div>
                      ) : null}
                      {employee.approvalNote ? (
                        <div className="mt-3 rounded-2xl border border-border bg-card px-4 py-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Review note</p>
                          <p className="mt-1 text-sm text-foreground">{employee.approvalNote}</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {run && detail.actions.canApproveEmployees ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onApprove(run.id, employee.employeeId)}
                          disabled={pendingEmployeeId === employee.employeeId}
                        >
                          Approve employee
                        </Button>
                      ) : null}
                      {run && detail.actions.canResetApprovals ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onResetApproval(run.id, employee.employeeId)}
                          disabled={pendingEmployeeId === employee.employeeId}
                        >
                          Reset approval
                        </Button>
                      ) : null}
                      {detail.actions.editable ? (
                        <Badge variant="outline">Edit shifts from Time & Attendance</Badge>
                      ) : (
                        <Badge variant="secondary">Reopen payroll before editing time</Badge>
                      )}
                    </div>

                    {employeeShifts.length > 0 ? (
                      <div className="space-y-3">
                        {employeeShifts.map((shift) => (
                          <div key={shift.shiftSessionId} className="rounded-2xl border border-border bg-background px-4 py-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <p className="text-sm font-medium text-foreground">{new Date(shift.startedAt).toLocaleString()}</p>
                                <p className="text-sm text-muted-foreground">
                                  {shift.businessDate} · {formatHours(shift.payableMinutes / 60)} payable · {formatHours(shift.breakMinutes / 60)} breaks
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={shift.status === "closed" ? "outline" : "secondary"}>{shift.status}</Badge>
                                <ShiftFlagBadges flags={shift.flags} />
                              </div>
                            </div>
                            {shift.flags.locked ? (
                              <p className="mt-3 text-sm text-muted-foreground">
                                Included in payroll run version {run?.version ?? "—"}. Reopen the run before editing this source time.
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No shifts are included for this employee.</p>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">No employees are included in this payroll period yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function PayrollDetailContent({
  detail,
  onApprove,
  onCreateRun,
  onDownload,
  onFinalize,
  onReopen,
  onResetApproval,
  pendingEmployeeId,
  pendingRunId,
}: {
  detail: PropertyPayrollPeriodDetail;
  onApprove: (runId: string, employeeId: string) => void;
  onCreateRun: (periodId: string) => void;
  onDownload: (runId: string, kind: "detail" | "shifts" | "summary") => void;
  onFinalize: (runId: string, version: number) => void;
  onReopen: (runId: string, version: number) => void;
  onResetApproval: (runId: string, employeeId: string) => void;
  pendingEmployeeId: string | null;
  pendingRunId: string | null;
}) {
  const run = detail.latestRun;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>{detail.period.label}</CardTitle>
            <CardDescription>
              Period status: {detail.period.status}. Hours remain in the period where the employee clocked in.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {run ? <Badge variant={getRunBadgeVariant(run.status)}>{run.status}</Badge> : <Badge variant="outline">live preview</Badge>}
            {detail.actions.canCreateRun ? (
              <Button type="button" onClick={() => onCreateRun(detail.period.id)}>
                Create payroll run
              </Button>
            ) : null}
            {run && detail.actions.canFinalize ? (
              <Button type="button" variant="outline" onClick={() => onFinalize(run.id, run.version)} disabled={pendingRunId === run.id}>
                Finalize run
              </Button>
            ) : null}
            {run && detail.actions.canReopen ? (
              <Button type="button" variant="outline" onClick={() => onReopen(run.id, run.version)} disabled={pendingRunId === run.id}>
                Reopen payroll
              </Button>
            ) : null}
            {run && detail.actions.canExport ? (
              <>
                <Button type="button" variant="outline" onClick={() => onDownload(run.id, "detail")} disabled={pendingRunId === run.id}>
                  Export detail PDF
                </Button>
                <Button type="button" variant="outline" onClick={() => onDownload(run.id, "summary")} disabled={pendingRunId === run.id}>
                  Export summary CSV
                </Button>
                <Button type="button" variant="outline" onClick={() => onDownload(run.id, "shifts")} disabled={pendingRunId === run.id}>
                  Export shifts CSV
                </Button>
              </>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-border bg-background px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Run version</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{run ? `v${run.version}` : "Live preview"}</p>
              <p className="mt-1 text-sm text-muted-foreground">Frozen snapshots exist only after a payroll run is created.</p>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Requested by</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{run?.requestedByDisplay ?? "—"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(run?.startedAt ?? null)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Finalized by</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{run?.finalizedByDisplay ?? "—"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(run?.finalizedAt ?? null)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Approval state</p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {detail.approvalSummary.approvedEmployees}/{detail.approvalSummary.totalEmployees} approved
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {detail.approvalSummary.needsChangesEmployees} need another review pass
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Edit posture</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{detail.actions.editable ? "Time editable" : "Time locked"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {detail.actions.editable
                  ? "Shifts can still change and may invalidate employee approvals."
                  : "Reopen the finalized run before editing included source time."}
              </p>
            </div>
          </div>

          {!detail.actions.canFinalize && run?.status === "in_review" ? (
            <div className="rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              Finalization stays blocked until every employee is approved and any invalidated reviews are completed again.
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              label="Total hours"
              value={formatHours(detail.analytics.summary.totalPayableHours)}
              detail={`${detail.analytics.summary.employeesInPeriod} employees in period`}
            />
            <MetricCard label="Overtime" value={formatHours(detail.analytics.summary.overtimeHours)} detail="Period overtime total" />
            <MetricCard label="Estimated gross" value={formatCurrencyOrDash(detail.analytics.summary.estimatedGross)} detail="Based on current stored pay rates" />
            <MetricCard label="Approved" value={String(detail.analytics.summary.approvedEmployees)} detail={`Pending ${detail.analytics.summary.pendingEmployees}`} />
            <MetricCard label="Needs changes" value={String(detail.analytics.summary.needsChangesEmployees)} detail="Employees requiring another review pass" />
            <MetricCard label="Flagged shifts" value={String(detail.analytics.summary.flaggedShifts)} detail="Manual, edited, or auto-closed shifts" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.85fr_0.85fr]">
        <PayrollTrendChart trend={detail.analytics.dailyTrend} />
        <ApprovalProgressCard detail={detail} />
        <TopEmployeesCard detail={detail} />
      </div>

      <PayrollEmployeeRows
        detail={detail}
        onApprove={onApprove}
        onResetApproval={onResetApproval}
        pendingEmployeeId={pendingEmployeeId}
      />
    </div>
  );
}

export function PropertyPayroll({ currentPayPeriod, isAdvancing, onAdvancePeriod, payroll, propertyId }: PropertyPayrollProps) {
  const [activeTab, setActiveTab] = useState("current");
  const periodsQuery = usePropertyPayrollPeriods(propertyId);
  const periods = periodsQuery.data?.periods ?? [];
  const currentPeriodId = currentPayPeriod?.id ?? periods[0]?.periodId ?? null;
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(currentPeriodId);
  const detailQuery = usePropertyPayrollPeriodDetail(propertyId, selectedPeriodId);
  const createRunMutation = useCreatePropertyPayrollRun(propertyId);
  const approveMutation = useApprovePropertyPayrollEmployee(propertyId);
  const resetApprovalMutation = useResetPropertyPayrollEmployeeApproval(propertyId);
  const finalizeMutation = useFinalizePropertyPayrollRun(propertyId);
  const reopenMutation = useReopenPropertyPayrollRun(propertyId);
  const downloadMutation = useDownloadPropertyPayrollExport(propertyId);

  useEffect(() => {
    if (activeTab === "current" && currentPeriodId) {
      setSelectedPeriodId(currentPeriodId);
      return;
    }

    if (!selectedPeriodId && periods[0]?.periodId) {
      setSelectedPeriodId(periods[0].periodId);
    }
  }, [activeTab, currentPeriodId, periods, selectedPeriodId]);

  const activeError = useMemo(
    () =>
      periodsQuery.error ??
      detailQuery.error ??
      createRunMutation.error ??
      approveMutation.error ??
      resetApprovalMutation.error ??
      finalizeMutation.error ??
      reopenMutation.error ??
      downloadMutation.error ??
      null,
    [
      approveMutation.error,
      createRunMutation.error,
      detailQuery.error,
      downloadMutation.error,
      finalizeMutation.error,
      periodsQuery.error,
      reopenMutation.error,
      resetApprovalMutation.error,
    ]
  );

  const selectedDetail = detailQuery.data ?? null;
  const summarySource = selectedDetail?.analytics.summary ?? null;
  const pendingEmployeeId =
    (approveMutation.isPending ? approveMutation.variables?.employeeId : null) ??
    (resetApprovalMutation.isPending ? resetApprovalMutation.variables?.employeeId : null) ??
    null;
  const pendingRunId =
    (createRunMutation.isPending ? createRunMutation.variables?.periodId ?? "__creating-run__" : null) ??
    (finalizeMutation.isPending ? finalizeMutation.variables : null) ??
    (reopenMutation.isPending ? reopenMutation.variables : null) ??
    (downloadMutation.isPending ? downloadMutation.variables?.runId : null) ??
    null;

  const confirmAdvancePeriod = () => {
    if (
      !window.confirm(
        "Start the next payroll period? This closes the current window and creates the next property payroll period for future runs."
      )
    ) {
      return;
    }

    onAdvancePeriod();
  };

  const confirmFinalizeRun = (runId: string, version: number) => {
    if (
      !window.confirm(
        `Finalize payroll run v${version}? This locks the included shifts against time edits until the run is reopened.`
      )
    ) {
      return;
    }

    finalizeMutation.mutate(runId);
  };

  const confirmReopenRun = (runId: string, version: number) => {
    if (
      !window.confirm(
        `Reopen payroll run v${version}? This unlocks the finalized run so source time can change and approvals can require re-review.`
      )
    ) {
      return;
    }

    reopenMutation.mutate(runId);
  };

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Current period</CardDescription>
            <CardTitle className="text-xl font-semibold tracking-tight">{payroll.currentPeriod?.label ?? "Not configured"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total hours</CardDescription>
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {formatHours(summarySource?.totalPayableHours ?? payroll.totalHours)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Estimated wages</CardDescription>
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {formatCurrencyOrDash(summarySource?.estimatedGross ?? payroll.estimatedWages)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Flagged shifts</CardDescription>
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {summarySource?.flaggedShifts ?? payroll.requiresAttentionCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {activeError ? (
        <Card className="border-destructive/40">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{activeError.message}</p>
          </CardContent>
        </Card>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="current">Current</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="final-report">Final Report</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-6 pt-4">
          {payroll.currentPeriod ? (
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Property payroll window</CardTitle>
                  <CardDescription>
                    Next period: {payroll.nextPeriod?.label ?? "Not generated yet"}.
                  </CardDescription>
                </div>
                <Button type="button" variant="outline" disabled={!payroll.canAdvancePeriod || isAdvancing} onClick={confirmAdvancePeriod}>
                  {isAdvancing ? "Starting..." : "Start next payroll"}
                </Button>
              </CardHeader>
            </Card>
          ) : null}

          {!payroll.currentPeriod ? (
            <Card>
              <CardHeader>
                <CardTitle>Payroll</CardTitle>
                <CardDescription>
                  Configure property payroll settings before building runs or approving employees.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : selectedDetail ? (
            <PayrollDetailContent
              detail={selectedDetail}
              onApprove={(runId, employeeId) => approveMutation.mutate({ runId, employeeId })}
              onCreateRun={(periodId) => createRunMutation.mutate({ periodId })}
              onDownload={(runId, kind) => downloadMutation.mutate({ runId, kind })}
              onFinalize={confirmFinalizeRun}
              onReopen={confirmReopenRun}
              onResetApproval={(runId, employeeId) => resetApprovalMutation.mutate({ runId, employeeId })}
              pendingEmployeeId={pendingEmployeeId}
              pendingRunId={pendingRunId}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Loading payroll state</CardTitle>
                <CardDescription>Pulling the current payroll period for this property.</CardDescription>
              </CardHeader>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="pt-4">
          <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Period history</CardTitle>
                <CardDescription>Property-scoped payroll periods and their latest run version.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {periods.length > 0 ? (
                  periods.map((period) => (
                    <button
                      key={period.periodId}
                      type="button"
                      onClick={() => setSelectedPeriodId(period.periodId)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        selectedPeriodId === period.periodId ? "border-primary bg-primary/5" : "border-border bg-background"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{period.label}</p>
                          <p className="text-sm text-muted-foreground">
                            {period.status}
                            {period.latestRun ? ` · v${period.latestRun.version}` : ""}
                          </p>
                        </div>
                        {period.latestRun ? (
                          <Badge variant={getRunBadgeVariant(period.latestRun.status)}>{period.latestRun.status}</Badge>
                        ) : (
                          <Badge variant="outline">no run</Badge>
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No payroll periods are available for this property yet.</p>
                )}
              </CardContent>
            </Card>

            {selectedDetail ? (
              <PayrollDetailContent
                detail={selectedDetail}
                onApprove={(runId, employeeId) => approveMutation.mutate({ runId, employeeId })}
                onCreateRun={(periodId) => createRunMutation.mutate({ periodId })}
                onDownload={(runId, kind) => downloadMutation.mutate({ runId, kind })}
                onFinalize={confirmFinalizeRun}
                onReopen={confirmReopenRun}
                onResetApproval={(runId, employeeId) => resetApprovalMutation.mutate({ runId, employeeId })}
                pendingEmployeeId={pendingEmployeeId}
                pendingRunId={pendingRunId}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Period detail</CardTitle>
                  <CardDescription>Select a payroll period to inspect its history and report state.</CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="final-report" className="pt-4">
          {selectedDetail?.latestRun?.status === "finalized" ? (
            <PayrollDetailContent
              detail={selectedDetail}
              onApprove={(runId, employeeId) => approveMutation.mutate({ runId, employeeId })}
              onCreateRun={(periodId) => createRunMutation.mutate({ periodId })}
              onDownload={(runId, kind) => downloadMutation.mutate({ runId, kind })}
              onFinalize={confirmFinalizeRun}
              onReopen={confirmReopenRun}
              onResetApproval={(runId, employeeId) => resetApprovalMutation.mutate({ runId, employeeId })}
              pendingEmployeeId={pendingEmployeeId}
              pendingRunId={pendingRunId}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Final report</CardTitle>
                <CardDescription>
                  Select a finalized payroll period from History to export the detail PDF or the existing CSV reports.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
