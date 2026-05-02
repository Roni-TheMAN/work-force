/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Grip,
  LoaderCircle,
  PencilLine,
  Plus,
  Printer,
  Save,
  Send,
  Trash2,
  UserRoundX,
  X,
} from "lucide-react";

import type {
  CreatePropertyScheduleTemplatePayload,
  CreateShiftPayload,
  PropertyDashboardData,
  PropertyScheduleShift,
  PropertyScheduleShiftStatus,
  PropertyScheduleTemplate,
  PropertyScheduleTemplateShift,
  ScheduleQuickPositionPreset,
  ScheduleQuickTimePreset,
  ScheduleTemplateShiftInput,
} from "@/api/property";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PERMISSIONS } from "@/lib/permissions";
import {
  useApplyPropertyScheduleTemplate,
  useCreatePropertyScheduleTemplate,
  useCreatePropertyScheduleShift,
  useDeletePropertyScheduleTemplate,
  useDeletePropertyScheduleShift,
  usePropertyScheduleTemplates,
  usePropertyScheduleWeek,
  usePublishPropertySchedule,
  useUpdatePropertyScheduleTemplate,
  useUpdatePropertyScheduleShift,
} from "@/hooks/useProperty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type PropertyScheduleProps = {
  organizationId: string;
  permissions: PropertyDashboardData["permissions"];
  property: PropertyDashboardData["property"];
  schedule: PropertyDashboardData["scheduling"];
  workforce: PropertyDashboardData["workforce"];
};

type WeekShiftEditorState =
  | {
      mode: "create";
      seedDate?: string;
      seedEmployeeId?: string;
      seedPositionLabel?: string;
      seedStatus?: PropertyScheduleShiftStatus;
    }
  | {
      mode: "edit";
      shiftId: string;
    };

type TemplateShiftEditorState =
  | {
      mode: "create";
      seedDayIndex?: number;
      seedEmployeeId?: string;
    }
  | {
      mode: "edit";
      shiftId: string;
    };

type WeekShiftFormState = {
  breakMinutes: string;
  date: string;
  employeeId: string;
  endTime: string;
  notes: string;
  positionLabel: string;
  startTime: string;
  status: PropertyScheduleShiftStatus;
};

type TemplateShiftFormState = {
  breakMinutes: string;
  dayIndex: string;
  employeeId: string;
  endTime: string;
  notes: string;
  positionLabel: string;
  startTime: string;
  status: PropertyScheduleShiftStatus;
};

type PresetDragData =
  | {
      preset: ScheduleQuickTimePreset;
      type: "time";
    }
  | {
      preset: ScheduleQuickPositionPreset;
      type: "position";
    };

type PendingPositionPresetChoice =
  | {
      date: string;
      employeeId: string;
      employeeName: string;
      mode: "week";
      positionLabel: string;
    }
  | {
      dayIndex: number;
      dayLabel: string;
      employeeId: string;
      employeeName: string;
      mode: "template";
      positionLabel: string;
      templateId: string;
    };

type EmployeeOption = {
  id: string;
  label: string;
};

type ScheduleRoleTone =
  | "housekeeping"
  | "frontDesk"
  | "sales"
  | "breakfast"
  | "maintenance"
  | "nightAudit"
  | "management"
  | "default";

const gridColumnTemplate = "240px repeat(7, minmax(0, 1fr))";
const SHIFT_HOVER_PREVIEW_DELAY_MS = 1800;

type ShiftPreviewData = {
  breakMinutes: number;
  dateLabel?: string | null;
  employeeName: string | null;
  isOvernight: boolean;
  notes: string | null;
  positionLabel: string | null;
  status: PropertyScheduleShiftStatus;
  timeLabel: string;
};

const scheduleRoleToneClasses: Record<
  ScheduleRoleTone,
  {
    badge: string;
    chip: string;
    chipActive: string;
    stripe: string;
    surface: string;
    surfaceActive: string;
    surfaceHover: string;
  }
> = {
  housekeeping: {
    badge:
      "border-[hsl(var(--schedule-role-housekeeping)/0.2)] bg-[hsl(var(--schedule-role-housekeeping)/0.14)]",
    chip:
      "border-[hsl(var(--schedule-role-housekeeping)/0.2)] bg-[hsl(var(--schedule-role-housekeeping)/0.12)] hover:bg-[hsl(var(--schedule-role-housekeeping)/0.18)]",
    chipActive: "ring-2 ring-[hsl(var(--schedule-role-housekeeping)/0.18)]",
    stripe: "bg-[hsl(var(--schedule-role-housekeeping)/0.85)]",
    surface:
      "border-[hsl(var(--schedule-role-housekeeping)/0.2)] bg-[hsl(var(--schedule-role-housekeeping)/0.1)]",
    surfaceActive:
      "border-[hsl(var(--schedule-role-housekeeping)/0.32)] bg-[hsl(var(--schedule-role-housekeeping)/0.18)]",
    surfaceHover: "hover:bg-[hsl(var(--schedule-role-housekeeping)/0.14)]",
  },
  frontDesk: {
    badge: "border-[hsl(var(--schedule-role-front-desk)/0.2)] bg-[hsl(var(--schedule-role-front-desk)/0.14)]",
    chip:
      "border-[hsl(var(--schedule-role-front-desk)/0.2)] bg-[hsl(var(--schedule-role-front-desk)/0.12)] hover:bg-[hsl(var(--schedule-role-front-desk)/0.18)]",
    chipActive: "ring-2 ring-[hsl(var(--schedule-role-front-desk)/0.18)]",
    stripe: "bg-[hsl(var(--schedule-role-front-desk)/0.85)]",
    surface: "border-[hsl(var(--schedule-role-front-desk)/0.2)] bg-[hsl(var(--schedule-role-front-desk)/0.1)]",
    surfaceActive:
      "border-[hsl(var(--schedule-role-front-desk)/0.32)] bg-[hsl(var(--schedule-role-front-desk)/0.18)]",
    surfaceHover: "hover:bg-[hsl(var(--schedule-role-front-desk)/0.14)]",
  },
  sales: {
    badge: "border-[hsl(var(--schedule-role-sales)/0.2)] bg-[hsl(var(--schedule-role-sales)/0.14)]",
    chip:
      "border-[hsl(var(--schedule-role-sales)/0.2)] bg-[hsl(var(--schedule-role-sales)/0.12)] hover:bg-[hsl(var(--schedule-role-sales)/0.18)]",
    chipActive: "ring-2 ring-[hsl(var(--schedule-role-sales)/0.18)]",
    stripe: "bg-[hsl(var(--schedule-role-sales)/0.85)]",
    surface: "border-[hsl(var(--schedule-role-sales)/0.2)] bg-[hsl(var(--schedule-role-sales)/0.1)]",
    surfaceActive:
      "border-[hsl(var(--schedule-role-sales)/0.32)] bg-[hsl(var(--schedule-role-sales)/0.18)]",
    surfaceHover: "hover:bg-[hsl(var(--schedule-role-sales)/0.14)]",
  },
  breakfast: {
    badge: "border-[hsl(var(--schedule-role-breakfast)/0.2)] bg-[hsl(var(--schedule-role-breakfast)/0.14)]",
    chip:
      "border-[hsl(var(--schedule-role-breakfast)/0.2)] bg-[hsl(var(--schedule-role-breakfast)/0.12)] hover:bg-[hsl(var(--schedule-role-breakfast)/0.18)]",
    chipActive: "ring-2 ring-[hsl(var(--schedule-role-breakfast)/0.18)]",
    stripe: "bg-[hsl(var(--schedule-role-breakfast)/0.85)]",
    surface: "border-[hsl(var(--schedule-role-breakfast)/0.2)] bg-[hsl(var(--schedule-role-breakfast)/0.1)]",
    surfaceActive:
      "border-[hsl(var(--schedule-role-breakfast)/0.32)] bg-[hsl(var(--schedule-role-breakfast)/0.18)]",
    surfaceHover: "hover:bg-[hsl(var(--schedule-role-breakfast)/0.14)]",
  },
  maintenance: {
    badge: "border-[hsl(var(--schedule-role-maintenance)/0.2)] bg-[hsl(var(--schedule-role-maintenance)/0.14)]",
    chip:
      "border-[hsl(var(--schedule-role-maintenance)/0.2)] bg-[hsl(var(--schedule-role-maintenance)/0.12)] hover:bg-[hsl(var(--schedule-role-maintenance)/0.18)]",
    chipActive: "ring-2 ring-[hsl(var(--schedule-role-maintenance)/0.18)]",
    stripe: "bg-[hsl(var(--schedule-role-maintenance)/0.82)]",
    surface:
      "border-[hsl(var(--schedule-role-maintenance)/0.18)] bg-[hsl(var(--schedule-role-maintenance)/0.1)]",
    surfaceActive:
      "border-[hsl(var(--schedule-role-maintenance)/0.28)] bg-[hsl(var(--schedule-role-maintenance)/0.16)]",
    surfaceHover: "hover:bg-[hsl(var(--schedule-role-maintenance)/0.14)]",
  },
  nightAudit: {
    badge:
      "border-[hsl(var(--schedule-role-night-audit)/0.2)] bg-[hsl(var(--schedule-role-night-audit)/0.14)]",
    chip:
      "border-[hsl(var(--schedule-role-night-audit)/0.2)] bg-[hsl(var(--schedule-role-night-audit)/0.12)] hover:bg-[hsl(var(--schedule-role-night-audit)/0.18)]",
    chipActive: "ring-2 ring-[hsl(var(--schedule-role-night-audit)/0.18)]",
    stripe: "bg-[hsl(var(--schedule-role-night-audit)/0.85)]",
    surface:
      "border-[hsl(var(--schedule-role-night-audit)/0.2)] bg-[hsl(var(--schedule-role-night-audit)/0.1)]",
    surfaceActive:
      "border-[hsl(var(--schedule-role-night-audit)/0.32)] bg-[hsl(var(--schedule-role-night-audit)/0.18)]",
    surfaceHover: "hover:bg-[hsl(var(--schedule-role-night-audit)/0.14)]",
  },
  management: {
    badge: "border-[hsl(var(--schedule-role-management)/0.18)] bg-[hsl(var(--schedule-role-management)/0.14)]",
    chip:
      "border-[hsl(var(--schedule-role-management)/0.18)] bg-[hsl(var(--schedule-role-management)/0.12)] hover:bg-[hsl(var(--schedule-role-management)/0.16)]",
    chipActive: "ring-2 ring-[hsl(var(--schedule-role-management)/0.18)]",
    stripe: "bg-[hsl(var(--schedule-role-management)/0.78)]",
    surface: "border-[hsl(var(--schedule-role-management)/0.18)] bg-[hsl(var(--schedule-role-management)/0.1)]",
    surfaceActive:
      "border-[hsl(var(--schedule-role-management)/0.28)] bg-[hsl(var(--schedule-role-management)/0.16)]",
    surfaceHover: "hover:bg-[hsl(var(--schedule-role-management)/0.14)]",
  },
  default: {
    badge: "border-[hsl(var(--schedule-role-default)/0.18)] bg-[hsl(var(--schedule-role-default)/0.12)]",
    chip:
      "border-[hsl(var(--schedule-role-default)/0.18)] bg-[hsl(var(--schedule-role-default)/0.1)] hover:bg-[hsl(var(--schedule-role-default)/0.16)]",
    chipActive: "ring-2 ring-[hsl(var(--schedule-role-default)/0.16)]",
    stripe: "bg-[hsl(var(--schedule-role-default)/0.72)]",
    surface: "border-[hsl(var(--schedule-role-default)/0.16)] bg-[hsl(var(--schedule-role-default)/0.08)]",
    surfaceActive:
      "border-[hsl(var(--schedule-role-default)/0.24)] bg-[hsl(var(--schedule-role-default)/0.14)]",
    surfaceHover: "hover:bg-[hsl(var(--schedule-role-default)/0.12)]",
  },
};

function formatDateOnlyLabel(value: string) {
  return new Date(`${value}T12:00:00.000Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function shiftWeekStartDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getScheduleErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong while updating the schedule.";
}

function createEmptyWeekShiftForm(seed: {
  date: string;
  employeeId?: string | null;
  positionLabel?: string | null;
  status?: PropertyScheduleShiftStatus;
}): WeekShiftFormState {
  return {
    breakMinutes: "0",
    date: seed.date,
    employeeId: seed.employeeId ?? "",
    endTime: "17:00",
    notes: "",
    positionLabel: seed.positionLabel ?? "",
    startTime: "09:00",
    status: seed.status ?? "scheduled",
  };
}

function createWeekShiftFormFromExistingShift(shift: PropertyScheduleShift): WeekShiftFormState {
  return {
    breakMinutes: String(shift.breakMinutes),
    date: shift.date,
    employeeId: shift.employeeId ?? "",
    endTime: shift.endTime,
    notes: shift.notes ?? "",
    positionLabel: shift.positionLabel ?? "",
    startTime: shift.startTime,
    status: shift.status,
  };
}

function createEmptyTemplateShiftForm(seed: {
  dayIndex: number;
  employeeId?: string | null;
}): TemplateShiftFormState {
  return {
    breakMinutes: "0",
    dayIndex: String(seed.dayIndex),
    employeeId: seed.employeeId ?? "",
    endTime: "17:00",
    notes: "",
    positionLabel: "",
    startTime: "09:00",
    status: "scheduled",
  };
}

function createTemplateShiftFormFromExistingShift(shift: PropertyScheduleTemplateShift): TemplateShiftFormState {
  return {
    breakMinutes: String(shift.breakMinutes),
    dayIndex: String(shift.dayIndex),
    employeeId: shift.employeeId ?? "",
    endTime: shift.endTime,
    notes: shift.notes ?? "",
    positionLabel: shift.positionLabel ?? "",
    startTime: shift.startTime,
    status: shift.status,
  };
}

function resolveScheduleRoleTone(positionLabel?: string | null): ScheduleRoleTone {
  const normalizedLabel = positionLabel?.trim().toLowerCase();

  if (!normalizedLabel) {
    return "default";
  }

  if (normalizedLabel.includes("housekeep")) {
    return "housekeeping";
  }

  if (normalizedLabel.includes("front desk") || normalizedLabel.includes("frontdesk") || normalizedLabel.includes("reception")) {
    return "frontDesk";
  }

  if (normalizedLabel.includes("sales")) {
    return "sales";
  }

  if (normalizedLabel.includes("breakfast")) {
    return "breakfast";
  }

  if (normalizedLabel.includes("maint")) {
    return "maintenance";
  }

  if (normalizedLabel.includes("night audit") || normalizedLabel.includes("nightaudit")) {
    return "nightAudit";
  }

  if (
    normalizedLabel.includes("management") ||
    normalizedLabel.includes("manager") ||
    normalizedLabel.includes("supervisor")
  ) {
    return "management";
  }

  return "default";
}

function getScheduleRoleToneClasses(positionLabel?: string | null) {
  return scheduleRoleToneClasses[resolveScheduleRoleTone(positionLabel)];
}

function getShiftStatusBadgeClass(status: PropertyScheduleShiftStatus) {
  if (status === "scheduled") {
    return "border-[hsl(var(--schedule-status-scheduled)/0.22)] bg-[hsl(var(--schedule-status-scheduled)/0.12)] text-foreground";
  }

  if (status === "open") {
    return "border-border bg-secondary/90 text-secondary-foreground";
  }

  return "border-border bg-muted/80 text-muted-foreground";
}

function getEmployeeStatusDotClass(employmentStatus: string) {
  return employmentStatus.trim().toLowerCase() === "active"
    ? "bg-[hsl(var(--schedule-status-scheduled))]"
    : "bg-muted-foreground/60";
}

function isArchivedEmploymentStatus(employmentStatus?: string | null) {
  return employmentStatus?.trim().toLowerCase() === "archived";
}

function getScheduleStateBadgeClass(status: "draft" | "published") {
  if (status === "published") {
    return "border-primary/20 bg-primary-soft text-foreground";
  }

  return "border-border bg-secondary text-secondary-foreground";
}

function buildEmployeeOptions(
  employees: PropertyDashboardData["workforce"],
  fallback?: { employeeId?: string | null; employeeName?: string | null; employmentStatus?: string | null }
) {
  const options = new Map<string, EmployeeOption>();

  for (const employee of employees) {
    if (employee.employmentStatus.trim().toLowerCase() !== "active") {
      continue;
    }

    options.set(employee.id, {
      id: employee.id,
      label: employee.name,
    });
  }

  if (fallback?.employeeId && fallback.employeeName && !options.has(fallback.employeeId)) {
    options.set(fallback.employeeId, {
      id: fallback.employeeId,
      label:
        fallback.employmentStatus?.trim().toLowerCase() === "active"
          ? fallback.employeeName
          : `${fallback.employeeName} (inactive)`,
    });
  }

  return [...options.values()].sort((left, right) => left.label.localeCompare(right.label));
}

function serializeTemplateShift(shift: PropertyScheduleTemplateShift): ScheduleTemplateShiftInput {
  return {
    breakMinutes: shift.breakMinutes,
    dayIndex: shift.dayIndex,
    employeeId: shift.employeeId,
    endMinutes: shift.endMinutes,
    id: shift.id,
    isOvernight: shift.isOvernight,
    notes: shift.notes,
    positionLabel: shift.positionLabel,
    startMinutes: shift.startMinutes,
    status: shift.status,
  };
}

function serializeTemplateShiftFromForm(formState: TemplateShiftFormState): ScheduleTemplateShiftInput {
  const [startHours, startMinutes] = formState.startTime.split(":").map((segment) => Number.parseInt(segment, 10));
  const [endHours, endMinutes] = formState.endTime.split(":").map((segment) => Number.parseInt(segment, 10));
  const startTotal = startHours * 60 + startMinutes;
  const endTotal = endHours * 60 + endMinutes;

  return {
    breakMinutes: Number.parseInt(formState.breakMinutes, 10),
    dayIndex: Number.parseInt(formState.dayIndex, 10),
    employeeId: formState.status === "open" ? null : formState.employeeId || null,
    endMinutes: endTotal,
    isOvernight: endTotal <= startTotal,
    notes: formState.notes || null,
    positionLabel: formState.positionLabel || null,
    startMinutes: startTotal,
    status: formState.status,
  };
}

function buildApplySummaryMessage(
  summary: {
    appliedShiftCount: number;
    skippedItems: Array<{ reason: string }>;
    skippedShiftCount: number;
  },
  templateName: string
) {
  if (summary.skippedShiftCount === 0) {
    return `Loaded ${templateName} into this week with ${summary.appliedShiftCount} shifts.`;
  }

  const reasonCounts = summary.skippedItems.reduce<Record<string, number>>((counts, item) => {
    counts[item.reason] = (counts[item.reason] ?? 0) + 1;
    return counts;
  }, {});
  const reasonLabel = Object.entries(reasonCounts)
    .map(([reason, count]) => `${count} ${reason.replaceAll("_", " ")}`)
    .join(", ");

  return `Loaded ${templateName} with ${summary.appliedShiftCount} shifts. Skipped ${summary.skippedShiftCount}: ${reasonLabel}.`;
}

function parseTimeValueToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((segment) => Number.parseInt(segment, 10));
  return hours * 60 + minutes;
}

function createTemplateShiftInputFromPreset({
  dayIndex,
  employeeId,
  positionLabel,
  preset,
}: {
  dayIndex: number;
  employeeId: string | null;
  positionLabel?: string | null;
  preset: ScheduleQuickTimePreset;
}): ScheduleTemplateShiftInput {
  const startMinutes = parseTimeValueToMinutes(preset.startTime);
  const endMinutes = parseTimeValueToMinutes(preset.endTime);

  return {
    breakMinutes: 0,
    dayIndex,
    employeeId,
    endMinutes,
    isOvernight: endMinutes <= startMinutes,
    notes: null,
    positionLabel: positionLabel ?? null,
    startMinutes,
    status: "scheduled",
  };
}

function PresetChip({
  disabled,
  isActive,
  label,
  onDragEnd,
  onDragStart,
  tone,
}: {
  disabled: boolean;
  isActive?: boolean;
  label: string;
  onDragEnd: () => void;
  onDragStart: () => void;
  tone?: ScheduleRoleTone;
}) {
  const toneClasses = tone ? scheduleRoleToneClasses[tone] : null;

  return (
    <button
      type="button"
      draggable={!disabled}
      onDragStart={disabled ? undefined : onDragStart}
      onDragEnd={disabled ? undefined : onDragEnd}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-foreground transition-all duration-150",
        toneClasses ? toneClasses.chip : "border-border bg-background hover:bg-muted/40",
        isActive && (toneClasses ? toneClasses.chipActive : "border-border bg-secondary ring-2 ring-ring/15"),
        disabled ? "cursor-not-allowed opacity-50" : "cursor-grab shadow-none"
      )}
    >
      <Grip className="size-3.5 text-muted-foreground" />
      {label}
    </button>
  );
}

function useDelayedShiftPreview() {
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  function clearPreviewTimer() {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function closePreview() {
    clearPreviewTimer();
    setIsOpen(false);
    setPosition(null);
  }

  function openPreviewWithDelay() {
    clearPreviewTimer();
    timeoutRef.current = window.setTimeout(() => {
      const rect = anchorRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const previewWidth = 288;
      const viewportPadding = 16;
      const left = Math.min(
        Math.max(rect.left + rect.width / 2, previewWidth / 2 + viewportPadding),
        window.innerWidth - previewWidth / 2 - viewportPadding,
      );

      setPosition({
        left,
        top: Math.max(viewportPadding, rect.top - 12),
      });
      setIsOpen(true);
    }, SHIFT_HOVER_PREVIEW_DELAY_MS);
  }

  useEffect(() => () => clearPreviewTimer(), []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleViewportChange = () => {
      setIsOpen(false);
      setPosition(null);
    };

    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);

    return () => {
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [isOpen]);

  return {
    anchorRef,
    closePreview,
    isOpen,
    openPreviewWithDelay,
    position,
  };
}

function buildShiftPreviewTitle(preview: ShiftPreviewData) {
  return [
    preview.dateLabel,
    preview.timeLabel,
    preview.employeeName ?? "Open shift",
    preview.positionLabel,
    preview.status.replace("_", " "),
    preview.notes?.trim() ? preview.notes.trim() : null,
  ]
    .filter(Boolean)
    .join(" • ");
}

function ShiftHoverPreviewCard({
  canManageSchedule,
  position,
  preview,
}: {
  canManageSchedule: boolean;
  position: { left: number; top: number };
  preview: ShiftPreviewData;
}) {
  const roleToneClasses = getScheduleRoleToneClasses(preview.positionLabel);

  return (
    <div
      className="pointer-events-none fixed z-[80] hidden w-72 -translate-x-1/2 -translate-y-full rounded-xl border border-border bg-popover/95 shadow-[0_20px_40px_-24px_hsl(var(--foreground)/0.34)] backdrop-blur supports-[backdrop-filter]:bg-popover/90 lg:block"
      style={{ left: position.left, top: position.top }}
    >
      <div className="space-y-3 p-3.5">
        {preview.dateLabel ? (
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            {preview.dateLabel}
          </p>
        ) : null}
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{preview.timeLabel}</p>
          <p className="text-xs text-muted-foreground">{preview.employeeName ?? "Open shift"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn("h-5 rounded-md px-1.5 text-[10px] capitalize", getShiftStatusBadgeClass(preview.status))}
          >
            {preview.status.replace("_", " ")}
          </Badge>
          {preview.positionLabel ? (
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-foreground",
                roleToneClasses.badge,
              )}
            >
              {preview.positionLabel}
            </span>
          ) : null}
          {preview.breakMinutes > 0 ? (
            <span className="inline-flex items-center rounded-md border border-border bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {preview.breakMinutes} min break
            </span>
          ) : null}
          {preview.isOvernight ? (
            <span className="inline-flex items-center rounded-md border border-border bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              Overnight
            </span>
          ) : null}
        </div>
        {preview.notes?.trim() ? (
          <p className="text-xs leading-5 text-muted-foreground">{preview.notes.trim()}</p>
        ) : null}
        <p className="text-[11px] text-muted-foreground">
          {canManageSchedule ? "Click to edit this shift." : "Shift details preview."}
        </p>
      </div>
    </div>
  );
}

function PrintableScheduleShiftList({
  emptyLabel = "No shift",
  shifts,
}: {
  emptyLabel?: string;
  shifts: PropertyScheduleShift[];
}) {
  if (shifts.length === 0) {
    return <p className="text-[9px] leading-4 text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-1.5">
      {shifts.map((shift) => (
        <div key={shift.id} className="break-inside-avoid rounded-md border border-border/80 bg-background px-2 py-1.5">
          <p className="text-[10px] font-semibold leading-4 text-foreground">
            {shift.timeLabel}
            {shift.isOvernight ? " · Overnight" : ""}
          </p>
          {shift.positionLabel ? (
            <p className="mt-0.5 text-[9px] font-medium leading-4 text-foreground">{shift.positionLabel}</p>
          ) : null}
          <p className="mt-0.5 text-[9px] leading-4 text-muted-foreground">
            {shift.status.replace("_", " ")}
            {shift.breakMinutes > 0 ? ` · ${shift.breakMinutes}m break` : ""}
          </p>
          {shift.notes?.trim() ? (
            <p className="mt-1 text-[9px] leading-4 text-muted-foreground">{shift.notes.trim()}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function WeekShiftCard({
  canManageSchedule,
  isDropTarget,
  onDragLeavePreset,
  onDragOverPreset,
  onDropPreset,
  onSelect,
  shift,
}: {
  canManageSchedule: boolean;
  isDropTarget: boolean;
  onDragLeavePreset: () => void;
  onDragOverPreset: (event: React.DragEvent<HTMLButtonElement>) => void;
  onDropPreset: (event: React.DragEvent<HTMLButtonElement>) => void;
  onSelect: (shiftId: string) => void;
  shift: PropertyScheduleShift;
}) {
  const roleToneClasses = getScheduleRoleToneClasses(shift.positionLabel);
  const { anchorRef, closePreview, isOpen, openPreviewWithDelay, position } = useDelayedShiftPreview();
  const preview = {
    breakMinutes: shift.breakMinutes,
    dateLabel: formatDateOnlyLabel(shift.date),
    employeeName: shift.employeeName,
    isOvernight: shift.isOvernight,
    notes: shift.notes,
    positionLabel: shift.positionLabel,
    status: shift.status,
    timeLabel: shift.timeLabel,
  } satisfies ShiftPreviewData;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        title={buildShiftPreviewTitle(preview)}
        onClick={() => onSelect(shift.id)}
        onMouseEnter={openPreviewWithDelay}
        onMouseLeave={closePreview}
        onFocus={openPreviewWithDelay}
        onBlur={closePreview}
        onDragOver={canManageSchedule ? onDragOverPreset : undefined}
        onDragLeave={canManageSchedule ? onDragLeavePreset : undefined}
        onDrop={canManageSchedule ? onDropPreset : undefined}
        className={cn(
          "group relative w-full overflow-hidden rounded-xl border px-2.5 py-2 text-left transition-all duration-150",
          roleToneClasses.surface,
          roleToneClasses.surfaceHover,
          !isDropTarget && "hover:-translate-y-px hover:shadow-[0_8px_18px_-16px_hsl(var(--foreground)/0.28)]",
          isDropTarget && roleToneClasses.surfaceActive
        )}
      >
        <span aria-hidden="true" className={cn("absolute inset-y-1.5 left-1.5 w-0.5 rounded-full", roleToneClasses.stripe)} />
        <div className="flex items-start justify-between gap-2 pl-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-semibold leading-none text-foreground">{shift.timeLabel}</p>
              {canManageSchedule ? (
                <PencilLine className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              ) : null}
            </div>
            <p className="truncate text-xs text-muted-foreground">{shift.employeeName ?? "Open shift"}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={cn("h-5 rounded-md px-1.5 text-[10px] capitalize", getShiftStatusBadgeClass(shift.status))}>
                {shift.status.replace("_", " ")}
              </Badge>
              {shift.positionLabel ? (
                <span
                  className={cn(
                    "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-foreground",
                    roleToneClasses.badge
                  )}
                >
                  {shift.positionLabel}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </button>
      {isOpen && position ? (
        <ShiftHoverPreviewCard canManageSchedule={canManageSchedule} position={position} preview={preview} />
      ) : null}
    </>
  );
}

function TemplateShiftCard({
  canManageSchedule,
  isDropTarget = false,
  onDragLeavePreset,
  onDragOverPreset,
  onDropPreset,
  onSelect,
  shift,
}: {
  canManageSchedule: boolean;
  isDropTarget?: boolean;
  onDragLeavePreset?: () => void;
  onDragOverPreset?: (event: React.DragEvent<HTMLButtonElement>) => void;
  onDropPreset?: (event: React.DragEvent<HTMLButtonElement>) => void;
  onSelect: (shiftId: string) => void;
  shift: PropertyScheduleTemplateShift;
}) {
  const roleToneClasses = getScheduleRoleToneClasses(shift.positionLabel);
  const { anchorRef, closePreview, isOpen, openPreviewWithDelay, position } = useDelayedShiftPreview();
  const preview = {
    breakMinutes: shift.breakMinutes,
    dateLabel: "Template pattern",
    employeeName: shift.employeeName,
    isOvernight: shift.isOvernight,
    notes: shift.notes,
    positionLabel: shift.positionLabel,
    status: shift.status,
    timeLabel: shift.timeLabel,
  } satisfies ShiftPreviewData;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        title={buildShiftPreviewTitle(preview)}
        onClick={() => onSelect(shift.id)}
        onMouseEnter={openPreviewWithDelay}
        onMouseLeave={closePreview}
        onFocus={openPreviewWithDelay}
        onBlur={closePreview}
        onDragOver={canManageSchedule ? onDragOverPreset : undefined}
        onDragLeave={canManageSchedule ? onDragLeavePreset : undefined}
        onDrop={canManageSchedule ? onDropPreset : undefined}
        className={cn(
          "group relative w-full overflow-hidden rounded-xl border px-2.5 py-2 text-left transition-all duration-150",
          roleToneClasses.surface,
          roleToneClasses.surfaceHover,
          !isDropTarget && "hover:-translate-y-px hover:shadow-[0_8px_18px_-16px_hsl(var(--foreground)/0.28)]",
          isDropTarget && roleToneClasses.surfaceActive
        )}
      >
        <span aria-hidden="true" className={cn("absolute inset-y-1.5 left-1.5 w-0.5 rounded-full", roleToneClasses.stripe)} />
        <div className="flex items-start justify-between gap-2 pl-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-semibold leading-none text-foreground">{shift.timeLabel}</p>
              {canManageSchedule ? (
                <PencilLine className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              ) : null}
            </div>
            <p className="truncate text-xs text-muted-foreground">{shift.employeeName ?? "Open shift"}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={cn("h-5 rounded-md px-1.5 text-[10px] capitalize", getShiftStatusBadgeClass(shift.status))}>
                {shift.status.replace("_", " ")}
              </Badge>
              {shift.positionLabel ? (
                <span
                  className={cn(
                    "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-foreground",
                    roleToneClasses.badge
                  )}
                >
                  {shift.positionLabel}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </button>
      {isOpen && position ? (
        <ShiftHoverPreviewCard canManageSchedule={canManageSchedule} position={position} preview={preview} />
      ) : null}
    </>
  );
}

function ScheduleLoadingState() {
  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-64 rounded-xl" />
            <Skeleton className="h-4 w-48 rounded-xl" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-32 rounded-xl" />
            <Skeleton className="h-10 w-28 rounded-xl" />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-20 rounded-2xl" />
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="hidden h-[520px] rounded-2xl lg:block" />
        <div className="space-y-4 lg:hidden">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-36 rounded-2xl" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ScheduleErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Unable to load this schedule</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}

export function PropertySchedule({ organizationId, permissions, property, schedule, workforce }: PropertyScheduleProps) {
  const canManageSchedule = permissions.effectivePermissions.includes(PERMISSIONS.SCHEDULE_WRITE);
  const allAssignedEmployees = useMemo(
    () => [...workforce].sort((left, right) => left.name.localeCompare(right.name)),
    [workforce]
  );
  const [showArchivedEmployees, setShowArchivedEmployees] = useState(false);
  const assignedEmployees = useMemo(
    () =>
      showArchivedEmployees
        ? allAssignedEmployees
        : allAssignedEmployees.filter((employee) => !isArchivedEmploymentStatus(employee.employmentStatus)),
    [allAssignedEmployees, showArchivedEmployees]
  );
  const archivedEmployeeCount = useMemo(
    () => allAssignedEmployees.filter((employee) => isArchivedEmploymentStatus(employee.employmentStatus)).length,
    [allAssignedEmployees]
  );
  const [weekCursor, setWeekCursor] = useState<string | null>(null);
  const [weekEditorState, setWeekEditorState] = useState<WeekShiftEditorState | null>(null);
  const [weekFormState, setWeekFormState] = useState<WeekShiftFormState | null>(null);
  const [weekFormError, setWeekFormError] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [activeTemplateSlot, setActiveTemplateSlot] = useState<number | null>(null);
  const [templateNameDraft, setTemplateNameDraft] = useState<string>("");
  const [templateEditorState, setTemplateEditorState] = useState<TemplateShiftEditorState | null>(null);
  const [templateFormState, setTemplateFormState] = useState<TemplateShiftFormState | null>(null);
  const [templateFormError, setTemplateFormError] = useState<string | null>(null);
  const [activePresetDrag, setActivePresetDrag] = useState<PresetDragData | null>(null);
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);
  const [pendingPositionPreset, setPendingPositionPreset] = useState<PendingPositionPresetChoice | null>(null);
  const [templateSummaryMessage, setTemplateSummaryMessage] = useState<string | null>(null);

  const weekQuery = usePropertyScheduleWeek(property.id, weekCursor);
  const templatesQuery = usePropertyScheduleTemplates(property.id);
  const createShift = useCreatePropertyScheduleShift(property.id, organizationId);
  const updateShift = useUpdatePropertyScheduleShift(property.id, organizationId);
  const deleteShift = useDeletePropertyScheduleShift(property.id, organizationId);
  const publishSchedule = usePublishPropertySchedule(property.id, organizationId);
  const createTemplate = useCreatePropertyScheduleTemplate(property.id);
  const updateTemplate = useUpdatePropertyScheduleTemplate(property.id);
  const deleteTemplate = useDeletePropertyScheduleTemplate(property.id);
  const applyTemplate = useApplyPropertyScheduleTemplate(property.id, organizationId);

  const scheduleWeek = weekQuery.data;
  const templates = templatesQuery.data?.templates ?? [];
  const quickPresets =
    scheduleWeek?.quickPresets ??
    templatesQuery.data?.quickPresets ?? {
      positions: [],
      times: [],
    };
  const selectedTemplate = activeTemplateId ? templates.find((template) => template.id === activeTemplateId) ?? null : null;
  const selectedTemplateShifts = selectedTemplate?.shifts ?? [];
  const resolvedActiveTemplateSlot = activeTemplateSlot ?? templates[0]?.slotIndex ?? 1;
  const activeSlotTemplate = templates.find((template) => template.slotIndex === resolvedActiveTemplateSlot) ?? null;
  const editingShift =
    weekEditorState?.mode === "edit" ? scheduleWeek?.shifts.find((shift) => shift.id === weekEditorState.shiftId) ?? null : null;
  const editingTemplateShift =
    templateEditorState?.mode === "edit" && selectedTemplate
      ? selectedTemplate.shifts.find((shift) => shift.id === templateEditorState.shiftId) ?? null
      : null;

  const weekEmployeeOptions = useMemo(
    () =>
      buildEmployeeOptions(assignedEmployees, {
        employeeId: editingShift?.employeeId,
        employeeName: editingShift?.employeeName,
        employmentStatus: editingShift?.employee?.employmentStatus ?? null,
      }),
    [assignedEmployees, editingShift?.employee?.employmentStatus, editingShift?.employeeId, editingShift?.employeeName]
  );
  const templateEmployeeOptions = buildEmployeeOptions(assignedEmployees, {
    employeeId: editingTemplateShift?.employeeId,
    employeeName: editingTemplateShift?.employeeName,
    employmentStatus: editingTemplateShift?.employee?.employmentStatus ?? null,
  });

  const mutationError =
    (createShift.error && getScheduleErrorMessage(createShift.error)) ||
    (updateShift.error && getScheduleErrorMessage(updateShift.error)) ||
    (deleteShift.error && getScheduleErrorMessage(deleteShift.error)) ||
    (publishSchedule.error && getScheduleErrorMessage(publishSchedule.error)) ||
    (createTemplate.error && getScheduleErrorMessage(createTemplate.error)) ||
    (updateTemplate.error && getScheduleErrorMessage(updateTemplate.error)) ||
    (deleteTemplate.error && getScheduleErrorMessage(deleteTemplate.error)) ||
    (applyTemplate.error && getScheduleErrorMessage(applyTemplate.error)) ||
    null;

  useEffect(() => {
    setWeekCursor(null);
    setWeekEditorState(null);
    setWeekFormState(null);
    setWeekFormError(null);
    setActiveTemplateId(null);
    setActiveTemplateSlot(null);
    setTemplateNameDraft("");
    setTemplateEditorState(null);
    setTemplateFormState(null);
    setTemplateFormError(null);
    setActivePresetDrag(null);
    setDragTargetId(null);
    setPendingPositionPreset(null);
    setTemplateSummaryMessage(null);
    setShowArchivedEmployees(false);
  }, [property.id]);

  useEffect(() => {
    if (!weekCursor && scheduleWeek?.weekStartDate) {
      setWeekCursor(scheduleWeek.weekStartDate);
    }
  }, [scheduleWeek?.weekStartDate, weekCursor]);

  useEffect(() => {
    if (activeTemplateId && !selectedTemplate) {
      setActiveTemplateId(null);
      setTemplateEditorState(null);
      setTemplateFormState(null);
      setTemplateFormError(null);
    }
  }, [activeTemplateId, selectedTemplate]);

  useEffect(() => {
    if (selectedTemplate) {
      setTemplateNameDraft(selectedTemplate.name);
    }
  }, [selectedTemplate]);

  useEffect(() => {
    setPendingPositionPreset(null);
  }, [scheduleWeek?.weekStartDate, selectedTemplate?.id]);

  useEffect(() => {
    if (!weekEditorState || !scheduleWeek) {
      return;
    }

    if (weekEditorState.mode === "edit") {
      if (!editingShift) {
        setWeekEditorState(null);
        setWeekFormState(null);
        return;
      }

      setWeekFormState(createWeekShiftFormFromExistingShift(editingShift));
      setWeekFormError(null);
      return;
    }

    const defaultDate =
      weekEditorState.seedDate ?? scheduleWeek.days.find((day) => day.isToday)?.date ?? scheduleWeek.weekStartDate;

    setWeekFormState(
      createEmptyWeekShiftForm({
        date: defaultDate,
        employeeId: weekEditorState.seedEmployeeId ?? "",
        positionLabel: weekEditorState.seedPositionLabel ?? "",
        status: weekEditorState.seedStatus,
      })
    );
    setWeekFormError(null);
  }, [editingShift, scheduleWeek, weekEditorState]);

  useEffect(() => {
    if (!templateEditorState || !selectedTemplate || !scheduleWeek) {
      return;
    }

    if (templateEditorState.mode === "edit") {
      if (!editingTemplateShift) {
        setTemplateEditorState(null);
        setTemplateFormState(null);
        return;
      }

      setTemplateFormState(createTemplateShiftFormFromExistingShift(editingTemplateShift));
      setTemplateFormError(null);
      return;
    }

    setTemplateFormState(
      createEmptyTemplateShiftForm({
        dayIndex: templateEditorState.seedDayIndex ?? 0,
        employeeId: templateEditorState.seedEmployeeId ?? "",
      })
    );
    setTemplateFormError(null);
  }, [editingTemplateShift, scheduleWeek, selectedTemplate, templateEditorState]);

  const shiftsByEmployeeAndDay = useMemo(() => {
    const lookup = new Map<string, PropertyScheduleShift[]>();

    for (const shift of scheduleWeek?.shifts ?? []) {
      const key = `${shift.employeeId ?? "open"}:${shift.date}`;
      const current = lookup.get(key) ?? [];
      current.push(shift);
      lookup.set(key, current);
    }

    return lookup;
  }, [scheduleWeek?.shifts]);

  const shiftsByDay = useMemo(() => {
    const lookup = new Map<string, PropertyScheduleShift[]>();

    for (const shift of scheduleWeek?.shifts ?? []) {
      const current = lookup.get(shift.date) ?? [];
      current.push(shift);
      lookup.set(shift.date, current);
    }

    return lookup;
  }, [scheduleWeek?.shifts]);

  const templateShiftsByEmployeeAndDay = (() => {
    const lookup = new Map<string, PropertyScheduleTemplateShift[]>();

    for (const shift of selectedTemplateShifts) {
      const key = `${shift.employeeId ?? "open"}:${shift.dayIndex}`;
      const current = lookup.get(key) ?? [];
      current.push(shift);
      lookup.set(key, current);
    }

    return lookup;
  })();

  const templateShiftsByDay = (() => {
    const lookup = new Map<number, PropertyScheduleTemplateShift[]>();

    for (const shift of selectedTemplateShifts) {
      const current = lookup.get(shift.dayIndex) ?? [];
      current.push(shift);
      lookup.set(shift.dayIndex, current);
    }

    return lookup;
  })();

  const openShiftsByDay = useMemo(() => {
    const lookup = new Map<string, PropertyScheduleShift[]>();

    for (const shift of scheduleWeek?.shifts.filter((currentShift) => !currentShift.employeeId) ?? []) {
      const current = lookup.get(shift.date) ?? [];
      current.push(shift);
      lookup.set(shift.date, current);
    }

    return lookup;
  }, [scheduleWeek?.shifts]);

  const templateOpenShiftsByDay = (() => {
    const lookup = new Map<number, PropertyScheduleTemplateShift[]>();

    for (const shift of selectedTemplateShifts.filter((templateShift) => !templateShift.employeeId)) {
      const current = lookup.get(shift.dayIndex) ?? [];
      current.push(shift);
      lookup.set(shift.dayIndex, current);
    }

    return lookup;
  })();

  if (!schedule.enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scheduling</CardTitle>
          <CardDescription>Scheduling is disabled for this property.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if ((weekQuery.isLoading && !scheduleWeek) || (templatesQuery.isLoading && !templatesQuery.data && weekQuery.isLoading)) {
    return <ScheduleLoadingState />;
  }

  if (weekQuery.isError || !scheduleWeek) {
    return <ScheduleErrorState message={getScheduleErrorMessage(weekQuery.error)} onRetry={() => void weekQuery.refetch()} />;
  }

  const currentDateLabel = `${formatDateOnlyLabel(scheduleWeek.weekStartDate)} - ${formatDateOnlyLabel(scheduleWeek.weekEndDate)}`;
  const visibleEmployeeIds = new Set(assignedEmployees.map((employee) => employee.id));
  const visibleScheduleShifts = scheduleWeek.shifts.filter(
    (shift) => !shift.employeeId || visibleEmployeeIds.has(shift.employeeId)
  );
  const totalShifts = visibleScheduleShifts.length;
  const openShiftCount = visibleScheduleShifts.filter((shift) => shift.status === "open").length;
  const scheduledEmployeeCount = new Set(visibleScheduleShifts.map((shift) => shift.employeeId).filter(Boolean)).size;
  const templatesBySlot = Array.from({ length: 3 }, (_, index) => templates.find((template) => template.slotIndex === index + 1) ?? null);

  const isPublishing = publishSchedule.isPending;
  const isSavingShift = createShift.isPending || updateShift.isPending;
  const isDeletingShift = deleteShift.isPending;
  const isWeekSheetOpen = Boolean(weekEditorState && weekFormState);
  const isTemplateSheetOpen = Boolean(selectedTemplate && templateEditorState && templateFormState);
  const isCreatingTemplate = createTemplate.isPending;
  const isUpdatingTemplate = updateTemplate.isPending;
  const isDeletingTemplate = deleteTemplate.isPending;
  const isApplyingTemplate = applyTemplate.isPending;
  const isEditingActiveTemplate = Boolean(activeSlotTemplate && selectedTemplate && activeSlotTemplate.id === selectedTemplate.id);

  function closeTemplateEditor() {
    setActiveTemplateId(null);
    setTemplateEditorState(null);
    setTemplateFormState(null);
    setTemplateFormError(null);
  }

  function resetDragState() {
    setActivePresetDrag(null);
    setDragTargetId(null);
  }

  function readCellDropTargetId(employeeId: string, date: string) {
    return `cell:${employeeId}:${date}`;
  }

  function readShiftDropTargetId(shiftId: string) {
    return `shift:${shiftId}`;
  }

  function readTemplateCellDropTargetId(employeeId: string, dayIndex: number) {
    return `template-cell:${employeeId}:${dayIndex}`;
  }

  function readTemplateShiftDropTargetId(shiftId: string) {
    return `template-shift:${shiftId}`;
  }

  function handleSelectTemplateSlot(slotIndex: number) {
    setActiveTemplateSlot(slotIndex);

    if (selectedTemplate && selectedTemplate.slotIndex !== slotIndex) {
      closeTemplateEditor();
    }
  }

  async function handlePublish() {
    if (!scheduleWeek) {
      return;
    }

    await publishSchedule.mutateAsync({
      weekStartDate: scheduleWeek.weekStartDate,
    });
  }

  async function handleWeekSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!weekFormState) {
      return;
    }

    const breakMinutesValue = Number.parseInt(weekFormState.breakMinutes, 10);

    if (!weekFormState.date || !weekFormState.startTime || !weekFormState.endTime) {
      setWeekFormError("Date, start time, and end time are required.");
      return;
    }

    if (!Number.isInteger(breakMinutesValue) || breakMinutesValue < 0) {
      setWeekFormError("Break minutes must be a non-negative integer.");
      return;
    }

    if (weekFormState.status !== "open" && weekFormState.employeeId.trim().length === 0) {
      setWeekFormError("Select an assigned employee or mark this as an open shift.");
      return;
    }

    const payload: Omit<CreateShiftPayload, "propertyId"> = {
      breakMinutes: breakMinutesValue,
      date: weekFormState.date,
      employeeId: weekFormState.status === "open" ? null : weekFormState.employeeId || null,
      endTime: weekFormState.endTime,
      notes: weekFormState.notes || null,
      positionLabel: weekFormState.positionLabel || null,
      startTime: weekFormState.startTime,
      status: weekFormState.status,
    };

    setWeekFormError(null);

    if (weekEditorState?.mode === "edit") {
      await updateShift.mutateAsync({
        propertyId: property.id,
        shiftId: weekEditorState.shiftId,
        ...payload,
      });
    } else {
      await createShift.mutateAsync({
        propertyId: property.id,
        ...payload,
      });
    }

    setWeekEditorState(null);
    setWeekFormState(null);
  }

  async function handleDeleteWeekShift() {
    if (!weekEditorState || weekEditorState.mode !== "edit" || !editingShift) {
      return;
    }

    if (!window.confirm("Delete this shift?")) {
      return;
    }

    await deleteShift.mutateAsync({
      propertyId: property.id,
      shiftId: editingShift.id,
    });

    setWeekEditorState(null);
    setWeekFormState(null);
  }

  async function handleCreateTemplate(payload: CreatePropertyScheduleTemplatePayload) {
    const result = await createTemplate.mutateAsync(payload);
    const createdTemplate = result.templates.find((template) => template.slotIndex === payload.slotIndex) ?? null;

    setActiveTemplateSlot(payload.slotIndex);

    if (createdTemplate) {
      setActiveTemplateId(createdTemplate.id);
      setTemplateSummaryMessage(`Created ${createdTemplate.name}.`);
    }
  }

  async function handleDeleteTemplate(template: PropertyScheduleTemplate) {
    if (!window.confirm(`Delete ${template.name}?`)) {
      return;
    }

    await deleteTemplate.mutateAsync({
      propertyId: property.id,
      templateId: template.id,
    });

    setActiveTemplateSlot(template.slotIndex);

    if (activeTemplateId === template.id) {
      closeTemplateEditor();
    }
    setTemplateSummaryMessage(`Deleted ${template.name}.`);
  }

  async function handleReplaceTemplateFromCurrentWeek(template: PropertyScheduleTemplate) {
    if (!scheduleWeek) {
      return;
    }

    if (!window.confirm(`Replace ${template.name} with the current week?`)) {
      return;
    }

    await updateTemplate.mutateAsync({
      propertyId: property.id,
      sourceWeekStartDate: scheduleWeek.weekStartDate,
      templateId: template.id,
    });
    setTemplateSummaryMessage(`Saved the current week into ${template.name}.`);
  }

  async function handleApplyTemplate(template: PropertyScheduleTemplate) {
    if (!scheduleWeek) {
      return;
    }

    if (!window.confirm(`Load ${template.name} into ${scheduleWeek.weekLabel}? This replaces the current week's shifts for this property.`)) {
      return;
    }

    const result = await applyTemplate.mutateAsync({
      templateId: template.id,
      weekStartDate: scheduleWeek.weekStartDate,
    });

    setTemplateSummaryMessage(buildApplySummaryMessage(result.summary, template.name));
  }

  async function handleSaveTemplateName() {
    if (!selectedTemplate) {
      return;
    }

    const normalizedDraft = templateNameDraft.trim();

    if (normalizedDraft === selectedTemplate.name) {
      return;
    }

    await updateTemplate.mutateAsync({
      name: normalizedDraft || null,
      propertyId: property.id,
      templateId: selectedTemplate.id,
    });
    setTemplateSummaryMessage(`Updated ${selectedTemplate.name}.`);
  }

  async function persistTemplateShiftList(template: PropertyScheduleTemplate, shifts: ScheduleTemplateShiftInput[]) {
    await updateTemplate.mutateAsync({
      propertyId: property.id,
      shifts,
      templateId: template.id,
    });
    setTemplateSummaryMessage(`Updated ${template.name}.`);
  }

  async function handleTemplateShiftSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTemplate || !templateFormState) {
      return;
    }

    const breakMinutesValue = Number.parseInt(templateFormState.breakMinutes, 10);
    const dayIndexValue = Number.parseInt(templateFormState.dayIndex, 10);

    if (!templateFormState.startTime || !templateFormState.endTime || !Number.isInteger(dayIndexValue)) {
      setTemplateFormError("Day, start time, and end time are required.");
      return;
    }

    if (!Number.isInteger(breakMinutesValue) || breakMinutesValue < 0) {
      setTemplateFormError("Break minutes must be a non-negative integer.");
      return;
    }

    if (templateFormState.status !== "open" && templateFormState.employeeId.trim().length === 0) {
      setTemplateFormError("Select an assigned employee or mark this as an open shift.");
      return;
    }

    const nextShift = serializeTemplateShiftFromForm(templateFormState);
    const nextShifts =
      templateEditorState?.mode === "edit"
        ? selectedTemplate.shifts.map((shift) =>
            shift.id === templateEditorState.shiftId ? { ...nextShift, id: shift.id } : serializeTemplateShift(shift)
          )
        : [...selectedTemplate.shifts.map((shift) => serializeTemplateShift(shift)), nextShift];

    setTemplateFormError(null);

    await persistTemplateShiftList(selectedTemplate, nextShifts);

    setTemplateEditorState(null);
    setTemplateFormState(null);
  }

  async function handleDeleteTemplateShift() {
    if (!selectedTemplate || !templateEditorState || templateEditorState.mode !== "edit" || !editingTemplateShift) {
      return;
    }

    if (!window.confirm("Delete this template shift?")) {
      return;
    }

    await persistTemplateShiftList(
      selectedTemplate,
      selectedTemplate.shifts.filter((shift) => shift.id !== editingTemplateShift.id).map((shift) => serializeTemplateShift(shift))
    );

    setTemplateEditorState(null);
    setTemplateFormState(null);
    setTemplateSummaryMessage(`Removed a shift from ${selectedTemplate.name}.`);
  }

  async function handleDropTimePresetToCreate(preset: ScheduleQuickTimePreset, date: string, employeeId: string) {
    await createShift.mutateAsync({
      breakMinutes: 0,
      date,
      employeeId,
      endTime: preset.endTime,
      propertyId: property.id,
      startTime: preset.startTime,
      status: "scheduled",
    });
  }

  async function handleDropPresetOnWeekCell(employeeId: string, employeeName: string, date: string) {
    if (!activePresetDrag) {
      return;
    }

    if (activePresetDrag.type === "time") {
      await handleDropTimePresetToCreate(activePresetDrag.preset, date, employeeId);
      resetDragState();
      return;
    }

    setPendingPositionPreset({
      mode: "week",
      date,
      employeeId,
      employeeName,
      positionLabel: activePresetDrag.preset.positionLabel,
    });
    resetDragState();
  }

  async function handleDropPresetOnTemplateCell(employeeId: string, employeeName: string, dayIndex: number, dayLabel: string) {
    if (!activePresetDrag || !selectedTemplate) {
      return;
    }

    if (activePresetDrag.type === "time") {
      await persistTemplateShiftList(selectedTemplate, [
        ...selectedTemplate.shifts.map((shift) => serializeTemplateShift(shift)),
        createTemplateShiftInputFromPreset({
          dayIndex,
          employeeId,
          preset: activePresetDrag.preset,
        }),
      ]);
      resetDragState();
      return;
    }

    setPendingPositionPreset({
      dayIndex,
      dayLabel,
      employeeId,
      employeeName,
      mode: "template",
      positionLabel: activePresetDrag.preset.positionLabel,
      templateId: selectedTemplate.id,
    });
    resetDragState();
  }

  async function handleDropPresetOnWeekShift(shift: PropertyScheduleShift) {
    if (!activePresetDrag) {
      return;
    }

    if (activePresetDrag.type === "time") {
      await updateShift.mutateAsync({
        date: shift.date,
        endTime: activePresetDrag.preset.endTime,
        propertyId: property.id,
        shiftId: shift.id,
        startTime: activePresetDrag.preset.startTime,
      });
      resetDragState();
      return;
    }

    await updateShift.mutateAsync({
      positionLabel: activePresetDrag.preset.positionLabel,
      propertyId: property.id,
      shiftId: shift.id,
    });
    resetDragState();
  }

  async function handleDropPresetOnTemplateShift(shift: PropertyScheduleTemplateShift) {
    if (!activePresetDrag || !selectedTemplate) {
      return;
    }

    if (activePresetDrag.type === "time") {
      await persistTemplateShiftList(
        selectedTemplate,
        selectedTemplate.shifts.map((currentShift) =>
          currentShift.id === shift.id
            ? {
                ...serializeTemplateShift(currentShift),
                ...createTemplateShiftInputFromPreset({
                  dayIndex: currentShift.dayIndex,
                  employeeId: currentShift.employeeId,
                  positionLabel: currentShift.positionLabel,
                  preset: activePresetDrag.preset,
                }),
                id: currentShift.id,
              }
            : serializeTemplateShift(currentShift)
        )
      );
      resetDragState();
      return;
    }

    await persistTemplateShiftList(
      selectedTemplate,
      selectedTemplate.shifts.map((currentShift) =>
        currentShift.id === shift.id
          ? {
              ...serializeTemplateShift(currentShift),
              positionLabel: activePresetDrag.preset.positionLabel,
            }
          : serializeTemplateShift(currentShift)
      )
    );
    resetDragState();
  }

  async function handleCreateShiftFromPendingPositionPreset(preset: ScheduleQuickTimePreset) {
    if (!pendingPositionPreset) {
      return;
    }

    if (pendingPositionPreset.mode === "week") {
      await createShift.mutateAsync({
        breakMinutes: 0,
        date: pendingPositionPreset.date,
        employeeId: pendingPositionPreset.employeeId,
        endTime: preset.endTime,
        positionLabel: pendingPositionPreset.positionLabel,
        propertyId: property.id,
        startTime: preset.startTime,
        status: "scheduled",
      });
    } else {
      const targetTemplate = templates.find((template) => template.id === pendingPositionPreset.templateId) ?? null;

      if (!targetTemplate) {
        setPendingPositionPreset(null);
        return;
      }

      await persistTemplateShiftList(targetTemplate, [
        ...targetTemplate.shifts.map((shift) => serializeTemplateShift(shift)),
        createTemplateShiftInputFromPreset({
          dayIndex: pendingPositionPreset.dayIndex,
          employeeId: pendingPositionPreset.employeeId,
          positionLabel: pendingPositionPreset.positionLabel,
          preset,
        }),
      ]);
    }

    setPendingPositionPreset(null);
  }

  function handleCellDragOver(targetId: string, event: React.DragEvent<HTMLElement>) {
    if (!canManageSchedule || !activePresetDrag) {
      return;
    }

    event.preventDefault();
    setDragTargetId(targetId);
  }

  function handleCellDragLeave(targetId: string) {
    if (dragTargetId === targetId) {
      setDragTargetId(null);
    }
  }

  function handlePrintSchedule() {
    if (typeof window === "undefined") {
      return;
    }

    window.print();
  }

  return (
    <>
      <Card className="schedule-print-root print:border-none print:bg-transparent print:shadow-none">
        <CardHeader className="gap-4 print:hidden">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{scheduleWeek.weekLabel}</CardTitle>
              </div>
              <CardDescription>
                {property.name} schedule for {currentDateLabel}. Editing stays scoped to this property.
              </CardDescription>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{totalShifts}</span>
                <span>shifts</span>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-foreground">{scheduledEmployeeCount}</span>
                <span>employees</span>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-foreground">{openShiftCount}</span>
                <span>open</span>
                <span aria-hidden="true">·</span>
                <Badge variant="outline" className={cn("capitalize", getScheduleStateBadgeClass(scheduleWeek.status))}>
                  {scheduleWeek.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {scheduleWeek.publishedAt
                  ? `Last published ${new Date(scheduleWeek.publishedAt).toLocaleString(undefined, {
                      timeZone: property.timezone,
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}${scheduleWeek.publishedBy.displayName ? ` by ${scheduleWeek.publishedBy.displayName}` : ""}.`
                  : "This week is still in draft and has not been published yet."}
              </p>
            </div>

            <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={archivedEmployeeCount === 0}
                aria-pressed={showArchivedEmployees}
                onClick={() => setShowArchivedEmployees((current) => !current)}
              >
                <UserRoundX className="size-4" />
                {showArchivedEmployees ? "Hide archived" : "Show archived"}
                {archivedEmployeeCount > 0 ? (
                  <Badge variant="secondary" className="ml-1 h-5 rounded-md px-1.5 text-[10px]">
                    {archivedEmployeeCount}
                  </Badge>
                ) : null}
              </Button>

              {canManageSchedule ? (
                <Button type="button" variant="outline" onClick={() => setWeekEditorState({ mode: "create" })}>
                  <Plus className="size-4" />
                  New shift
                </Button>
              ) : null}

              {canManageSchedule ? (
                <Button type="button" onClick={() => void handlePublish()} disabled={isPublishing}>
                  {isPublishing ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Publish schedule
                </Button>
              ) : null}

              <Button type="button" variant="outline" onClick={handlePrintSchedule}>
                <Printer className="size-4" />
                Print
              </Button>
            </div>
          </div>

          {mutationError || weekFormError || templateFormError || templateSummaryMessage ? (
            <div className="flex items-start gap-3 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground print:hidden">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p>{mutationError ?? weekFormError ?? templateFormError ?? templateSummaryMessage}</p>
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-5 print:px-0 print:pt-0">
          <div className="rounded-2xl border border-border bg-card print:hidden">
            <div className="px-4 py-3.5">
              <div className="flex flex-col gap-1.5">
                <div>
                  <p className="text-base font-semibold text-card-foreground">Templates</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Keep up to three pre-made drafts for this property.
                  </p>
                </div>
              </div>
            </div>
            <div className="border-t border-border px-4 py-3">
              {templatesQuery.isLoading && !templatesQuery.data ? (
                <div className="space-y-2.5">
                  <div className="grid gap-2 sm:grid-cols-3">
                    {Array.from({ length: 3 }, (_, index) => (
                      <Skeleton key={index} className="h-20 rounded-xl" />
                    ))}
                  </div>
                  <Skeleton className="h-14 rounded-xl" />
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="grid gap-2 sm:grid-cols-3">
                    {templatesBySlot.map((template, index) => {
                      const slotIndex = index + 1;
                      const isActiveSlot = resolvedActiveTemplateSlot === slotIndex;

                      return (
                        <button
                          key={slotIndex}
                          type="button"
                          onClick={() => handleSelectTemplateSlot(slotIndex)}
                          className={cn(
                            "flex min-h-20 flex-col items-start justify-between rounded-xl border px-3 py-2.5 text-left transition-colors duration-150",
                            isActiveSlot
                              ? "border-primary/25 bg-primary-soft/35 ring-1 ring-primary/10"
                              : "border-border bg-background hover:bg-muted/30"
                          )}
                        >
                          <div className="flex w-full items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{template?.name ?? `Template ${slotIndex}`}</p>
                              <p className="mt-1 text-xs text-muted-foreground">Slot {slotIndex}</p>
                            </div>
                            <Badge variant="outline" className="shrink-0">
                              {template ? `${template.shiftCount} shifts` : "Empty"}
                            </Badge>
                          </div>
                          <span className="mt-2 text-xs text-muted-foreground">
                            {template
                              ? new Date(template.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                              : "Blank slot"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-xl border border-border bg-background/90 px-3 py-2.5">
                    <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {activeSlotTemplate?.name ?? `Template ${resolvedActiveTemplateSlot}`}
                          </p>
                          {isEditingActiveTemplate ? <Badge variant="secondary">Editing</Badge> : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {activeSlotTemplate
                            ? `Slot ${resolvedActiveTemplateSlot} • ${activeSlotTemplate.shiftCount} shifts • Updated ${new Date(activeSlotTemplate.updatedAt).toLocaleDateString(undefined, {
                                dateStyle: "medium",
                              })}`
                            : `Slot ${resolvedActiveTemplateSlot} is empty. Create a blank draft or save the current week here.`}
                        </p>
                      </div>

                      {activeSlotTemplate ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant={isEditingActiveTemplate ? "secondary" : "outline"}
                            size="xs"
                            onClick={() => {
                              setActiveTemplateSlot(activeSlotTemplate.slotIndex);
                              setActiveTemplateId(activeSlotTemplate.id);
                            }}
                          >
                            <PencilLine className="size-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() => void handleApplyTemplate(activeSlotTemplate)}
                            disabled={!canManageSchedule || isApplyingTemplate}
                          >
                            {isApplyingTemplate ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                            Load into week
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() => void handleReplaceTemplateFromCurrentWeek(activeSlotTemplate)}
                            disabled={!canManageSchedule || isUpdatingTemplate}
                          >
                            <Save className="size-4" />
                            Replace from week
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => void handleDeleteTemplate(activeSlotTemplate)}
                            disabled={!canManageSchedule || isDeletingTemplate}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            onClick={() =>
                              void handleCreateTemplate({
                                propertyId: property.id,
                                slotIndex: resolvedActiveTemplateSlot,
                              })
                            }
                            disabled={!canManageSchedule || isCreatingTemplate}
                          >
                            {isCreatingTemplate ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
                            Create blank
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() =>
                              void handleCreateTemplate({
                                propertyId: property.id,
                                slotIndex: resolvedActiveTemplateSlot,
                                sourceWeekStartDate: scheduleWeek.weekStartDate,
                              })
                            }
                            disabled={!canManageSchedule || isCreatingTemplate}
                          >
                            <Save className="size-4" />
                            Save current week
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {pendingPositionPreset ? (
            <div className="rounded-2xl border border-border bg-card px-4 py-4 print:hidden">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Choose a time for {pendingPositionPreset.positionLabel}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {pendingPositionPreset.mode === "week"
                      ? `${pendingPositionPreset.employeeName} on ${formatDateOnlyLabel(pendingPositionPreset.date)}`
                      : `${pendingPositionPreset.employeeName} on ${pendingPositionPreset.dayLabel} template day`}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setPendingPositionPreset(null)}>
                  <X className="size-4" />
                  Cancel
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {quickPresets.times.map((preset) => (
                  <Button key={preset.id} type="button" variant="outline" size="sm" onClick={() => void handleCreateShiftFromPendingPositionPreset(preset)}>
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="hidden rounded-xl border border-border bg-card print:hidden lg:block">
            <div className="border-b border-border px-4 py-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-base font-semibold text-card-foreground">Quick presets</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Drag a time or position onto an employee and day in the live week or template editor. Drop onto a shift card to update it directly.
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-2 py-1.5 xl:justify-start">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      Week
                    </p>
                    <p className="truncate text-sm font-medium text-foreground">{scheduleWeek.weekLabel}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5"
                      onClick={() => setWeekCursor(scheduleWeek.weekStartDate ? shiftWeekStartDate(scheduleWeek.weekStartDate, -7) : null)}
                    >
                      <ChevronLeft className="size-4" />
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5"
                      onClick={() => setWeekCursor(scheduleWeek.weekStartDate ? shiftWeekStartDate(scheduleWeek.weekStartDate, 7) : null)}
                    >
                      Next
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-3 px-4 py-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">Time presets</p>
                <div className="flex flex-wrap gap-1.5">
                  {quickPresets.times.map((preset) => (
                    <PresetChip
                      key={preset.id}
                      disabled={!canManageSchedule}
                      isActive={activePresetDrag?.type === "time" && activePresetDrag.preset.id === preset.id}
                      label={preset.label}
                      onDragStart={() => setActivePresetDrag({ preset, type: "time" })}
                      onDragEnd={resetDragState}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">Position presets</p>
                <div className="flex flex-wrap gap-1.5">
                  {quickPresets.positions.map((preset) => (
                    <PresetChip
                      key={preset.id}
                      disabled={!canManageSchedule}
                      isActive={activePresetDrag?.type === "position" && activePresetDrag.preset.id === preset.id}
                      label={preset.label}
                      onDragStart={() => setActivePresetDrag({ preset, type: "position" })}
                      onDragEnd={resetDragState}
                      tone={resolveScheduleRoleTone(preset.label)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {selectedTemplate ? (
            <div className="rounded-2xl border border-border bg-card print:hidden">
              <div className="border-b border-border px-4 py-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <p className="text-base font-semibold text-card-foreground">Editing {selectedTemplate.name}</p>
                      <Badge variant="outline">Template #{selectedTemplate.slotIndex}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Template mode uses the same employee-week layout, but saves a reusable pre-made draft instead of a live week.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex gap-2">
                      <Input
                        value={templateNameDraft}
                        disabled={!canManageSchedule || isUpdatingTemplate}
                        onChange={(event) => setTemplateNameDraft(event.target.value)}
                        className="min-w-52"
                        placeholder={`Template ${selectedTemplate.slotIndex}`}
                      />
                      <Button type="button" variant="outline" onClick={() => void handleSaveTemplateName()} disabled={!canManageSchedule || isUpdatingTemplate}>
                        {isUpdatingTemplate ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                        Save name
                      </Button>
                    </div>
                    <Button type="button" variant="ghost" onClick={() => setActiveTemplateId(null)}>
                      <X className="size-4" />
                      Close template
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4 px-4 py-4">
                <div className="hidden overflow-x-auto lg:block">
                  <div className="min-w-[1180px] rounded-xl border border-border bg-background">
                    <div className="grid" style={{ gridTemplateColumns: gridColumnTemplate }}>
                      <div className="sticky top-0 left-0 z-30 border-r border-b border-border bg-background px-4 py-3">
                        <p className="text-sm font-medium text-foreground">Employees</p>
                        <p className="mt-1 text-xs text-muted-foreground">Template pattern for {property.name}</p>
                      </div>
                      {scheduleWeek.days.map((day) => (
                        <div key={day.date} className="sticky top-0 z-20 border-b border-l border-border bg-background px-3 py-3">
                          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                            {day.shortLabel}
                          </p>
                          <p className="mt-1.5 text-sm font-medium text-foreground">{formatDateOnlyLabel(day.date)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Template day</p>
                        </div>
                      ))}

                      {assignedEmployees.map((employee) => (
                        <div key={employee.id} className="contents group/template-row">
                          <div className="sticky left-0 z-10 border-r border-b border-border bg-background px-4 py-3 group-hover/template-row:bg-muted/15">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={cn("size-2 rounded-full", getEmployeeStatusDotClass(employee.employmentStatus))} />
                                  <p className="truncate text-sm font-medium text-foreground">{employee.name}</p>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {employee.shiftLabel || employee.email || "Assigned employee"}
                                </p>
                              </div>
                              <Badge
                                variant={employee.employmentStatus.trim().toLowerCase() === "active" ? "secondary" : "outline"}
                                className="h-5 rounded-md px-1.5 text-[10px] capitalize"
                              >
                                {employee.employmentStatus.replace("_", " ")}
                              </Badge>
                            </div>
                          </div>

                          {scheduleWeek.days.map((_, dayIndex) => {
                            const cellShifts = templateShiftsByEmployeeAndDay.get(`${employee.id}:${dayIndex}`) ?? [];
                            const cellTargetId = readTemplateCellDropTargetId(employee.id, dayIndex);

                            return (
                              <div
                                key={`${employee.id}:${dayIndex}`}
                                className={cn(
                                  "group/cell border-b border-l border-border px-2 py-2.5 transition-colors duration-150 hover:bg-muted/18 group-hover/template-row:bg-muted/8",
                                  dragTargetId === cellTargetId && "bg-muted/40"
                                )}
                                onDragOver={(event) => handleCellDragOver(cellTargetId, event)}
                                onDragLeave={() => handleCellDragLeave(cellTargetId)}
                                onDrop={(event) => {
                                  event.preventDefault();
                                  void handleDropPresetOnTemplateCell(employee.id, employee.name, dayIndex, scheduleWeek.days[dayIndex]?.label ?? `Day ${dayIndex + 1}`);
                                }}
                              >
                                <div className="space-y-1.5">
                                  {cellShifts.length > 0 ? (
                                    cellShifts.map((shift) => (
                                      <TemplateShiftCard
                                        key={shift.id}
                                        canManageSchedule={canManageSchedule}
                                        isDropTarget={dragTargetId === readTemplateShiftDropTargetId(shift.id)}
                                        onDragLeavePreset={() => handleCellDragLeave(readTemplateShiftDropTargetId(shift.id))}
                                        onDragOverPreset={(event) => handleCellDragOver(readTemplateShiftDropTargetId(shift.id), event)}
                                        onDropPreset={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          void handleDropPresetOnTemplateShift(shift);
                                        }}
                                        onSelect={(shiftId) => setTemplateEditorState({ mode: "edit", shiftId })}
                                        shift={shift}
                                      />
                                    ))
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={!canManageSchedule}
                                      onClick={() => setTemplateEditorState({ mode: "create", seedDayIndex: dayIndex, seedEmployeeId: employee.id })}
                                      className={cn(
                                        "flex min-h-12 w-full items-center justify-center gap-1 rounded-lg border border-dashed border-transparent bg-transparent px-2 py-2 text-center text-xs font-medium text-muted-foreground transition-all duration-150",
                                        canManageSchedule
                                          ? "opacity-40 group-hover/cell:border-border group-hover/cell:bg-muted/18 group-hover/cell:opacity-100 hover:bg-muted/22"
                                          : "cursor-default opacity-45"
                                      )}
                                    >
                                      <Plus className="size-3.5" />
                                      {canManageSchedule ? "Add" : "Off"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}

                      <div className="contents">
                        <div className="sticky left-0 z-10 border-r border-border bg-background px-4 py-3">
                          <p className="text-sm font-medium text-foreground">Open shifts</p>
                          <p className="mt-1 text-xs text-muted-foreground">Unassigned template coverage</p>
                        </div>
                        {scheduleWeek.days.map((_, dayIndex) => {
                          const cellShifts = templateOpenShiftsByDay.get(dayIndex) ?? [];

                          return (
                            <div key={`open:${dayIndex}`} className="border-l border-border px-2 py-2.5 transition-colors duration-150 hover:bg-muted/18">
                              <div className="space-y-1.5">
                                {cellShifts.length > 0 ? (
                                  cellShifts.map((shift) => (
                                    <TemplateShiftCard
                                      key={shift.id}
                                      canManageSchedule={canManageSchedule}
                                      isDropTarget={dragTargetId === readTemplateShiftDropTargetId(shift.id)}
                                      onDragLeavePreset={() => handleCellDragLeave(readTemplateShiftDropTargetId(shift.id))}
                                      onDragOverPreset={(event) => handleCellDragOver(readTemplateShiftDropTargetId(shift.id), event)}
                                      onDropPreset={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        void handleDropPresetOnTemplateShift(shift);
                                      }}
                                      onSelect={(shiftId) => setTemplateEditorState({ mode: "edit", shiftId })}
                                      shift={shift}
                                    />
                                  ))
                                ) : (
                                  <div className="flex min-h-12 items-center justify-center rounded-lg border border-dashed border-transparent bg-transparent px-2 py-2 text-center text-xs text-muted-foreground opacity-45">
                                    No open template shift
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 lg:hidden">
                  {scheduleWeek.days.map((day, dayIndex) => {
                    const dayShifts = templateShiftsByDay.get(dayIndex) ?? [];

                    return (
                      <div key={day.date} className="rounded-2xl border border-border bg-background">
                        <div className="border-b border-border px-4 py-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">{day.label}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{formatDateOnlyLabel(day.date)} template pattern</p>
                            </div>
                            <Badge variant="outline">{dayShifts.length} shifts</Badge>
                          </div>
                        </div>
                        <div className="space-y-3 px-4 py-4">
                          {dayShifts.length > 0 ? (
                            dayShifts.map((shift) => (
                              <TemplateShiftCard
                                key={shift.id}
                                canManageSchedule={canManageSchedule}
                                onSelect={(shiftId) => setTemplateEditorState({ mode: "edit", shiftId })}
                                shift={shift}
                              />
                            ))
                          ) : (
                            <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                              No template shifts for this day.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-4 print:space-y-0">
            {assignedEmployees.length > 0 || openShiftCount > 0 ? (
              <div className="hidden print:block">
                <div className="mb-4 border-b border-border pb-3">
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0">
                      <h1 className="text-xl font-semibold tracking-tight text-foreground">{property.name} Weekly Schedule</h1>
                      <p className="mt-1 text-sm text-muted-foreground">{scheduleWeek.weekLabel}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {property.city && property.stateRegion ? `${property.city}, ${property.stateRegion}` : "Property schedule"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">Status</p>
                      <p className="mt-1 text-sm font-medium capitalize text-foreground">{scheduleWeek.status}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Printed{" "}
                        {new Date().toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: property.timezone,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{totalShifts} shifts</span>
                    <span aria-hidden="true">•</span>
                    <span>{scheduledEmployeeCount} employees scheduled</span>
                    <span aria-hidden="true">•</span>
                    <span>{openShiftCount} open shifts</span>
                    {scheduleWeek.publishedAt ? (
                      <>
                        <span aria-hidden="true">•</span>
                        <span>
                          Published{" "}
                          {new Date(scheduleWeek.publishedAt).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: property.timezone,
                          })}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="overflow-visible">
                  <table className="w-full table-fixed border-collapse text-left">
                    <thead>
                      <tr>
                        <th className="w-[15%] border border-border bg-muted/35 px-2 py-2 align-top text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                          Employee
                        </th>
                        {scheduleWeek.days.map((day) => (
                          <th
                            key={`print-header:${day.date}`}
                            className={cn(
                              "border border-border px-2 py-2 align-top",
                              day.isToday ? "bg-primary-soft/35" : "bg-muted/35",
                            )}
                          >
                            <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                              {day.shortLabel}
                            </p>
                            <p className="mt-1 text-xs font-medium text-foreground">{formatDateOnlyLabel(day.date)}</p>
                            {day.isToday ? <p className="mt-0.5 text-[9px] text-muted-foreground">Today</p> : null}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {assignedEmployees.map((employee) => (
                        <tr key={`print-row:${employee.id}`}>
                          <td className="border border-border bg-background px-2 py-2 align-top">
                            <p className="text-[11px] font-semibold leading-4 text-foreground">{employee.name}</p>
                            <p className="mt-1 text-[9px] leading-4 text-muted-foreground capitalize">
                              {employee.employmentStatus.replace("_", " ")}
                            </p>
                            <p className="mt-1 text-[9px] leading-4 text-muted-foreground">
                              {employee.shiftLabel || employee.email || "Assigned employee"}
                            </p>
                          </td>
                          {scheduleWeek.days.map((day) => (
                            <td key={`print-cell:${employee.id}:${day.date}`} className="border border-border px-1.5 py-1.5 align-top">
                              <PrintableScheduleShiftList
                                shifts={shiftsByEmployeeAndDay.get(`${employee.id}:${day.date}`) ?? []}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr>
                        <td className="border border-border bg-background px-2 py-2 align-top">
                          <p className="text-[11px] font-semibold leading-4 text-foreground">Open shifts</p>
                          <p className="mt-1 text-[9px] leading-4 text-muted-foreground">Unassigned coverage</p>
                        </td>
                        {scheduleWeek.days.map((day) => (
                          <td key={`print-open:${day.date}`} className="border border-border px-1.5 py-1.5 align-top">
                            <PrintableScheduleShiftList
                              shifts={openShiftsByDay.get(day.date) ?? []}
                              emptyLabel="No open shift"
                            />
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {assignedEmployees.length === 0 && openShiftCount === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-10 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-border bg-background">
                  <CalendarDays className="size-5 text-muted-foreground" />
                </div>
                <p className="mt-4 text-sm font-medium text-foreground">
                  {archivedEmployeeCount > 0 && !showArchivedEmployees
                    ? "Only archived employees are hidden from this schedule."
                    : "No employees are assigned to this property yet."}
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  {archivedEmployeeCount > 0 && !showArchivedEmployees
                    ? "Use Show archived to review historical schedule rows for archived employees."
                    : "Assign employees to this property first. Scheduling stays property-first, so only assigned staff can appear here."}
                </p>
              </div>
            ) : null}

            {assignedEmployees.length > 0 || openShiftCount > 0 ? (
              <>
                <div className="hidden overflow-x-auto lg:block print:hidden">
                  <div className="min-w-[1180px] rounded-xl border border-border bg-card print:min-w-0 print:rounded-none print:border-none print:bg-transparent">
                    <div className="grid" style={{ gridTemplateColumns: gridColumnTemplate }}>
                      <div className="sticky top-0 left-0 z-30 border-r border-b border-border bg-background px-4 py-3 print:static">
                        <p className="text-sm font-medium text-foreground">Employees</p>
                        <p className="mt-1 text-xs text-muted-foreground">Assigned to {property.name}</p>
                      </div>
                      {scheduleWeek.days.map((day) => (
                        <div
                          key={day.date}
                          className={cn(
                            "sticky top-0 z-20 border-b border-l border-border px-3 py-3 print:static",
                            day.isToday ? "bg-primary-soft/60" : "bg-background"
                          )}
                        >
                          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                            {day.shortLabel}
                          </p>
                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">{formatDateOnlyLabel(day.date)}</p>
                            {day.isToday ? (
                              <span className="inline-flex items-center rounded-full border border-border bg-background/80 px-2 py-0.5 text-[11px] font-medium text-foreground">
                                Today
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}

                      {assignedEmployees.map((employee) => (
                        <div key={employee.id} className="contents group/schedule-row">
                          <div className="sticky left-0 z-10 border-r border-b border-border bg-background px-4 py-3 group-hover/schedule-row:bg-muted/15 print:static">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={cn("size-2 rounded-full", getEmployeeStatusDotClass(employee.employmentStatus))} />
                                  <p className="truncate text-sm font-medium text-foreground">{employee.name}</p>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {employee.shiftLabel || employee.email || "Assigned employee"}
                                </p>
                              </div>
                              <Badge
                                variant={employee.employmentStatus.trim().toLowerCase() === "active" ? "secondary" : "outline"}
                                className="h-5 rounded-md px-1.5 text-[10px] capitalize"
                              >
                                {employee.employmentStatus.replace("_", " ")}
                              </Badge>
                            </div>
                          </div>

                          {scheduleWeek.days.map((day) => {
                            const cellShifts = shiftsByEmployeeAndDay.get(`${employee.id}:${day.date}`) ?? [];
                            const cellTargetId = readCellDropTargetId(employee.id, day.date);

                            return (
                              <div
                                key={`${employee.id}:${day.date}`}
                                className={cn(
                                  "group/cell border-b border-l border-border px-2 py-2 transition-colors duration-150 hover:bg-muted/18 group-hover/schedule-row:bg-muted/8",
                                  dragTargetId === cellTargetId && "bg-muted/40"
                                )}
                                onDragOver={(event) => handleCellDragOver(cellTargetId, event)}
                                onDragLeave={() => handleCellDragLeave(cellTargetId)}
                                onDrop={(event) => {
                                  event.preventDefault();
                                  void handleDropPresetOnWeekCell(employee.id, employee.name, day.date);
                                }}
                              >
                                <div className="space-y-1.5">
                                  {cellShifts.length > 0 ? (
                                    cellShifts.map((shift) => (
                                      <WeekShiftCard
                                        key={shift.id}
                                        canManageSchedule={canManageSchedule}
                                        isDropTarget={dragTargetId === readShiftDropTargetId(shift.id)}
                                        onDragLeavePreset={() => handleCellDragLeave(readShiftDropTargetId(shift.id))}
                                        onDragOverPreset={(event) => handleCellDragOver(readShiftDropTargetId(shift.id), event)}
                                        onDropPreset={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          void handleDropPresetOnWeekShift(shift);
                                        }}
                                        onSelect={(shiftId) => setWeekEditorState({ mode: "edit", shiftId })}
                                        shift={shift}
                                      />
                                    ))
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={!canManageSchedule}
                                      onClick={() => setWeekEditorState({ mode: "create", seedDate: day.date, seedEmployeeId: employee.id })}
                                      className={cn(
                                        "flex min-h-11 w-full items-center justify-center gap-1 rounded-lg border border-dashed border-transparent bg-transparent px-2 py-1.5 text-center text-xs font-medium text-muted-foreground transition-all duration-150 print:hidden",
                                        canManageSchedule
                                          ? "opacity-35 group-hover/cell:border-border group-hover/cell:bg-muted/18 group-hover/cell:opacity-100 hover:bg-muted/22"
                                          : "cursor-default opacity-45"
                                      )}
                                    >
                                      <Plus className="size-3.5" />
                                      {canManageSchedule ? "Add" : "Off"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}

                      <div className="contents">
                        <div className="sticky left-0 z-10 border-r border-border bg-background px-4 py-3 print:static">
                          <p className="text-sm font-medium text-foreground">Open shifts</p>
                          <p className="mt-1 text-xs text-muted-foreground">Unassigned coverage for this week</p>
                        </div>
                        {scheduleWeek.days.map((day) => {
                          const cellShifts = openShiftsByDay.get(day.date) ?? [];

                          return (
                            <div key={`open:${day.date}`} className="border-l border-border px-2 py-2 transition-colors duration-150 hover:bg-muted/18">
                              <div className="space-y-1.5">
                                {cellShifts.length > 0 ? (
                                  cellShifts.map((shift) => (
                                    <WeekShiftCard
                                      key={shift.id}
                                      canManageSchedule={canManageSchedule}
                                      isDropTarget={dragTargetId === readShiftDropTargetId(shift.id)}
                                      onDragLeavePreset={() => handleCellDragLeave(readShiftDropTargetId(shift.id))}
                                      onDragOverPreset={(event) => handleCellDragOver(readShiftDropTargetId(shift.id), event)}
                                      onDropPreset={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        void handleDropPresetOnWeekShift(shift);
                                      }}
                                      onSelect={(shiftId) => setWeekEditorState({ mode: "edit", shiftId })}
                                      shift={shift}
                                    />
                                  ))
                                ) : (
                                  <div className="flex min-h-11 items-center justify-center rounded-lg border border-dashed border-transparent bg-transparent px-2 py-1.5 text-center text-xs text-muted-foreground opacity-45 print:hidden">
                                    No open shift
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 print:hidden lg:hidden">
                  {scheduleWeek.days.map((day) => {
                    const dayShifts = shiftsByDay.get(day.date) ?? [];

                    return (
                      <div key={day.date} className="rounded-2xl border border-border bg-card">
                        <div className="border-b border-border px-4 py-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">{day.label}</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {day.isToday ? `Today • ${formatDateOnlyLabel(day.date)}` : formatDateOnlyLabel(day.date)}
                              </p>
                            </div>
                            <Badge variant="outline">{dayShifts.length} shifts</Badge>
                          </div>
                        </div>
                        <div className="space-y-3 px-4 py-4">
                          {dayShifts.length > 0 ? (
                            dayShifts.map((shift) => (
                              <WeekShiftCard
                                key={shift.id}
                                canManageSchedule={canManageSchedule}
                                isDropTarget={false}
                                onDragLeavePreset={() => undefined}
                                onDragOverPreset={() => undefined}
                                onDropPreset={() => undefined}
                                onSelect={(shiftId) => setWeekEditorState({ mode: "edit", shiftId })}
                                shift={shift}
                              />
                            ))
                          ) : (
                            <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-6 text-center text-sm text-muted-foreground">
                              No shifts scheduled for this day.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Sheet
        open={isWeekSheetOpen}
        onOpenChange={(open) => {
          if (!open) {
            setWeekEditorState(null);
            setWeekFormState(null);
            setWeekFormError(null);
          }
        }}
      >
        <SheetContent className="max-w-[390px] sm:max-w-[430px]">
          <SheetHeader className="px-5 py-4">
            <SheetTitle>{weekEditorState?.mode === "edit" ? "Edit shift" : "Create shift"}</SheetTitle>
            <SheetDescription>
              {canManageSchedule
                ? "Keep all edits inside this property context. Employee choices stay limited to staff assigned here."
                : "Schedule details are read only for your current role."}
            </SheetDescription>
          </SheetHeader>

          {weekFormState ? (
            <form onSubmit={(event) => void handleWeekSubmit(event)} className="flex min-h-0 flex-1 flex-col">
              <SheetBody className="min-h-0 flex-1 space-y-4 px-5 py-4">
                {editingShift?.employee?.employmentStatus &&
                editingShift.employee.employmentStatus.trim().toLowerCase() !== "active" ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground">
                    <UserRoundX className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <p>This shift is attached to an inactive employee record and should be corrected before publishing.</p>
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="schedule-shift-date">Date</Label>
                    <Input
                      id="schedule-shift-date"
                      type="date"
                      value={weekFormState.date}
                      disabled={!canManageSchedule}
                      onChange={(event) => setWeekFormState((current) => (current ? { ...current, date: event.target.value } : current))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="schedule-shift-status">Status</Label>
                    <Select
                      value={weekFormState.status}
                      onValueChange={(value) =>
                        setWeekFormState((current) =>
                          current
                            ? {
                                ...current,
                                employeeId: value === "open" ? "" : current.employeeId,
                                status: value as PropertyScheduleShiftStatus,
                              }
                            : current
                        )
                      }
                      disabled={!canManageSchedule}
                    >
                      <SelectTrigger id="schedule-shift-status" className="w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="open">Open shift</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="schedule-shift-employee">Employee</Label>
                  <Select
                    value={weekFormState.employeeId || "unassigned"}
                    onValueChange={(value) =>
                      setWeekFormState((current) =>
                        current ? { ...current, employeeId: !value || value === "unassigned" ? "" : value } : current
                      )
                    }
                    disabled={!canManageSchedule || weekFormState.status === "open"}
                  >
                    <SelectTrigger id="schedule-shift-employee" className="w-full">
                      <SelectValue placeholder="Choose an assigned employee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {weekEmployeeOptions.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Only employees assigned to {property.name} appear here. Inactive employees are hidden from new scheduling.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="schedule-shift-start">Start time</Label>
                    <Input
                      id="schedule-shift-start"
                      type="time"
                      value={weekFormState.startTime}
                      disabled={!canManageSchedule}
                      onChange={(event) => setWeekFormState((current) => (current ? { ...current, startTime: event.target.value } : current))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="schedule-shift-end">End time</Label>
                    <Input
                      id="schedule-shift-end"
                      type="time"
                      value={weekFormState.endTime}
                      disabled={!canManageSchedule}
                      onChange={(event) => setWeekFormState((current) => (current ? { ...current, endTime: event.target.value } : current))}
                    />
                    <p className="text-sm text-muted-foreground">
                      If the end time is earlier than the start time, the shift rolls into the next day.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                  <div className="space-y-2">
                    <Label htmlFor="schedule-shift-position">Position label</Label>
                    <Input
                      id="schedule-shift-position"
                      value={weekFormState.positionLabel}
                      disabled={!canManageSchedule}
                      onChange={(event) => setWeekFormState((current) => (current ? { ...current, positionLabel: event.target.value } : current))}
                      placeholder="Front Desk"
                    />
                    <p className="text-sm text-muted-foreground">
                      Leave this blank to let the backend default from the active pay-rate title.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="schedule-shift-break">Break minutes</Label>
                    <Input
                      id="schedule-shift-break"
                      type="number"
                      min={0}
                      step={1}
                      value={weekFormState.breakMinutes}
                      disabled={!canManageSchedule}
                      onChange={(event) => setWeekFormState((current) => (current ? { ...current, breakMinutes: event.target.value } : current))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="schedule-shift-notes">Notes</Label>
                  <Textarea
                    id="schedule-shift-notes"
                    value={weekFormState.notes}
                    disabled={!canManageSchedule}
                    onChange={(event) => setWeekFormState((current) => (current ? { ...current, notes: event.target.value } : current))}
                    placeholder="Shift notes, handoff details, or coverage context"
                  />
                </div>
              </SheetBody>

              <SheetFooter className="sticky bottom-0 bg-card px-5 py-4">
                {weekEditorState?.mode === "edit" && canManageSchedule ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => void handleDeleteWeekShift()}
                    disabled={isDeletingShift || isSavingShift}
                    className="sm:mr-auto"
                  >
                    {isDeletingShift ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    Delete shift
                  </Button>
                ) : null}

                <Button type="button" variant="outline" onClick={() => setWeekEditorState(null)}>
                  Close
                </Button>

                {canManageSchedule ? (
                  <Button type="submit" disabled={isSavingShift || isDeletingShift}>
                    {isSavingShift ? <LoaderCircle className="size-4 animate-spin" /> : null}
                    {weekEditorState?.mode === "edit" ? "Save changes" : "Create shift"}
                  </Button>
                ) : null}
              </SheetFooter>
            </form>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet
        open={isTemplateSheetOpen}
        onOpenChange={(open) => {
          if (!open) {
            setTemplateEditorState(null);
            setTemplateFormState(null);
            setTemplateFormError(null);
          }
        }}
      >
        <SheetContent className="max-w-[390px] sm:max-w-[430px]">
          <SheetHeader className="px-5 py-4">
            <SheetTitle>{templateEditorState?.mode === "edit" ? "Edit template shift" : "Create template shift"}</SheetTitle>
            <SheetDescription>
              Template edits stay property-scoped and save a reusable weekly pattern instead of a live week.
            </SheetDescription>
          </SheetHeader>

          {templateFormState && selectedTemplate ? (
            <form onSubmit={(event) => void handleTemplateShiftSubmit(event)} className="flex min-h-0 flex-1 flex-col">
              <SheetBody className="min-h-0 flex-1 space-y-4 px-5 py-4">
                {editingTemplateShift?.employee?.employmentStatus &&
                editingTemplateShift.employee.employmentStatus.trim().toLowerCase() !== "active" ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground">
                    <UserRoundX className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <p>This template shift is attached to an inactive employee record and should be corrected.</p>
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="template-shift-day">Day</Label>
                    <Select
                      value={templateFormState.dayIndex}
                      onValueChange={(value) =>
                        setTemplateFormState((current) =>
                          current ? { ...current, dayIndex: value ?? current.dayIndex } : current
                        )
                      }
                      disabled={!canManageSchedule}
                    >
                      <SelectTrigger id="template-shift-day" className="w-full">
                        <SelectValue placeholder="Choose a day" />
                      </SelectTrigger>
                      <SelectContent>
                        {scheduleWeek.days.map((day, index) => (
                          <SelectItem key={day.date} value={String(index)}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-shift-status">Status</Label>
                    <Select
                      value={templateFormState.status}
                      onValueChange={(value) =>
                        setTemplateFormState((current) =>
                          current
                            ? {
                                ...current,
                                employeeId: value === "open" ? "" : current.employeeId,
                                status: value as PropertyScheduleShiftStatus,
                              }
                            : current
                        )
                      }
                      disabled={!canManageSchedule}
                    >
                      <SelectTrigger id="template-shift-status" className="w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="open">Open shift</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-shift-employee">Employee</Label>
                  <Select
                    value={templateFormState.employeeId || "unassigned"}
                    onValueChange={(value) =>
                      setTemplateFormState((current) =>
                        current ? { ...current, employeeId: !value || value === "unassigned" ? "" : value } : current
                      )
                    }
                    disabled={!canManageSchedule || templateFormState.status === "open"}
                  >
                    <SelectTrigger id="template-shift-employee" className="w-full">
                      <SelectValue placeholder="Choose an assigned employee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {templateEmployeeOptions.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Template assignments stay limited to staff currently assigned to {property.name}.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="template-shift-start">Start time</Label>
                    <Input
                      id="template-shift-start"
                      type="time"
                      value={templateFormState.startTime}
                      disabled={!canManageSchedule}
                      onChange={(event) => setTemplateFormState((current) => (current ? { ...current, startTime: event.target.value } : current))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-shift-end">End time</Label>
                    <Input
                      id="template-shift-end"
                      type="time"
                      value={templateFormState.endTime}
                      disabled={!canManageSchedule}
                      onChange={(event) => setTemplateFormState((current) => (current ? { ...current, endTime: event.target.value } : current))}
                    />
                    <p className="text-sm text-muted-foreground">
                      If the end time is earlier than the start time, the template shift rolls into the next day.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                  <div className="space-y-2">
                    <Label htmlFor="template-shift-position">Position label</Label>
                    <Input
                      id="template-shift-position"
                      value={templateFormState.positionLabel}
                      disabled={!canManageSchedule}
                      onChange={(event) => setTemplateFormState((current) => (current ? { ...current, positionLabel: event.target.value } : current))}
                      placeholder="Housekeeping"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-shift-break">Break minutes</Label>
                    <Input
                      id="template-shift-break"
                      type="number"
                      min={0}
                      step={1}
                      value={templateFormState.breakMinutes}
                      disabled={!canManageSchedule}
                      onChange={(event) => setTemplateFormState((current) => (current ? { ...current, breakMinutes: event.target.value } : current))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-shift-notes">Notes</Label>
                  <Textarea
                    id="template-shift-notes"
                    value={templateFormState.notes}
                    disabled={!canManageSchedule}
                    onChange={(event) => setTemplateFormState((current) => (current ? { ...current, notes: event.target.value } : current))}
                    placeholder="Reusable handoff notes or role context"
                  />
                </div>
              </SheetBody>

              <SheetFooter className="sticky bottom-0 bg-card px-5 py-4">
                {templateEditorState?.mode === "edit" && canManageSchedule ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => void handleDeleteTemplateShift()}
                    disabled={isUpdatingTemplate}
                    className="sm:mr-auto"
                  >
                    {isUpdatingTemplate ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    Delete shift
                  </Button>
                ) : null}

                <Button type="button" variant="outline" onClick={() => setTemplateEditorState(null)}>
                  Close
                </Button>

                {canManageSchedule ? (
                  <Button type="submit" disabled={isUpdatingTemplate}>
                    {isUpdatingTemplate ? <LoaderCircle className="size-4 animate-spin" /> : null}
                    {templateEditorState?.mode === "edit" ? "Save changes" : "Create shift"}
                  </Button>
                ) : null}
              </SheetFooter>
            </form>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
