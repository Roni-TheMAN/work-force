import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type {
  PropertyDashboardData,
  PropertyDashboardProperty,
  PropertyDashboardWorkforceMember,
  PropertyTimeLogShift,
} from "@/api/property";
import { ShiftFlagBadges, buildPayrollImpactLabel } from "@/components/property-dashboard/property-shift-state";
import type { ShiftBreakInput } from "@/api/time-tracking";
import { formatHours } from "@/components/dashboard/dashboard-formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePropertyTimeLogs } from "@/hooks/useProperty";
import { useAdjustShift, useCreateManualShift } from "@/hooks/useTimeTracking";
import { PERMISSIONS } from "@/lib/permissions";

type EditableBreak = {
  breakType: "meal" | "other" | "rest";
  endedAt: string;
  id: string;
  paid: boolean;
  startedAt: string;
};

type PropertyTimeProps = {
  currentPayPeriod: PropertyDashboardData["currentPayPeriod"];
  effectivePermissions: string[];
  property: PropertyDashboardProperty;
  workforce: PropertyDashboardWorkforceMember[];
};

type RangePreset = "current_period" | "custom" | "last_7" | "today";
type AttendanceStateFilter = "all" | "clocked-in" | "worked" | "no-hours";
type FlagFilter = "auto_closed" | "edited" | "locked" | "manual";
type ShiftStatusFilter = "all" | "auto_closed" | "closed" | "edited" | "open";

function createBreakId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) {
    return "Open";
  }

  return formatHours(minutes / 60);
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Open";
  }

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return "";
  }

  const parsedValue = new Date(value);
  const localValue = new Date(parsedValue.getTime() - parsedValue.getTimezoneOffset() * 60_000);
  return localValue.toISOString().slice(0, 16);
}

function toIsoOrNull(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function getShiftBadges(shift: PropertyTimeLogShift) {
  return {
    autoClosed: shift.flags.autoClosed,
    edited: shift.flags.edited,
    manual: shift.flags.manual,
    locked: shift.flags.locked,
  };
}

function buildFallbackRange(currentPayPeriod: PropertyDashboardData["currentPayPeriod"]) {
  if (currentPayPeriod) {
    return {
      businessDateFrom: currentPayPeriod.startDate,
      businessDateTo: currentPayPeriod.endDate,
      preset: "current_period" as const,
    };
  }

  const today = new Date();
  const businessDateTo = formatDateOnly(today);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 6);

  return {
    businessDateFrom: formatDateOnly(startDate),
    businessDateTo,
    preset: "last_7" as const,
  };
}

function BreakEditor({
  breaks,
  onAdd,
  onChange,
  onRemove,
}: {
  breaks: EditableBreak[];
  onAdd: () => void;
  onChange: (id: string, field: keyof EditableBreak, value: string | boolean) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Break segments</Label>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          Add break
        </Button>
      </div>
      {breaks.length > 0 ? (
        breaks.map((segment) => (
          <div key={segment.id} className="grid gap-3 rounded-2xl border border-border bg-background p-3 md:grid-cols-[140px_1fr_1fr_100px_auto]">
            <Select
              value={segment.breakType}
              onValueChange={(value) => onChange(segment.id, "breakType", (value ?? "meal") as EditableBreak["breakType"])}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="meal">Meal</SelectItem>
                <SelectItem value="rest">Rest</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="datetime-local"
              value={segment.startedAt}
              onChange={(event) => onChange(segment.id, "startedAt", event.target.value)}
            />
            <Input
              type="datetime-local"
              value={segment.endedAt}
              onChange={(event) => onChange(segment.id, "endedAt", event.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={segment.paid}
                onChange={(event) => onChange(segment.id, "paid", event.target.checked)}
              />
              Paid
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(segment.id)}>
              Remove
            </Button>
          </div>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">No break segments added.</p>
      )}
    </div>
  );
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

function TimeTrendChart({
  trend,
  title,
  description,
}: {
  trend: Array<{ hours: number; label: string }>;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
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
            No shifts fall inside the current filter.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExceptionSummaryCard({
  summary,
}: {
  summary: {
    autoClosed: number;
    edited: number;
    locked: number;
    manual: number;
  };
}) {
  const items = [
    { key: "manual", label: "Manual", value: summary.manual },
    { key: "edited", label: "Edited", value: summary.edited },
    { key: "autoClosed", label: "Auto-closed", value: summary.autoClosed },
    { key: "locked", label: "Locked", value: summary.locked },
  ];
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exception Breakdown</CardTitle>
        <CardDescription>Real persisted flags inside the selected time window.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => (
          <div key={item.key} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{item.label}</span>
              <span className="text-muted-foreground">{item.value}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EmployeeShiftRow({
  canManageTime,
  onEdit,
  shift,
}: {
  canManageTime: boolean;
  onEdit: (shift: PropertyTimeLogShift) => void;
  shift: PropertyTimeLogShift;
}) {
  const flags = getShiftBadges(shift);

  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{formatDateTime(shift.startedAt)}</p>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(shift.startedAt)} to {formatDateTime(shift.endedAt)}
          </p>
          <p className="text-xs text-muted-foreground">Business date {shift.businessDate}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={shift.status === "open" ? "default" : "outline"}>{shift.status}</Badge>
          <ShiftFlagBadges flags={flags} />
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="mt-1 text-sm font-medium text-foreground">{formatMinutes(shift.totalMinutes)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Breaks</p>
          <p className="mt-1 text-sm font-medium text-foreground">{formatMinutes(shift.breakMinutes)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Payable</p>
          <p className="mt-1 text-sm font-medium text-foreground">{formatMinutes(shift.payableMinutes)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Source</p>
          <p className="mt-1 text-sm font-medium text-foreground">{shift.source}</p>
        </div>
        <div className="flex items-end justify-start md:justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canManageTime || shift.payrollImpact.locked}
            onClick={() => onEdit(shift)}
          >
            {shift.payrollImpact.locked ? "Locked" : "Edit shift"}
          </Button>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{buildPayrollImpactLabel(shift.payrollImpact)}</p>
    </div>
  );
}

export function PropertyTime({ currentPayPeriod, effectivePermissions, property, workforce }: PropertyTimeProps) {
  const initialRange = useMemo(() => buildFallbackRange(currentPayPeriod), [currentPayPeriod]);
  const [rangePreset, setRangePreset] = useState<RangePreset>(initialRange.preset);
  const [businessDateFrom, setBusinessDateFrom] = useState(initialRange.businessDateFrom);
  const [businessDateTo, setBusinessDateTo] = useState(initialRange.businessDateTo);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all");
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceStateFilter>("all");
  const [shiftStatusFilter, setShiftStatusFilter] = useState<ShiftStatusFilter>("all");
  const [selectedFlags, setSelectedFlags] = useState<FlagFilter[]>([]);
  const [expandedEmployeeIds, setExpandedEmployeeIds] = useState<string[]>([]);
  const canManageTime =
    effectivePermissions.includes(PERMISSIONS.EMPLOYEE_WRITE) ||
    effectivePermissions.includes(PERMISSIONS.SCHEDULE_WRITE);
  const timeLogsQuery = usePropertyTimeLogs(property.id, {
    businessDateFrom,
    businessDateTo,
    employeeId: selectedEmployeeId === "all" ? undefined : selectedEmployeeId,
    flags: selectedFlags,
    status: shiftStatusFilter === "all" ? undefined : shiftStatusFilter,
  });
  const createManualShiftMutation = useCreateManualShift(property.id);
  const adjustShiftMutation = useAdjustShift(property.id);
  const [manualBreaks, setManualBreaks] = useState<EditableBreak[]>([]);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [editBreaks, setEditBreaks] = useState<EditableBreak[]>([]);
  const [manualForm, setManualForm] = useState({
    employeeId: workforce[0]?.id ?? "",
    startedAt: "",
    endedAt: "",
    payableMinutes: "",
    reason: "",
  });
  const [editForm, setEditForm] = useState({
    startedAt: "",
    endedAt: "",
    payableMinutes: "",
    reason: "",
  });

  useEffect(() => {
    if (!manualForm.employeeId && workforce[0]?.id) {
      setManualForm((current) => ({ ...current, employeeId: workforce[0]?.id ?? "" }));
    }
  }, [manualForm.employeeId, workforce]);

  useEffect(() => {
    if (rangePreset === "current_period" && currentPayPeriod) {
      setBusinessDateFrom(currentPayPeriod.startDate);
      setBusinessDateTo(currentPayPeriod.endDate);
    }
  }, [currentPayPeriod, rangePreset]);

  const propertyEmployeeNames = new Map(workforce.map((employee) => [employee.id, employee.name]));
  const activeError = timeLogsQuery.error ?? createManualShiftMutation.error ?? adjustShiftMutation.error ?? null;
  const employeeRows = timeLogsQuery.data?.employeeRows ?? [];
  const visibleEmployeeRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return employeeRows.filter((employee) => {
      const matchesSearch =
        normalizedQuery.length === 0 ||
        employee.name.toLowerCase().includes(normalizedQuery) ||
        employee.employeeId.toLowerCase().includes(normalizedQuery);
      const matchesAttendance = attendanceFilter === "all" ? true : employee.attendanceState === attendanceFilter;
      const matchesFlags =
        selectedFlags.length === 0
          ? true
          : selectedFlags.some((flag) => {
              if (flag === "manual") {
                return employee.flagCounts.manual > 0;
              }

              if (flag === "edited") {
                return employee.flagCounts.edited > 0;
              }

              if (flag === "auto_closed") {
                return employee.flagCounts.autoClosed > 0;
              }

              return employee.flagCounts.locked > 0;
            });

      return matchesSearch && matchesAttendance && matchesFlags;
    });
  }, [attendanceFilter, employeeRows, searchQuery, selectedFlags]);
  const visibleShifts = useMemo(
    () => visibleEmployeeRows.flatMap((employee) => employee.shifts),
    [visibleEmployeeRows]
  );
  const summary = useMemo(() => {
    const totalPayableMinutes = visibleShifts.reduce((sum, shift) => sum + shift.payableMinutes, 0);
    const totalOvertimeMinutes = visibleEmployeeRows.reduce((sum, employee) => sum + employee.overtimeMinutes, 0);
    const openShiftCount = visibleEmployeeRows.filter((employee) => employee.attendanceState === "clocked-in").length;
    const exceptionCount = visibleShifts.filter(
      (shift) => shift.flags.manual || shift.flags.edited || shift.flags.autoClosed || shift.flags.locked
    ).length;

    return {
      totalPayableHours: totalPayableMinutes / 60,
      employeesWorked: visibleEmployeeRows.filter((employee) => employee.shiftCount > 0).length,
      openShifts: openShiftCount,
      exceptionCount,
      averageShiftLengthHours: visibleShifts.length > 0 ? totalPayableMinutes / 60 / visibleShifts.length : 0,
      overtimeHours: totalOvertimeMinutes / 60,
      shiftCount: visibleShifts.length,
    };
  }, [visibleEmployeeRows, visibleShifts]);
  const visibleTrend = useMemo(() => {
    const grouped = new Map<string, { label: string; payableMinutes: number }>();

    for (const shift of visibleShifts) {
      const currentValue = grouped.get(shift.businessDate) ?? {
        payableMinutes: 0,
        label: new Intl.DateTimeFormat("en-US", {
          timeZone: "UTC",
          month: "short",
          day: "numeric",
        }).format(new Date(`${shift.businessDate}T00:00:00.000Z`)),
      };
      currentValue.payableMinutes += shift.payableMinutes;
      grouped.set(shift.businessDate, currentValue);
    }

    return Array.from(grouped.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, value]) => ({
        label: value.label,
        hours: Number((value.payableMinutes / 60).toFixed(1)),
      }));
  }, [visibleShifts]);
  const exceptionSummary = useMemo(
    () =>
      visibleShifts.reduce(
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
      ),
    [visibleShifts]
  );
  const editingShift = useMemo(
    () => visibleShifts.find((shift) => shift.shiftSessionId === editingShiftId) ?? null,
    [editingShiftId, visibleShifts]
  );

  const setBreakField = (
    setter: Dispatch<SetStateAction<EditableBreak[]>>,
    id: string,
    field: keyof EditableBreak,
    value: string | boolean
  ) => {
    setter((current) => current.map((segment) => (segment.id === id ? { ...segment, [field]: value } : segment)));
  };

  const normalizeBreaks = (breaks: EditableBreak[]): ShiftBreakInput[] | null => {
    const normalized = breaks
      .filter((segment) => segment.startedAt && segment.endedAt)
      .map((segment) => ({
        breakType: segment.breakType,
        paid: segment.paid,
        startedAt: toIsoOrNull(segment.startedAt)!,
        endedAt: toIsoOrNull(segment.endedAt),
      }));

    return normalized.length > 0 ? normalized : null;
  };

  const updateRangePreset = (value: RangePreset) => {
    setRangePreset(value);

    if (value === "today") {
      const today = formatDateOnly(new Date());
      setBusinessDateFrom(today);
      setBusinessDateTo(today);
      return;
    }

    if (value === "last_7") {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 6);
      setBusinessDateFrom(formatDateOnly(startDate));
      setBusinessDateTo(formatDateOnly(today));
      return;
    }

    if (value === "current_period" && currentPayPeriod) {
      setBusinessDateFrom(currentPayPeriod.startDate);
      setBusinessDateTo(currentPayPeriod.endDate);
    }
  };

  const toggleExpandedEmployee = (employeeId: string) => {
    setExpandedEmployeeIds((current) =>
      current.includes(employeeId) ? current.filter((value) => value !== employeeId) : [...current, employeeId]
    );
  };

  const toggleFlag = (flag: FlagFilter) => {
    setSelectedFlags((current) =>
      current.includes(flag) ? current.filter((value) => value !== flag) : [...current, flag]
    );
  };

  const submitManualShift = () => {
    if (!manualForm.employeeId || !manualForm.startedAt || !manualForm.endedAt || !manualForm.reason.trim()) {
      return;
    }

    createManualShiftMutation.mutate(
      {
        organizationId: property.organizationId,
        propertyId: property.id,
        employeeId: manualForm.employeeId,
        startedAt: toIsoOrNull(manualForm.startedAt)!,
        endedAt: toIsoOrNull(manualForm.endedAt)!,
        payableMinutes: manualForm.payableMinutes ? Number.parseInt(manualForm.payableMinutes, 10) || null : null,
        reason: manualForm.reason.trim(),
        breakSegments: normalizeBreaks(manualBreaks),
      },
      {
        onSuccess: () => {
          setManualForm((current) => ({
            ...current,
            startedAt: "",
            endedAt: "",
            payableMinutes: "",
            reason: "",
          }));
          setManualBreaks([]);
        },
      }
    );
  };

  const startEditingShift = (shift: PropertyTimeLogShift) => {
    setEditingShiftId(shift.shiftSessionId);
    setEditForm({
      startedAt: toDateTimeLocalValue(shift.startedAt),
      endedAt: toDateTimeLocalValue(shift.endedAt),
      payableMinutes: "",
      reason: "",
    });
    setEditBreaks(
      shift.breaks.map((segment) => ({
        id: segment.id,
        breakType: segment.breakType,
        paid: segment.paid,
        startedAt: toDateTimeLocalValue(segment.startedAt),
        endedAt: toDateTimeLocalValue(segment.endedAt),
      }))
    );
  };

  const saveEdit = () => {
    if (!editingShift || !editForm.reason.trim()) {
      return;
    }

    adjustShiftMutation.mutate(
      {
        organizationId: property.organizationId,
        shiftSessionId: editingShift.shiftSessionId,
        startedAt: toIsoOrNull(editForm.startedAt),
        endedAt: toIsoOrNull(editForm.endedAt),
        payableMinutes: editForm.payableMinutes ? Number.parseInt(editForm.payableMinutes, 10) || null : null,
        reason: editForm.reason.trim(),
        breakSegments: normalizeBreaks(editBreaks),
      },
      {
        onSuccess: () => {
          setEditingShiftId(null);
          setEditBreaks([]);
          setEditForm({
            startedAt: "",
            endedAt: "",
            payableMinutes: "",
            reason: "",
          });
        },
      }
    );
  };

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Attendance analytics</CardTitle>
          <CardDescription>
            Current window {businessDateFrom} to {businessDateTo}
            {currentPayPeriod ? ` · Pay period ${currentPayPeriod.label}` : ""} · Property timezone {property.timezone}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard label="Payable hours" value={formatHours(summary.totalPayableHours)} detail={`${summary.shiftCount} shifts in range`} />
          <MetricCard label="Employees worked" value={String(summary.employeesWorked)} detail="Employees with at least one shift" />
          <MetricCard label="Open shifts" value={String(summary.openShifts)} detail="Employees currently clocked in" />
          <MetricCard label="Exceptions" value={String(summary.exceptionCount)} detail="Manual, edited, auto-closed, or locked shifts" />
          <MetricCard label="Average shift" value={formatHours(summary.averageShiftLengthHours)} detail="Average payable time per shift" />
          <MetricCard label="Overtime" value={formatHours(summary.overtimeHours)} detail="Selected range overtime total" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Switch the analysis window, narrow the roster, and focus on flagged time with server-backed employee and shift-state filters.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[180px_220px_220px_220px_1fr]">
            <div className="space-y-2">
              <Label>Range</Label>
              <Select value={rangePreset} onValueChange={(value) => updateRangePreset(value as RangePreset)}>
                <SelectTrigger>
                  <SelectValue placeholder="Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="last_7">Last 7 days</SelectItem>
                  <SelectItem value="current_period" disabled={!currentPayPeriod}>
                    Current pay period
                  </SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={selectedEmployeeId} onValueChange={(value) => setSelectedEmployeeId(value ?? "all")}>
                <SelectTrigger>
                  <SelectValue placeholder="Employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {workforce.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Attendance</Label>
              <Select value={attendanceFilter} onValueChange={(value) => setAttendanceFilter(value as AttendanceStateFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Attendance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="clocked-in">Clocked in</SelectItem>
                  <SelectItem value="worked">Worked</SelectItem>
                  <SelectItem value="no-hours">No hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Shift state</Label>
              <Select value={shiftStatusFilter} onValueChange={(value) => setShiftStatusFilter(value as ShiftStatusFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Shift state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All shifts</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="edited">Edited</SelectItem>
                  <SelectItem value="auto_closed">Auto-closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Employee search</Label>
              <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search employee" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Business date from</Label>
              <Input
                type="date"
                value={businessDateFrom}
                onChange={(event) => {
                  setRangePreset("custom");
                  setBusinessDateFrom(event.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Business date to</Label>
              <Input
                type="date"
                value={businessDateTo}
                onChange={(event) => {
                  setRangePreset("custom");
                  setBusinessDateTo(event.target.value);
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Flags</Label>
            <div className="flex flex-wrap gap-2">
              {([
                { label: "Manual", value: "manual" },
                { label: "Edited", value: "edited" },
                { label: "Auto-closed", value: "auto_closed" },
                { label: "Locked", value: "locked" },
              ] as Array<{ label: string; value: FlagFilter }>).map((flag) => (
                <Button
                  key={flag.value}
                  type="button"
                  size="sm"
                  variant={selectedFlags.includes(flag.value) ? "default" : "outline"}
                  onClick={() => toggleFlag(flag.value)}
                >
                  {flag.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {activeError ? (
        <Card className="border-destructive/40">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{activeError.message}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <TimeTrendChart
          trend={visibleTrend}
          title="Daily hours trend"
          description="Payable hours per business date in the current filter."
        />
        <ExceptionSummaryCard summary={exceptionSummary} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee time ledger</CardTitle>
          <CardDescription>
            Each row rolls up one employee. Expand a row to inspect every underlying shift and payroll lock.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {timeLogsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading time analytics…</p>
          ) : visibleEmployeeRows.length > 0 ? (
            visibleEmployeeRows.map((employee) => {
              const isExpanded = expandedEmployeeIds.includes(employee.employeeId);

              return (
                <div key={employee.employeeId} className="rounded-3xl border border-border bg-card">
                  <button
                    type="button"
                    className="w-full px-5 py-5 text-left"
                    onClick={() => toggleExpandedEmployee(employee.employeeId)}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <p className="text-lg font-semibold text-foreground">{employee.name}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant={employee.attendanceState === "clocked-in" ? "default" : "outline"}>
                            {employee.attendanceState}
                          </Badge>
                          {employee.flagCounts.manual > 0 ? <Badge variant="outline">{employee.flagCounts.manual} manual</Badge> : null}
                          {employee.flagCounts.edited > 0 ? <Badge variant="secondary">{employee.flagCounts.edited} edited</Badge> : null}
                          {employee.flagCounts.autoClosed > 0 ? (
                            <Badge variant="secondary">{employee.flagCounts.autoClosed} auto-closed</Badge>
                          ) : null}
                          {employee.flagCounts.locked > 0 ? <Badge variant="secondary">{employee.flagCounts.locked} locked</Badge> : null}
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total hours</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{formatHours(employee.totalHours)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Overtime</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{formatHours(employee.overtimeHours)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Shifts</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{employee.shiftCount}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Latest activity</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{formatDateTime(employee.latestActivityAt)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Exceptions</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{employee.exceptionCount}</p>
                        </div>
                      </div>
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="border-t border-border px-5 py-5">
                      {employee.shifts.length > 0 ? (
                        <div className="space-y-3">
                          {employee.shifts.map((shift) => (
                            <EmployeeShiftRow key={shift.shiftSessionId} canManageTime={canManageTime} onEdit={startEditingShift} shift={shift} />
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No shifts in the selected range.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">No employees match the current time filters.</p>
          )}
        </CardContent>
      </Card>

      {canManageTime ? (
        <Card>
          <CardHeader>
            <CardTitle>Manual shift entry</CardTitle>
            <CardDescription>
              Create a closed manual shift with an audit reason for this property. Business date is derived from the start time in {property.timezone}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select
                  value={manualForm.employeeId}
                  onValueChange={(value) => setManualForm((current) => ({ ...current, employeeId: value ?? "" }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select employee">{propertyEmployeeNames.get(manualForm.employeeId)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {workforce.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Started at</Label>
                <Input
                  type="datetime-local"
                  value={manualForm.startedAt}
                  onChange={(event) => setManualForm((current) => ({ ...current, startedAt: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Ended at</Label>
                <Input
                  type="datetime-local"
                  value={manualForm.endedAt}
                  onChange={(event) => setManualForm((current) => ({ ...current, endedAt: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Payable minutes override</Label>
                <Input
                  type="number"
                  min={0}
                  value={manualForm.payableMinutes}
                  onChange={(event) => setManualForm((current) => ({ ...current, payableMinutes: event.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                value={manualForm.reason}
                onChange={(event) => setManualForm((current) => ({ ...current, reason: event.target.value }))}
                placeholder="Why this shift is being added manually"
              />
            </div>

            <BreakEditor
              breaks={manualBreaks}
              onAdd={() =>
                setManualBreaks((current) => [
                  ...current,
                  {
                    id: createBreakId(),
                    breakType: "meal",
                    paid: false,
                    startedAt: "",
                    endedAt: "",
                  },
                ])
              }
              onChange={(id, field, value) => setBreakField(setManualBreaks, id, field, value)}
              onRemove={(id) => setManualBreaks((current) => current.filter((segment) => segment.id !== id))}
            />

            <Button type="button" onClick={submitManualShift} disabled={createManualShiftMutation.isPending}>
              {createManualShiftMutation.isPending ? "Creating..." : "Add manual shift"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {editingShift ? (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Edit shift</CardTitle>
            <CardDescription>
              Adjust shift timing, break segments, or payable minutes. Finalized payroll periods must be reopened first, and business date follows the start time in {property.timezone}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Started at</Label>
                <Input
                  type="datetime-local"
                  value={editForm.startedAt}
                  onChange={(event) => setEditForm((current) => ({ ...current, startedAt: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Ended at</Label>
                <Input
                  type="datetime-local"
                  value={editForm.endedAt}
                  onChange={(event) => setEditForm((current) => ({ ...current, endedAt: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Payable minutes override</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.payableMinutes}
                  onChange={(event) => setEditForm((current) => ({ ...current, payableMinutes: event.target.value }))}
                  placeholder={
                    editingShift.payableMinutes === null ? "Auto-calculate" : `Current: ${editingShift.payableMinutes}`
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                value={editForm.reason}
                onChange={(event) => setEditForm((current) => ({ ...current, reason: event.target.value }))}
                placeholder="Why this shift is being edited"
              />
            </div>

            <BreakEditor
              breaks={editBreaks}
              onAdd={() =>
                setEditBreaks((current) => [
                  ...current,
                  {
                    id: createBreakId(),
                    breakType: "meal",
                    paid: false,
                    startedAt: "",
                    endedAt: "",
                  },
                ])
              }
              onChange={(id, field, value) => setBreakField(setEditBreaks, id, field, value)}
              onRemove={(id) => setEditBreaks((current) => current.filter((segment) => segment.id !== id))}
            />

            <div className="flex gap-3">
              <Button type="button" onClick={saveEdit} disabled={adjustShiftMutation.isPending}>
                {adjustShiftMutation.isPending ? "Saving..." : "Save shift changes"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditingShiftId(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
