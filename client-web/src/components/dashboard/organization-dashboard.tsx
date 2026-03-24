import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CalendarClock,
  Clock3,
  CreditCard,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  TriangleAlert,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link, useSearchParams } from "react-router-dom";

import { PropertyCreationForm } from "@/components/onboarding/property-creation-form";
import { PageTransition } from "@/components/layout/page-transition";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClientOrganizations } from "@/hooks/useClientOrganizations";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  formatDashboardRole,
  useOrganizationDashboard,
  type DashboardAlert,
  type DashboardAnalyticsTab,
  type DashboardMetric,
  type DashboardRange,
  type DashboardShift,
} from "@/hooks/useOrganizationDashboard";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-US");
const hourFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const rangeOptions: Array<{ value: DashboardRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const analyticsTabs: Array<{
  value: DashboardAnalyticsTab;
  label: string;
  description: string;
}> = [
  { value: "hours", label: "Hours", description: "Cross-property labor balance and attendance." },
  { value: "employees", label: "Employees", description: "Coverage, distribution, and active staffing mix." },
  { value: "payroll", label: "Payroll", description: "Spend accumulation and premium cost visibility." },
];

const chartPalette = [
  "hsl(var(--primary))",
  "hsl(var(--primary) / 0.82)",
  "hsl(var(--primary) / 0.68)",
  "hsl(var(--primary) / 0.54)",
  "hsl(var(--primary) / 0.42)",
  "hsl(var(--primary) / 0.32)",
];

function formatMetricValue(metric: DashboardMetric) {
  switch (metric.variant) {
    case "currency":
      return currencyFormatter.format(metric.value);
    case "hours":
      return `${hourFormatter.format(metric.value)}h`;
    case "integer":
      return numberFormatter.format(metric.value);
  }
}

function formatHours(value: number) {
  return `${hourFormatter.format(value)}h`;
}

function formatDelta(delta: number) {
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;
}

function renderMetricIcon(metricId: DashboardMetric["id"]) {
  switch (metricId) {
    case "employees":
      return <Users className="size-5" />;
    case "properties":
      return <Building2 className="size-5" />;
    case "hours":
      return <Clock3 className="size-5" />;
    case "shifts":
      return <CalendarClock className="size-5" />;
    case "payroll":
      return <CreditCard className="size-5" />;
    case "limits":
      return <TriangleAlert className="size-5" />;
  }
}

function getMetricToneClasses(tone: DashboardMetric["tone"]) {
  switch (tone) {
    case "positive":
      return "bg-primary-soft text-foreground";
    case "negative":
      return "bg-destructive-soft text-destructive";
    case "neutral":
      return "bg-muted text-foreground";
    case "warning":
      return "bg-accent text-foreground";
  }
}

function getTrendClasses(tone: DashboardMetric["tone"], delta: number) {
  if (tone === "warning") {
    return "text-foreground";
  }

  if (tone === "negative" || delta < 0) {
    return "text-destructive";
  }

  return "text-foreground";
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "active":
    case "online":
    case "on-time":
      return "bg-primary-soft text-foreground";
    case "inactive":
    case "offline":
      return "bg-muted text-muted-foreground";
    case "late":
    case "away":
      return "bg-accent text-foreground";
    case "open":
      return "bg-secondary text-secondary-foreground";
    default:
      return "bg-muted text-foreground";
  }
}

function getAlertClass(severity: DashboardAlert["severity"]) {
  switch (severity) {
    case "critical":
      return "border-destructive/20 bg-destructive-soft/70";
    case "warning":
      return "border-border bg-accent/70";
    case "info":
      return "border-border bg-muted/70";
  }
}

function getShiftBadgeClass(status: DashboardShift["status"]) {
  switch (status) {
    case "active":
      return "bg-primary-soft text-foreground";
    case "upcoming":
      return "bg-secondary text-secondary-foreground";
    case "open":
      return "bg-muted text-foreground";
    case "late":
      return "bg-accent text-foreground";
  }
}

function getRoleClass(role: string) {
  switch (role) {
    case "owner":
      return "bg-primary-soft text-foreground";
    case "admin":
      return "bg-secondary text-secondary-foreground";
    case "manager":
      return "bg-accent text-accent-foreground";
    default:
      return "bg-muted text-foreground";
  }
}

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase())
    .join("");
}

function resolveRange(value: string | null): DashboardRange {
  if (value === "today" || value === "week" || value === "month") {
    return value;
  }

  return "week";
}

function resolveAnalyticsTab(value: string | null): DashboardAnalyticsTab {
  if (value === "hours" || value === "employees" || value === "payroll") {
    return value;
  }

  return "hours";
}

type ChartTooltipEntry = {
  dataKey?: string | number;
  name?: string;
  value?: number | string;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string;
};

function AnalyticsTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-sm">
      <p className="font-medium text-foreground">{label}</p>
      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="font-medium text-foreground">
              {typeof entry.value === "number" ? hourFormatter.format(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CurrencyTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-sm">
      <p className="font-medium text-foreground">{label}</p>
      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="font-medium text-foreground">
              {typeof entry.value === "number" ? currencyFormatter.format(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-1">
        {eyebrow ? <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">{eyebrow}</p> : null}
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function AnimatedValue({
  value,
  formatter,
}: {
  value: number;
  formatter: (value: number) => string;
}) {
  return <span>{formatter(value)}</span>;
}

function MetricCard({ metric, index }: { metric: DashboardMetric; index: number }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03, ease: "easeOut" }}
      whileHover={shouldReduceMotion ? undefined : { y: -2, scale: 1.01 }}
    >
      <Card className="border-border/80 bg-card/95 shadow-sm">
        <CardContent className="space-y-5 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className={cn("flex size-11 items-center justify-center rounded-2xl", getMetricToneClasses(metric.tone))}>
              {renderMetricIcon(metric.id)}
            </div>
            <div className={cn("flex items-center gap-1 text-sm font-medium", getTrendClasses(metric.tone, metric.delta))}>
              {metric.delta >= 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
              <span>{formatDelta(metric.delta)}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{metric.label}</p>
            <div className="text-2xl font-semibold tracking-tight text-foreground">
              <AnimatedValue
                value={metric.value}
                formatter={(nextValue) =>
                  formatMetricValue({
                    ...metric,
                    value: metric.variant === "currency" ? Math.round(nextValue) : Number(nextValue.toFixed(1)),
                  })
                }
              />
            </div>
            <p className="text-sm text-muted-foreground">{metric.helper}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function RestrictedOverlay({
  title,
  description,
  actionLabel,
}: {
  title: string;
  description: string;
  actionLabel: string;
}) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/72 p-6 backdrop-blur-sm">
      <div className="max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-soft">
          <ShieldCheck className="size-5 text-foreground" />
        </div>
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button type="button" className="w-full">
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

function ShiftList({
  shifts,
  emptyTitle,
  emptyDescription,
}: {
  shifts: DashboardShift[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (shifts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-6 text-center">
        <p className="font-medium text-foreground">{emptyTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {shifts.map((shift) => (
        <div
          key={shift.id}
          className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-background/80 px-4 py-3"
        >
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">{shift.employee ?? "Unassigned shift"}</p>
              <Badge className={cn("border-transparent", getShiftBadgeClass(shift.status))}>
                {shift.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{shift.property}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium text-foreground">{shift.start}</p>
            <p className="text-muted-foreground">{shift.end}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function LoadingDashboard() {
  return (
    <div className="space-y-8">
      <Card className="border-border/80 bg-card/95 shadow-sm">
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-72" />
              <Skeleton className="h-4 w-full max-w-xl" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-9 w-44 rounded-xl" />
                <Skeleton className="h-9 w-36 rounded-xl" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-10 rounded-xl sm:col-span-2" />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-40 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[320px] rounded-2xl" />
      <Skeleton className="h-[540px] rounded-2xl" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-[420px] rounded-2xl" />
        <Skeleton className="h-[420px] rounded-2xl" />
      </div>
    </div>
  );
}

export function OrganizationDashboard() {
  const shouldReduceMotion = useReducedMotion();
  const { signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [propertySearch, setPropertySearch] = useState("");
  const [propertyFilter, setPropertyFilter] = useState<"all" | "active" | "inactive">("all");
  const [isCreatePropertyOpen, setIsCreatePropertyOpen] = useState(false);

  const deferredPropertySearch = useDeferredValue(propertySearch);
  const range = resolveRange(searchParams.get("range"));
  const selectedAnalyticsTab = resolveAnalyticsTab(searchParams.get("analytics"));
  const selectedOrganizationId = searchParams.get("orgId");
  const focusedPropertyId = searchParams.get("propertyId");

  const { data: currentUser, isLoading: isUserLoading, isError: isUserError } = useCurrentUser();
  const {
    data: organizations = [],
    isLoading: isOrganizationsLoading,
    isError: isOrganizationsError,
  } = useClientOrganizations();

  const selectedOrganization =
    organizations.find((organization) => organization.id === selectedOrganizationId) ?? organizations[0] ?? null;
  const organizationIndex = selectedOrganization
    ? Math.max(
        0,
        organizations.findIndex((organization) => organization.id === selectedOrganization.id),
      )
    : 0;

  const {
    data: dashboard,
    isLoading: isDashboardLoading,
    isError: isDashboardError,
  } = useOrganizationDashboard({
    organization: selectedOrganization,
    organizationIndex,
    user: currentUser ?? null,
    range,
  });

  useEffect(() => {
    if (organizations.length === 0) {
      return;
    }

    if (!selectedOrganizationId || !organizations.some((organization) => organization.id === selectedOrganizationId)) {
      const preferredOrganizationId =
        currentUser?.lastActiveOrganizationId &&
        organizations.some((organization) => organization.id === currentUser.lastActiveOrganizationId)
          ? currentUser.lastActiveOrganizationId
          : organizations[0]?.id;

      if (!preferredOrganizationId) {
        return;
      }

      startTransition(() => {
        setSearchParams(
          (previousParams) => {
            const nextParams = new URLSearchParams(previousParams);
            nextParams.set("orgId", preferredOrganizationId);
            nextParams.set("range", range);
            nextParams.set("analytics", selectedAnalyticsTab);
            return nextParams;
          },
          { replace: true },
        );
      });
    }
  }, [
    currentUser?.lastActiveOrganizationId,
    organizations,
    range,
    selectedAnalyticsTab,
    selectedOrganizationId,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!dashboard || !focusedPropertyId) {
      return;
    }

    if (!dashboard.properties.some((property) => property.id === focusedPropertyId)) {
      startTransition(() => {
        setSearchParams(
          (previousParams) => {
            const nextParams = new URLSearchParams(previousParams);
            nextParams.delete("propertyId");
            return nextParams;
          },
          { replace: true },
        );
      });
    }
  }, [dashboard, focusedPropertyId, setSearchParams]);

  const updateParams = (updates: Record<string, string | null>) => {
    startTransition(() => {
      setSearchParams(
        (previousParams) => {
          const nextParams = new URLSearchParams(previousParams);

          Object.entries(updates).forEach(([key, value]) => {
            if (value) {
              nextParams.set(key, value);
            } else {
              nextParams.delete(key);
            }
          });

          return nextParams;
        },
        { replace: true },
      );
    });
  };

  const focusedProperty = dashboard?.properties.find((property) => property.id === focusedPropertyId) ?? null;
  const focusedPropertyName = focusedProperty?.name ?? null;

  const filteredProperties = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    return dashboard.properties.filter((property) => {
      if (propertyFilter !== "all" && property.status !== propertyFilter) {
        return false;
      }

      if (!deferredPropertySearch.trim()) {
        return true;
      }

      const query = deferredPropertySearch.trim().toLowerCase();
      return (
        property.name.toLowerCase().includes(query) ||
        property.location.toLowerCase().includes(query) ||
        property.timezone.toLowerCase().includes(query)
      );
    });
  }, [dashboard, deferredPropertySearch, propertyFilter]);

  const scopedClockIns = useMemo(() => {
    if (!dashboard || !focusedPropertyName) {
      return dashboard?.recentClockIns ?? [];
    }

    return dashboard.recentClockIns.filter((clockIn) => clockIn.property === focusedPropertyName);
  }, [dashboard, focusedPropertyName]);

  const scopedCoverageGaps = useMemo(() => {
    if (!dashboard || !focusedPropertyName) {
      return dashboard?.employeesWithoutShifts ?? [];
    }

    return dashboard.employeesWithoutShifts.filter((gap) => gap.property === focusedPropertyName);
  }, [dashboard, focusedPropertyName]);

  const scopedTodayShifts = useMemo(() => {
    if (!dashboard || !focusedPropertyName) {
      return dashboard?.shifts.today ?? [];
    }

    return dashboard.shifts.today.filter((shift) => shift.property === focusedPropertyName);
  }, [dashboard, focusedPropertyName]);

  const scopedUpcomingShifts = useMemo(() => {
    if (!dashboard || !focusedPropertyName) {
      return dashboard?.shifts.upcoming ?? [];
    }

    return dashboard.shifts.upcoming.filter((shift) => shift.property === focusedPropertyName);
  }, [dashboard, focusedPropertyName]);

  const scopedOpenShifts = useMemo(() => {
    if (!dashboard || !focusedPropertyName) {
      return dashboard?.shifts.open ?? [];
    }

    return dashboard.shifts.open.filter((shift) => shift.property === focusedPropertyName);
  }, [dashboard, focusedPropertyName]);

  const scopedAlerts = useMemo(() => {
    if (!dashboard || !focusedPropertyName) {
      return dashboard?.alerts ?? [];
    }

    return dashboard.alerts.filter((alert) => alert.property === focusedPropertyName || alert.property === "Billing");
  }, [dashboard, focusedPropertyName]);

  const analyticsSummary = useMemo(() => {
    if (!dashboard) {
      return null;
    }

    switch (selectedAnalyticsTab) {
      case "hours":
        return {
          kicker: "Hours",
          note: `${formatHours(dashboard.metrics.find((metric) => metric.id === "hours")?.value ?? 0)} across ${dashboard.properties.length} properties`,
          areaLabel: "Accumulated hours",
        };
      case "employees":
        return {
          kicker: "Employees",
          note: `${numberFormatter.format(
            dashboard.metrics.find((metric) => metric.id === "employees")?.value ?? 0,
          )} people distributed across the organization`,
          areaLabel: "Coverage load",
        };
      case "payroll":
        return {
          kicker: "Payroll",
          note: currencyFormatter.format(dashboard.billing.monthlySpend),
          areaLabel: "Payroll hour accumulation",
        };
    }
  }, [dashboard, selectedAnalyticsTab]);

  if (isUserLoading || isOrganizationsLoading || (selectedOrganization && isDashboardLoading && !dashboard)) {
    return (
      <PageTransition className="bg-background">
        <div className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <LoadingDashboard />
        </div>
      </PageTransition>
    );
  }

  if (isUserError || isOrganizationsError || isDashboardError) {
    return (
      <PageTransition className="bg-background">
        <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-8 sm:px-6 lg:px-8">
          <Card className="w-full border-border/80 bg-card shadow-sm">
            <CardContent className="space-y-5 pt-6 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-destructive-soft">
                <AlertTriangle className="size-6 text-destructive" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Unable to load the organization workspace</h1>
                <p className="text-sm text-muted-foreground">
                  The dashboard could not assemble the current org context. Verify the authenticated client APIs and reload this route.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link to="/onboarding/create-organization" className={cn(buttonVariants({ variant: "outline" }))}>
                  Create organization
                </Link>
                <Button type="button" variant="ghost" onClick={() => void signOut()}>
                  Sign out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    );
  }

  if (!selectedOrganization || organizations.length === 0 || !dashboard || !analyticsSummary) {
    return (
      <PageTransition className="bg-background">
        <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-8 sm:px-6 lg:px-8">
          <Card className="w-full border-border/80 bg-card shadow-sm">
            <CardContent className="space-y-5 pt-6 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-soft">
                <Building2 className="size-6 text-foreground" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">No organization workspace yet</h1>
                <p className="text-sm text-muted-foreground">
                  Create the first organization to unlock the client dashboard and start managing cross-property workforce data.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link to="/onboarding/create-organization" className={cn(buttonVariants({ variant: "default" }))}>
                  <Plus className="size-4" />
                  Create organization
                </Link>
                <Button type="button" variant="ghost" onClick={() => void signOut()}>
                  Sign out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    );
  }

  const rangeDescription = range === "today" ? "today" : range === "week" ? "this week" : "this month";

  return (
    <PageTransition className="bg-background">
      <div className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: shouldReduceMotion ? 0 : 0.04,
              },
            },
          }}
          className="space-y-8"
        >
          <motion.section
            variants={{
              hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
              show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
            }}
          >
            <Card className="relative overflow-hidden border-border/80 bg-card/95 shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-br from-transparent via-primary-soft/20 to-primary-soft/60 lg:block" />
              <CardContent className="relative space-y-6 pt-6">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-border bg-background/80 text-foreground">
                        Organization workspace
                      </Badge>
                      <Badge className={cn("border-transparent", getRoleClass(dashboard.role))}>
                        {formatDashboardRole(dashboard.role)} view
                      </Badge>
                      <Badge variant="secondary" className="capitalize">
                        {dashboard.billing.plan}
                      </Badge>
                      {dashboard.previewData ? <Badge variant="secondary">Preview data</Badge> : null}
                    </div>
                    <div className="space-y-2">
                      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{selectedOrganization.name}</h1>
                      <p className="max-w-2xl text-sm text-muted-foreground">
                        Cross-property staffing, scheduling, payroll, and permissions for {rangeDescription}. Property drill-in stays available from the selector panel without losing the org-wide view.
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-1 rounded-2xl border border-border bg-background/80 p-4">
                        <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Timezone</p>
                        <p className="text-sm font-medium text-foreground">{selectedOrganization.timezone}</p>
                      </div>
                      <div className="space-y-1 rounded-2xl border border-border bg-background/80 p-4">
                        <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Data scope</p>
                        <p className="text-sm font-medium text-foreground">
                          {dashboard.previewData ? "Live org, preview metrics" : "Live properties, seeded insights"}
                        </p>
                      </div>
                      <div className="space-y-1 rounded-2xl border border-border bg-background/80 p-4">
                        <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Focused property</p>
                        <p className="text-sm font-medium text-foreground">{focusedPropertyName ?? "All properties"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:min-w-[360px]">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="organization-switch">Organization</Label>
                        <Select
                          value={selectedOrganization.id}
                          onValueChange={(nextValue) => {
                            setIsCreatePropertyOpen(false);
                            setPropertySearch("");
                            setPropertyFilter("all");
                            updateParams({
                              orgId: nextValue,
                              propertyId: null,
                            });
                          }}
                        >
                          <SelectTrigger id="organization-switch" className="w-full">
                            <SelectValue placeholder="Select organization" />
                          </SelectTrigger>
                          <SelectContent>
                            {organizations.map((organization) => (
                              <SelectItem key={organization.id} value={organization.id}>
                                {organization.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Date range</Label>
                        <div className="grid grid-cols-3 rounded-xl border border-border bg-muted/80 p-1">
                          {rangeOptions.map((option) => {
                            const isActive = option.value === range;

                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => updateParams({ range: option.value })}
                                className={cn(
                                  "relative rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {isActive ? (
                                  <motion.span
                                    layoutId="range-highlight"
                                    className="absolute inset-0 rounded-lg bg-card shadow-sm"
                                    transition={{ duration: 0.18, ease: "easeOut" }}
                                  />
                                ) : null}
                                <span className="relative z-10">{option.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        onClick={() => setIsCreatePropertyOpen((previous) => !previous)}
                        disabled={!dashboard.permissions.canAddProperty}
                      >
                        <Plus className="size-4" />
                        {dashboard.permissions.canAddProperty ? "Add property" : "Add property locked"}
                      </Button>
                      {!dashboard.permissions.canAddProperty ? (
                        <Badge variant="secondary">
                          {dashboard.role === "manager" ? "Owner/Admin only" : "Upgrade for more properties"}
                        </Badge>
                      ) : null}
                      <div className="ml-auto flex items-center gap-2">
                        <ThemeToggle />
                        <Button type="button" variant="ghost" size="sm" onClick={() => void signOut()}>
                          <LogOut className="size-4" />
                          Sign out
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {isCreatePropertyOpen ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <PropertyCreationForm
                        organizationId={selectedOrganization.id}
                        defaultTimezone={selectedOrganization.timezone}
                        onCancel={() => setIsCreatePropertyOpen(false)}
                        onCreated={() => {
                          setIsCreatePropertyOpen(false);
                        }}
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.section>

          <motion.section
            variants={{
              hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
              show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
            }}
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {dashboard.metrics.map((metric, index) => (
                <MetricCard key={metric.id} metric={metric} index={index} />
              ))}
            </div>
          </motion.section>

          <motion.section
            variants={{
              hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
              show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
            }}
          >
            <Card className="border-border/80 bg-card/95 shadow-sm">
              <CardHeader className="space-y-5">
                <SectionHeader
                  eyebrow="Properties"
                  title="Property selector"
                  description="Search, filter, and drill into a single property while keeping the org dashboard context intact."
                  action={
                    focusedPropertyName ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => updateParams({ propertyId: null })}>
                        Clear focus
                      </Button>
                    ) : null
                  }
                />
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="space-y-2">
                    <Label htmlFor="property-search">Search properties</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="property-search"
                        value={propertySearch}
                        onChange={(event) => setPropertySearch(event.target.value)}
                        placeholder="Search by property, location, or timezone"
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="property-filter">Filter</Label>
                    <Select value={propertyFilter} onValueChange={(value) => setPropertyFilter(value as typeof propertyFilter)}>
                      <SelectTrigger id="property-filter" className="w-full">
                        <SelectValue placeholder="Filter properties" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All properties</SelectItem>
                        <SelectItem value="active">Active only</SelectItem>
                        <SelectItem value="inactive">Inactive only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {dashboard.previewData ? (
                  <div className="rounded-2xl border border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                    No live properties are attached yet. Preview property data is shown here so the organization dashboard still has a usable operational baseline.
                  </div>
                ) : null}
              </CardHeader>
              <CardContent>
                {filteredProperties.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredProperties.map((property) => {
                      const isFocused = property.id === focusedPropertyId;

                      return (
                        <motion.div
                          key={property.id}
                          whileHover={shouldReduceMotion ? undefined : { y: -2, scale: 1.01 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                        >
                          <Card className={cn("h-full border-border/80 bg-background/80 shadow-sm", isFocused && "border-primary/40 bg-primary-soft/20")}>
                            <CardContent className="space-y-5 pt-6">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-base font-semibold text-foreground">{property.name}</h3>
                                    <Badge className={cn("border-transparent capitalize", getStatusBadgeClass(property.status))}>
                                      {property.status}
                                    </Badge>
                                    {property.preview ? <Badge variant="secondary">Preview</Badge> : null}
                                  </div>
                                  <p className="text-sm text-muted-foreground">{property.location}</p>
                                </div>
                                <Badge variant="outline">{property.timezone}</Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-2xl border border-border bg-card px-4 py-3">
                                  <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Active employees</p>
                                  <p className="mt-2 text-xl font-semibold text-foreground">{numberFormatter.format(property.activeEmployees)}</p>
                                </div>
                                <div className="rounded-2xl border border-border bg-card px-4 py-3">
                                  <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Today's hours</p>
                                  <p className="mt-2 text-xl font-semibold text-foreground">{formatHours(property.todayHours)}</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm text-muted-foreground">
                                  {property.openShifts > 0
                                    ? `${property.openShifts} open shifts need coverage`
                                    : "Shift coverage is staffed"}
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={isFocused ? "secondary" : "outline"}
                                  onClick={() =>
                                    updateParams({
                                      propertyId: isFocused ? null : property.id,
                                    })
                                  }
                                >
                                  {isFocused ? "Viewing" : "Open Dashboard"}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-10 text-center">
                    <p className="text-base font-semibold text-foreground">No properties match the current filters</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Adjust the search query or filter to bring properties back into scope.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.section>

          <motion.section
            variants={{
              hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
              show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
            }}
          >
            <Card className="border-border/80 bg-card/95 shadow-sm">
              <CardHeader className="space-y-5">
                <SectionHeader
                  eyebrow="Analytics"
                  title="Org-wide analytics"
                  description="Premium reporting across hours, employees, and payroll. Charts stay subtle, fast, and comparable across the selected range."
                  action={
                    <div className="flex items-center gap-2">
                      <Badge variant={dashboard.billing.analyticsEntitlement ? "secondary" : "outline"}>
                        {dashboard.billing.analyticsEntitlement ? "Analytics active" : "Analytics locked"}
                      </Badge>
                      <Button type="button" variant="outline" size="sm" disabled={!dashboard.billing.analyticsEntitlement}>
                        Export report
                      </Button>
                    </div>
                  }
                />
                <Tabs
                  value={selectedAnalyticsTab}
                  onValueChange={(nextValue) => updateParams({ analytics: nextValue as string })}
                  className="space-y-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <TabsList>
                      {analyticsTabs.map((tab) => (
                        <TabsTrigger key={tab.value} value={tab.value}>
                          {tab.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    <p className="text-sm text-muted-foreground">
                      {analyticsTabs.find((tab) => tab.value === selectedAnalyticsTab)?.description}
                    </p>
                  </div>

                  <div className="relative">
                    {!dashboard.billing.analyticsEntitlement ? (
                      <RestrictedOverlay
                        title="Upgrade to view analytics"
                        description="Cross-property charts and exports are available on paid plans. Property navigation and baseline metrics remain active."
                        actionLabel="Upgrade to Pro"
                      />
                    ) : null}
                    <div className={cn("space-y-4", !dashboard.billing.analyticsEntitlement && "pointer-events-none blur-sm")}>
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={selectedAnalyticsTab}
                          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -6 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                          className="space-y-4"
                        >
                          <div className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{analyticsSummary.kicker}</span>
                            {" · "}
                            {analyticsSummary.note}
                          </div>

                          {analyticsTabs.map((tab) => (
                            <TabsContent key={tab.value} value={tab.value}>
                              <div className="grid gap-4 xl:grid-cols-2">
                                <div className="rounded-2xl border border-border bg-background/80 p-4">
                                  <div className="mb-4 space-y-1">
                                    <h3 className="font-semibold text-foreground">Hours worked per property</h3>
                                    <p className="text-sm text-muted-foreground">Compare the current range across all properties.</p>
                                  </div>
                                  <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <BarChart data={dashboard.breakdown}>
                                        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                                        <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                                        <Tooltip content={tab.value === "payroll" ? <CurrencyTooltip /> : <AnalyticsTooltip />} />
                                        <Bar dataKey={tab.value === "hours" ? "hours" : tab.value === "employees" ? "employees" : "payroll"} radius={[12, 12, 4, 4]} fill="hsl(var(--primary))" name={tab.label} />
                                      </BarChart>
                                    </ResponsiveContainer>
                                  </div>
                                </div>

                                <div className="rounded-2xl border border-border bg-background/80 p-4">
                                  <div className="mb-4 space-y-1">
                                    <h3 className="font-semibold text-foreground">Trend over time</h3>
                                    <p className="text-sm text-muted-foreground">
                                      Rolling {range === "month" ? "30-day" : "7-day"} movement for the selected range.
                                    </p>
                                  </div>
                                  <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <LineChart data={dashboard.trend}>
                                        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                                        <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                                        <Tooltip content={tab.value === "payroll" ? <CurrencyTooltip /> : <AnalyticsTooltip />} />
                                        <Line
                                          type="monotone"
                                          dataKey={tab.value === "hours" ? "hours" : tab.value === "employees" ? "employees" : "payroll"}
                                          stroke="hsl(var(--primary))"
                                          strokeWidth={2.5}
                                          dot={false}
                                          activeDot={{ r: 4 }}
                                          name={tab.label}
                                        />
                                      </LineChart>
                                    </ResponsiveContainer>
                                  </div>
                                </div>

                                <div className="rounded-2xl border border-border bg-background/80 p-4">
                                  <div className="mb-4 space-y-1">
                                    <h3 className="font-semibold text-foreground">Workforce distribution</h3>
                                    <p className="text-sm text-muted-foreground">See how the organization is balanced by property.</p>
                                  </div>
                                  <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <PieChart>
                                        <Pie
                                          data={dashboard.breakdown}
                                          dataKey={tab.value === "hours" ? "hours" : tab.value === "employees" ? "employees" : "payroll"}
                                          innerRadius={64}
                                          outerRadius={104}
                                          paddingAngle={3}
                                          stroke="hsl(var(--background))"
                                          strokeWidth={2}
                                        >
                                          {dashboard.breakdown.map((entry, index) => (
                                            <Cell key={entry.name} fill={chartPalette[index % chartPalette.length]} />
                                          ))}
                                        </Pie>
                                        <Tooltip content={tab.value === "payroll" ? <CurrencyTooltip /> : <AnalyticsTooltip />} />
                                      </PieChart>
                                    </ResponsiveContainer>
                                  </div>
                                </div>

                                <div className="rounded-2xl border border-border bg-background/80 p-4">
                                  <div className="mb-4 space-y-1">
                                    <h3 className="font-semibold text-foreground">
                                      {tab.value === "payroll" ? "Payroll hours accumulation" : analyticsSummary.areaLabel}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                      Smooth accumulation helps expose pacing before payroll closes.
                                    </p>
                                  </div>
                                  <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <AreaChart data={dashboard.trend}>
                                        <defs>
                                          <linearGradient id="analytics-area" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.04} />
                                          </linearGradient>
                                        </defs>
                                        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                                        <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                                        <Tooltip content={<AnalyticsTooltip />} />
                                        <Area
                                          type="monotone"
                                          dataKey={tab.value === "hours" ? "cumulativePayrollHours" : tab.value === "employees" ? "employees" : "cumulativePayrollHours"}
                                          stroke="hsl(var(--primary))"
                                          fill="url(#analytics-area)"
                                          strokeWidth={2.5}
                                          name={tab.value === "employees" ? "Employees" : "Hours"}
                                        />
                                      </AreaChart>
                                    </ResponsiveContainer>
                                  </div>
                                </div>
                              </div>
                            </TabsContent>
                          ))}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                </Tabs>
              </CardHeader>
            </Card>
          </motion.section>

          <motion.section
            id="workforce-overview"
            variants={{
              hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
              show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
            }}
          >
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-border/80 bg-card/95 shadow-sm">
                <CardHeader className="space-y-5">
                  <SectionHeader
                    eyebrow="Workforce"
                    title="Workforce overview"
                    description={
                      focusedPropertyName
                        ? `Current staffing health for ${focusedPropertyName}.`
                        : "Active and inactive employee posture across the organization."
                    }
                  />
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-border bg-background/80 p-4">
                      <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Active</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {numberFormatter.format(
                          dashboard.properties.reduce((sum, property) => sum + property.activeEmployees, 0),
                        )}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-background/80 p-4">
                      <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Inactive</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {numberFormatter.format(
                          dashboard.properties.reduce((sum, property) => sum + property.inactiveEmployees, 0),
                        )}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-background/80 p-4">
                      <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Without shifts</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {numberFormatter.format(scopedCoverageGaps.length)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-foreground">Recently clocked in</h3>
                      <p className="text-sm text-muted-foreground">{rangeDescription}</p>
                    </div>
                    {scopedClockIns.length > 0 ? (
                      scopedClockIns.map((clockIn) => (
                        <div
                          key={clockIn.id}
                          className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/80 px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="size-11">
                              <AvatarImage src={clockIn.avatarUrl ?? undefined} alt={clockIn.name} />
                              <AvatarFallback>{getInitials(clockIn.name)}</AvatarFallback>
                            </Avatar>
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-foreground">{clockIn.name}</p>
                                <Badge className={cn("border-transparent", getStatusBadgeClass(clockIn.status))}>
                                  {clockIn.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {clockIn.role} · {clockIn.property}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm font-medium text-foreground">{clockIn.timeLabel}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center">
                        <p className="font-medium text-foreground">No recent clock-ins for the selected scope</p>
                        <p className="mt-1 text-sm text-muted-foreground">Clear the property focus to return to the org-wide list.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/80 bg-card/95 shadow-sm">
                <CardHeader>
                  <SectionHeader
                    eyebrow="Coverage"
                    title="Employees without assigned shifts"
                    description="Resolve these gaps before the next scheduling cycle closes."
                  />
                </CardHeader>
                <CardContent>
                  {scopedCoverageGaps.length > 0 ? (
                    <div className="space-y-3">
                      {scopedCoverageGaps.map((gap) => (
                        <div key={gap.id} className="rounded-2xl border border-border bg-background/80 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{gap.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {gap.role} · {gap.property}
                              </p>
                            </div>
                            <p className="text-sm text-muted-foreground">{gap.lastShift}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center">
                      <p className="font-medium text-foreground">Shift assignments look healthy</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Everyone in the current scope has an upcoming assignment on file.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.section>

          <motion.section
            variants={{
              hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
              show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
            }}
          >
            <Card className="border-border/80 bg-card/95 shadow-sm">
              <CardHeader className="space-y-5">
                <SectionHeader
                  eyebrow="Scheduling"
                  title="Scheduling overview"
                  description={
                    focusedPropertyName
                      ? `Shift activity and open coverage at ${focusedPropertyName}.`
                      : "Today's active labor, next-up shifts, and coverage gaps across all properties."
                  }
                />
              </CardHeader>
              <CardContent className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">Today's shifts</h3>
                    <Badge variant="secondary">{numberFormatter.format(scopedTodayShifts.length)} entries</Badge>
                  </div>
                  <ShiftList
                    shifts={scopedTodayShifts}
                    emptyTitle="No shifts in this scope today"
                    emptyDescription="Choose another property or clear the current focus."
                  />
                </div>
                <div className="grid gap-4">
                  <Card className="border-border/80 bg-background/80">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Upcoming shifts</CardTitle>
                      <CardDescription>Next scheduled starts that need a quick review.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ShiftList
                        shifts={scopedUpcomingShifts.slice(0, 3)}
                        emptyTitle="No upcoming shifts"
                        emptyDescription="Everything is either covered today or still being planned."
                      />
                    </CardContent>
                  </Card>
                  <Card className="border-border/80 bg-background/80">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Open and unassigned shifts</CardTitle>
                      <CardDescription>Coverage needs that should be filled next.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ShiftList
                        shifts={scopedOpenShifts.slice(0, 3)}
                        emptyTitle="No open shifts"
                        emptyDescription="Coverage is fully staffed in the selected scope."
                      />
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          <motion.section
            variants={{
              hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
              show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
            }}
          >
            <Card className="border-border/80 bg-card/95 shadow-sm">
              <CardHeader>
                <SectionHeader
                  eyebrow="Alerts"
                  title="Alerts and issues"
                  description="Operational exceptions are surfaced here first so supervisors can decide fast."
                />
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {scopedAlerts.map((alert) => (
                    <motion.div
                      key={alert.id}
                      whileHover={shouldReduceMotion ? undefined : { y: -2, scale: 1.01 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      <div className={cn("h-full rounded-2xl border p-4", getAlertClass(alert.severity))}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">{alert.title}</p>
                            <p className="text-sm text-muted-foreground">{alert.description}</p>
                          </div>
                          <Badge variant="outline">{alert.count}</Badge>
                        </div>
                        <div className="mt-4 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{alert.property}</span>
                          <span className="font-medium text-foreground capitalize">{alert.severity}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.section>

          <motion.section
            variants={{
              hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
              show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
            }}
          >
            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <Card className="relative border-border/80 bg-card/95 shadow-sm">
                {!dashboard.permissions.canManageBilling ? (
                  <RestrictedOverlay
                    title="Owner or admin access required"
                    description="Managers can view high-level plan posture, but billing controls stay restricted to owner and admin roles."
                    actionLabel="Access restricted"
                  />
                ) : null}
                <CardHeader className="space-y-5">
                  <SectionHeader
                    eyebrow="Billing"
                    title="Billing and plan"
                    description="Track plan usage, premium access, and upgrade pressure before limits block new workspaces."
                  />
                </CardHeader>
                <CardContent className={cn("space-y-5", !dashboard.permissions.canManageBilling && "pointer-events-none blur-sm")}>
                  {dashboard.billing.overLimit ? (
                    <div className="rounded-2xl border border-destructive/20 bg-destructive-soft/70 px-4 py-3 text-sm text-destructive">
                      Usage exceeds the active plan. Upgrade to add more properties or employees without gating.
                    </div>
                  ) : null}
                  <div className="rounded-2xl border border-border bg-background/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Current plan</p>
                        <p className="text-xl font-semibold capitalize text-foreground">{dashboard.billing.plan}</p>
                      </div>
                      <Badge variant={dashboard.billing.analyticsEntitlement ? "secondary" : "outline"}>
                        {dashboard.billing.analyticsEntitlement ? "Analytics included" : "Basic metrics only"}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Monthly payroll estimate: {currencyFormatter.format(dashboard.billing.monthlySpend)}
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Properties</span>
                        <span className="font-medium text-foreground">
                          {dashboard.billing.propertyUsage} / {dashboard.billing.propertyLimit}
                        </span>
                      </div>
                      <Progress value={(dashboard.billing.propertyUsage / dashboard.billing.propertyLimit) * 100} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Employees</span>
                        <span className="font-medium text-foreground">
                          {dashboard.billing.employeeUsage} / {dashboard.billing.employeeLimit}
                        </span>
                      </div>
                      <Progress value={(dashboard.billing.employeeUsage / dashboard.billing.employeeLimit) * 100} />
                    </div>
                  </div>
                  <Button type="button" className="w-full">
                    Upgrade plan
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/80 bg-card/95 shadow-sm">
                <CardHeader className="space-y-5">
                  <SectionHeader
                    eyebrow="Access"
                    title="Users and permissions"
                    description={
                      dashboard.permissions.canManageUsers
                        ? "Manage org-level access without leaving the dashboard."
                        : "Managers can review access, but invite and permission changes remain locked."
                    }
                    action={
                      <Button type="button" size="sm" disabled={!dashboard.permissions.canInviteUsers}>
                        <UserPlus className="size-4" />
                        Invite user
                      </Button>
                    }
                  />
                </CardHeader>
                <CardContent className="space-y-4">
                  {!dashboard.permissions.canManageUsers ? (
                    <div className="rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                      This is a partial manager view. Role changes and removals are restricted to owner and admin seats.
                    </div>
                  ) : null}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Last active</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboard.users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="size-9">
                                <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
                                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-foreground">{user.name}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("border-transparent capitalize", getRoleClass(user.role))}>
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-foreground">{user.lastActive}</p>
                              <Badge className={cn("border-transparent capitalize", getStatusBadgeClass(user.status))}>
                                {user.status}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button type="button" variant="ghost" size="xs" disabled={!dashboard.permissions.canManageUsers}>
                                Edit
                              </Button>
                              <Button type="button" variant="ghost" size="xs" disabled={!dashboard.permissions.canManageUsers}>
                                Remove
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </motion.section>
        </motion.div>
      </div>
    </PageTransition>
  );
}
