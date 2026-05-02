import { useQuery } from "@tanstack/react-query";

import type { ClientOrganization, CurrentUser } from "@/lib/api";

export type DashboardRange = "today" | "week" | "month";
export type DashboardAnalyticsTab = "hours" | "employees" | "payroll";
export type DashboardPlan = "free" | "pro" | "enterprise";
export type DashboardRole = "owner" | "admin" | "manager" | "hr";
export type DashboardValueVariant = "integer" | "hours" | "currency";

export type DashboardMetric = {
  id: "employees" | "properties" | "hours" | "shifts" | "payroll" | "limits";
  label: string;
  value: number;
  variant: DashboardValueVariant;
  delta: number;
  helper: string;
  tone: "positive" | "negative" | "neutral" | "warning";
};

export type DashboardKpi = {
  id: "employees" | "properties" | "hours" | "open-shifts";
  label: string;
  value: number;
  variant: DashboardValueVariant;
  delta?: number;
  helper: string;
};

export type DashboardProperty = {
  id: string;
  name: string;
  status: "active" | "inactive";
  timezone: string;
  location: string;
  activeEmployees: number;
  inactiveEmployees: number;
  todayHours: number;
  currentPeriodHours: number;
  currentPeriodPayroll: number;
  openShifts: number;
  preview: boolean;
};

export type DashboardBreakdown = {
  name: string;
  hours: number;
  employees: number;
  payroll: number;
};

export type DashboardTrendPoint = {
  label: string;
  hours: number;
  employees: number;
  payroll: number;
  payrollHours: number;
  cumulativePayrollHours: number;
};

export type DashboardClockIn = {
  id: string;
  name: string;
  property: string;
  role: string;
  avatarUrl: string | null;
  timeLabel: string;
  status: "on-time" | "late";
};

export type DashboardCoverageGap = {
  id: string;
  name: string;
  property: string;
  role: string;
  lastShift: string;
};

export type DashboardShift = {
  id: string;
  property: string;
  employee: string | null;
  status: "active" | "upcoming" | "open" | "late";
  start: string;
  end: string;
};

export type DashboardAlert = {
  id: string;
  property: string;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  count: number;
};

export type DashboardUser = {
  id: string;
  name: string;
  email: string;
  role: DashboardRole;
  joinedAtLabel: string;
  lastActive: string;
  status: "online" | "away" | "offline";
  avatarUrl: string | null;
};

export type DashboardBilling = {
  plan: DashboardPlan;
  propertyUsage: number;
  propertyLimit: number;
  employeeUsage: number;
  employeeLimit: number;
  monthlySpend: number;
  analyticsEntitlement: boolean;
  canAddProperty: boolean;
  overLimit: boolean;
};

export type DashboardPermissions = {
  canManageBilling: boolean;
  canManageUsers: boolean;
  canInviteUsers: boolean;
  canAddProperty: boolean;
};

export type DashboardCapabilities = {
  analytics: boolean;
  payroll: boolean;
  timeTracking: boolean;
  userAccess: boolean;
};

export type DashboardSummary = {
  activeEmployees: number;
  inactiveEmployees: number;
  todayHours: number;
  openShiftCount: number;
  reviewShiftCount: number;
  currentRangeHours: number;
  employeesWithShifts: number;
};

export type OrganizationDashboardData = {
  generatedAt: string;
  role: DashboardRole;
  allProperties: DashboardProperty[];
  properties: DashboardProperty[];
  kpis: DashboardKpi[];
  metrics: DashboardMetric[];
  summary: DashboardSummary;
  capabilities: DashboardCapabilities;
  breakdown: DashboardBreakdown[];
  trend: DashboardTrendPoint[];
  recentClockIns: DashboardClockIn[];
  employeesWithoutShifts: DashboardCoverageGap[];
  shifts: {
    active: DashboardShift[];
    recent: DashboardShift[];
    review: DashboardShift[];
    today: DashboardShift[];
    upcoming: DashboardShift[];
    open: DashboardShift[];
  };
  alerts: DashboardAlert[];
  billing: DashboardBilling;
  permissions: DashboardPermissions;
  users: DashboardUser[];
  previewData: boolean;
};

type UseOrganizationDashboardOptions = {
  organization: ClientOrganization | null;
  organizationIndex: number;
  user: CurrentUser | null;
  range: DashboardRange;
  propertyId?: string | null;
};

const firstNames = [
  "Ava",
  "Noah",
  "Sofia",
  "Mason",
  "Ivy",
  "Julian",
  "Mila",
  "Ethan",
  "Layla",
  "Leo",
  "Nina",
  "Amir",
  "Tessa",
  "Owen",
  "Elena",
  "Micah",
  "Ruby",
  "Theo",
];

const lastNames = [
  "Parker",
  "Brooks",
  "Flores",
  "Nguyen",
  "Bennett",
  "Santos",
  "Patel",
  "Carter",
  "Rivera",
  "Dawson",
  "Coleman",
  "Foster",
];

const previewPropertySuffixes = [
  "Central",
  "Harbor",
  "Summit",
  "Riverfront",
  "Oak",
  "Parkside",
];

const roleLabels = ["Operations Lead", "Front Desk", "Housekeeping", "Food Service", "Security", "Maintenance"];

const planConfig = {
  free: { propertyLimit: 1, employeeLimit: 12, analyticsEntitlement: false },
  pro: { propertyLimit: 6, employeeLimit: 140, analyticsEntitlement: true },
  enterprise: { propertyLimit: 24, employeeLimit: 600, analyticsEntitlement: true },
} satisfies Record<DashboardPlan, { propertyLimit: number; employeeLimit: number; analyticsEntitlement: boolean }>;

function normalizeRole(role: string | undefined): DashboardRole {
  const normalized = role?.toLowerCase() ?? "";

  if (normalized.includes("owner")) {
    return "owner";
  }

  if (normalized.includes("admin")) {
    return "admin";
  }

  if (normalized.includes("manager")) {
    return "manager";
  }

  return "hr";
}

function hashValue(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function seeded(seed: number, offset: number): number {
  const next = Math.sin(seed + offset * 97.13) * 10000;
  return next - Math.floor(next);
}

function seededInt(seed: number, offset: number, min: number, max: number): number {
  return Math.round(min + seeded(seed, offset) * (max - min));
}

function seededFloat(seed: number, offset: number, min: number, max: number, precision = 1): number {
  const raw = min + seeded(seed, offset) * (max - min);
  return Number(raw.toFixed(precision));
}

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join(" ");
}

function buildLocation(property: Pick<ClientOrganization["properties"][number], "city" | "stateRegion">): string {
  if (property.city && property.stateRegion) {
    return `${property.city}, ${property.stateRegion}`;
  }

  return property.city ?? property.stateRegion ?? "Operational site";
}

function createPreviewProperties(organization: ClientOrganization, seed: number): DashboardProperty[] {
  const orgPrefix = organization.name.split(" ")[0] ?? "Property";

  return Array.from({ length: 3 }, (_, index) => {
    const name = `${orgPrefix} ${previewPropertySuffixes[index % previewPropertySuffixes.length]}`;
    const status = index === 2 ? "inactive" : "active";
    const activeEmployees = status === "active" ? seededInt(seed, index + 1, 18, 52) : seededInt(seed, index + 1, 6, 14);
    const inactiveEmployees = seededInt(seed, index + 10, 3, 10);
    const todayHours = status === "active" ? seededFloat(seed, index + 20, 34, 96) : seededFloat(seed, index + 20, 8, 24);
    const currentPeriodHours = todayHours * seededFloat(seed, index + 30, 5.8, 24.2, 0);
    const payrollRate = seededFloat(seed, index + 40, 25, 38, 2);

    return {
      id: `preview-${organization.id}-${index}`,
      name,
      status,
      timezone: organization.timezone,
      location: index === 0 ? "Chicago, IL" : index === 1 ? "Nashville, TN" : "Austin, TX",
      activeEmployees,
      inactiveEmployees,
      todayHours,
      currentPeriodHours,
      currentPeriodPayroll: Number((currentPeriodHours * payrollRate).toFixed(0)),
      openShifts: seededInt(seed, index + 50, 0, 5),
      preview: true,
    };
  });
}

function createDashboardProperties(
  organization: ClientOrganization,
  rangeMultiplier: number,
  seed: number,
): { properties: DashboardProperty[]; previewData: boolean } {
  if (organization.properties.length === 0) {
    return {
      properties: createPreviewProperties(organization, seed),
      previewData: true,
    };
  }

  return {
    previewData: false,
    properties: organization.properties.map((property, index) => {
      const status = property.status === "active" ? "active" : "inactive";
      const activeEmployees =
        status === "active" ? seededInt(seed, index + 1, 12, 56) : seededInt(seed, index + 1, 4, 18);
      const inactiveEmployees = seededInt(seed, index + 10, 1, 8);
      const todayHours = status === "active" ? seededFloat(seed, index + 20, 28, 104) : seededFloat(seed, index + 20, 6, 24);
      const payrollRate = seededFloat(seed, index + 40, 24, 40, 2);
      const currentPeriodHours = Number((todayHours * rangeMultiplier).toFixed(1));

      return {
        id: property.id,
        name: property.name,
        status,
        timezone: property.timezone,
        location: buildLocation(property),
        activeEmployees,
        inactiveEmployees,
        todayHours,
        currentPeriodHours,
        currentPeriodPayroll: Number((currentPeriodHours * payrollRate).toFixed(0)),
        openShifts: seededInt(seed, index + 50, 0, 4),
        preview: false,
      };
    }),
  };
}

function getPlanForOrganization(organizationIndex: number): DashboardPlan {
  if (organizationIndex === 0) {
    return "pro";
  }

  if (organizationIndex % 3 === 1) {
    return "free";
  }

  return "enterprise";
}

function formatTrendLabel(range: DashboardRange): string {
  switch (range) {
    case "today":
      return "vs yesterday";
    case "week":
      return "vs last week";
    case "month":
      return "vs last month";
  }
}

function createMetricDelta(seed: number, offset: number): number {
  return seededFloat(seed, offset, -6.5, 11.4, 1);
}

function createTrend(range: DashboardRange, properties: DashboardProperty[], seed: number): DashboardTrendPoint[] {
  const totalEmployees = properties.reduce((sum, property) => sum + property.activeEmployees + property.inactiveEmployees, 0);
  const totalHours = properties.reduce((sum, property) => sum + property.currentPeriodHours, 0);
  const payrollHoursBase = totalHours * 0.72;
  const points = range === "month" ? 30 : 7;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (points - 1));

  let cumulativePayrollHours = 0;

  return Array.from({ length: points }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dayHours = Number((totalHours / points + seededFloat(seed, index + 70, -12, 14)).toFixed(1));
    const dayEmployees = Math.max(8, Math.round(totalEmployees / points + seededFloat(seed, index + 90, 2, 11)));
    const payrollHours = Number((payrollHoursBase / points + seededFloat(seed, index + 110, -6, 10)).toFixed(1));

    cumulativePayrollHours += payrollHours;

    return {
      label:
        points === 30
          ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
          : date.toLocaleDateString(undefined, { weekday: "short" }),
      hours: dayHours,
      employees: dayEmployees,
      payroll: Number((payrollHours * seededFloat(seed, index + 120, 28, 40, 2)).toFixed(0)),
      payrollHours,
      cumulativePayrollHours: Number(cumulativePayrollHours.toFixed(1)),
    };
  });
}

function createPersonName(seed: number, offset: number): string {
  const first = firstNames[seededInt(seed, offset + 1, 0, firstNames.length - 1)] ?? "Alex";
  const last = lastNames[seededInt(seed, offset + 2, 0, lastNames.length - 1)] ?? "Taylor";
  return `${first} ${last}`;
}

function createRecentClockIns(properties: DashboardProperty[], seed: number): DashboardClockIn[] {
  return Array.from({ length: 6 }, (_, index) => {
    const property = properties[index % properties.length]!;
    const hour = seededInt(seed, index + 130, 6, 10);
    const minute = seededInt(seed, index + 140, 0, 59).toString().padStart(2, "0");
    const status = index === 3 ? "late" : "on-time";

    return {
      id: `clock-in-${index}`,
      name: createPersonName(seed, index + 150),
      property: property.name,
      role: roleLabels[index % roleLabels.length]!,
      avatarUrl: null,
      timeLabel: `${hour}:${minute} ${hour >= 12 ? "PM" : "AM"}`,
      status,
    };
  });
}

function createCoverageGaps(properties: DashboardProperty[], seed: number): DashboardCoverageGap[] {
  return Array.from({ length: 5 }, (_, index) => {
    const property = properties[(index + 1) % properties.length]!;

    return {
      id: `gap-${index}`,
      name: createPersonName(seed, index + 180),
      property: property.name,
      role: roleLabels[(index + 2) % roleLabels.length]!,
      lastShift: `${seededInt(seed, index + 190, 1, 4)} days ago`,
    };
  });
}

function formatHourLabel(hour: number): string {
  const normalized = ((hour + 11) % 12) + 1;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${normalized}:00 ${suffix}`;
}

function createShifts(
  properties: DashboardProperty[],
  seed: number,
): Pick<OrganizationDashboardData["shifts"], "today" | "upcoming" | "open"> {
  const today = Array.from({ length: 6 }, (_, index) => {
    const property = properties[index % properties.length]!;
    const start = seededInt(seed, index + 210, 6, 14);
    const duration = seededInt(seed, index + 220, 6, 9);

    return {
      id: `today-${index}`,
      property: property.name,
      employee: createPersonName(seed, index + 230),
      status: index === 2 ? "late" : "active",
      start: formatHourLabel(start),
      end: formatHourLabel(start + duration),
    } satisfies DashboardShift;
  });

  const upcoming = Array.from({ length: 5 }, (_, index) => {
    const property = properties[(index + 1) % properties.length]!;
    const start = seededInt(seed, index + 240, 7, 15);

    return {
      id: `upcoming-${index}`,
      property: property.name,
      employee: createPersonName(seed, index + 250),
      status: "upcoming",
      start: `Tomorrow, ${formatHourLabel(start)}`,
      end: formatHourLabel(start + seededInt(seed, index + 260, 6, 8)),
    } satisfies DashboardShift;
  });

  const open = Array.from({ length: 4 }, (_, index) => {
    const property = properties[(index + 2) % properties.length]!;
    const start = seededInt(seed, index + 270, 8, 18);

    return {
      id: `open-${index}`,
      property: property.name,
      employee: null,
      status: "open",
      start: `Today, ${formatHourLabel(start)}`,
      end: formatHourLabel(start + seededInt(seed, index + 280, 5, 8)),
    } satisfies DashboardShift;
  });

  return { today, upcoming, open };
}

function createAlerts(properties: DashboardProperty[], billing: DashboardBilling, seed: number): DashboardAlert[] {
  return [
    {
      id: "missed-clock-outs",
      property: properties[0]?.name ?? "Org-wide",
      title: "Missed clock-outs",
      description: "Open timecards are still unresolved after shift end.",
      severity: "warning",
      count: seededInt(seed, 300, 1, 4),
    },
    {
      id: "late-clock-ins",
      property: properties[1]?.name ?? "Org-wide",
      title: "Late clock-ins",
      description: "Employees exceeded the grace window for scheduled starts.",
      severity: "info",
      count: seededInt(seed, 301, 2, 7),
    },
    {
      id: "overlapping-shifts",
      property: properties[2]?.name ?? "Org-wide",
      title: "Overlapping shifts",
      description: "Assignments create overlapping labor on the same employee record.",
      severity: "critical",
      count: seededInt(seed, 302, 1, 3),
    },
    {
      id: "plan-warning",
      property: "Billing",
      title: billing.overLimit ? "Usage over plan" : "Usage nearing threshold",
      description: billing.overLimit
        ? "Plan limits are exceeded for at least one tracked dimension."
        : "One or more usage dimensions are above 80 percent.",
      severity: billing.overLimit ? "critical" : "warning",
      count: billing.overLimit ? 2 : 1,
    },
  ];
}

function createUsers(role: DashboardRole, user: CurrentUser | null, seed: number): DashboardUser[] {
  const currentUserName = user?.fullName?.trim() || user?.email || "Current User";
  const currentUserEmail = user?.email ?? "current.user@example.com";

  return [
    {
      id: user?.id ?? "current-user",
      name: currentUserName,
      email: currentUserEmail,
      role,
      joinedAtLabel: "Joined this month",
      lastActive: "Just now",
      status: "online",
      avatarUrl: user?.avatarUrl ?? null,
    },
    {
      id: "user-2",
      name: createPersonName(seed, 330),
      email: "ops.lead@example.com",
      role: role === "manager" ? "admin" : "manager",
      joinedAtLabel: "Joined 3 months ago",
      lastActive: "18 minutes ago",
      status: "away",
      avatarUrl: null,
    },
    {
      id: "user-3",
      name: createPersonName(seed, 331),
      email: "hr.partners@example.com",
      role: "hr",
      joinedAtLabel: "Joined 5 months ago",
      lastActive: "2 hours ago",
      status: "offline",
      avatarUrl: null,
    },
    {
      id: "user-4",
      name: createPersonName(seed, 332),
      email: "admin.billing@example.com",
      role: role === "owner" ? "admin" : "owner",
      joinedAtLabel: "Joined last year",
      lastActive: "Yesterday",
      status: "offline",
      avatarUrl: null,
    },
  ];
}

function createBilling(
  plan: DashboardPlan,
  properties: DashboardProperty[],
  totalEmployees: number,
  monthlySpend: number,
): DashboardBilling {
  const limits = planConfig[plan];
  const propertyUsage = properties.length;
  const employeeUsage = totalEmployees;
  const overLimit = propertyUsage > limits.propertyLimit || employeeUsage > limits.employeeLimit;

  return {
    plan,
    propertyUsage,
    propertyLimit: limits.propertyLimit,
    employeeUsage,
    employeeLimit: limits.employeeLimit,
    monthlySpend,
    analyticsEntitlement: limits.analyticsEntitlement,
    canAddProperty: propertyUsage < limits.propertyLimit,
    overLimit,
  };
}

function createMetrics(
  properties: DashboardProperty[],
  totalEmployees: number,
  totalHours: number,
  activeShifts: number,
  monthlySpend: number,
  billing: DashboardBilling,
  range: DashboardRange,
  seed: number,
): DashboardMetric[] {
  const rangeLabel = formatTrendLabel(range);
  const nearLimitPercent = Math.max(
    billing.propertyUsage / billing.propertyLimit,
    billing.employeeUsage / billing.employeeLimit,
  );

  return [
    {
      id: "employees",
      label: "Total employees",
      value: totalEmployees,
      variant: "integer",
      delta: createMetricDelta(seed, 340),
      helper: rangeLabel,
      tone: "positive",
    },
    {
      id: "properties",
      label: "Total properties",
      value: properties.length,
      variant: "integer",
      delta: createMetricDelta(seed, 341),
      helper: rangeLabel,
      tone: "neutral",
    },
    {
      id: "hours",
      label: "Hours worked",
      value: totalHours,
      variant: "hours",
      delta: createMetricDelta(seed, 342),
      helper: rangeLabel,
      tone: "positive",
    },
    {
      id: "shifts",
      label: "Active shifts",
      value: activeShifts,
      variant: "integer",
      delta: createMetricDelta(seed, 343),
      helper: "running right now",
      tone: "neutral",
    },
    {
      id: "payroll",
      label: "Payroll total",
      value: monthlySpend,
      variant: "currency",
      delta: createMetricDelta(seed, 344),
      helper: rangeLabel,
      tone: monthlySpend > 40000 ? "warning" : "positive",
    },
    {
      id: "limits",
      label: "Limit watch",
      value: Math.round(nearLimitPercent * 100),
      variant: "integer",
      delta: billing.overLimit ? 4.2 : -1.4,
      helper: billing.overLimit ? "upgrade required" : "highest usage dimension",
      tone: billing.overLimit || nearLimitPercent >= 0.8 ? "warning" : "positive",
    },
  ];
}

function createKpis(
  properties: DashboardProperty[],
  totalEmployees: number,
  totalHours: number,
  openShiftCount: number,
  seed: number,
): DashboardKpi[] {
  return [
    {
      id: "employees",
      label: "Employees",
      value: totalEmployees,
      variant: "integer",
      delta: createMetricDelta(seed, 345),
      helper: "Across current scope",
    },
    {
      id: "properties",
      label: "Properties",
      value: properties.length,
      variant: "integer",
      delta: createMetricDelta(seed, 346),
      helper: "In current view",
    },
    {
      id: "hours",
      label: "Hours in range",
      value: totalHours,
      variant: "hours",
      delta: createMetricDelta(seed, 347),
      helper: "Tracked labor time",
    },
    {
      id: "open-shifts",
      label: "Open shifts",
      value: openShiftCount,
      variant: "integer",
      delta: createMetricDelta(seed, 348),
      helper: "Needs assignment or review",
    },
  ];
}

function buildDashboardData(
  organization: ClientOrganization,
  organizationIndex: number,
  user: CurrentUser | null,
  range: DashboardRange,
  propertyId: string | null | undefined,
): OrganizationDashboardData {
  const role = normalizeRole(organization.role);
  const seed = hashValue(`${organization.id}:${range}:${organizationIndex}`);
  const rangeMultiplier = range === "today" ? 1 : range === "week" ? 6.4 : 23.5;
  const { properties: allProperties, previewData } = createDashboardProperties(organization, rangeMultiplier, seed);
  const properties =
    propertyId && allProperties.some((property) => property.id === propertyId)
      ? allProperties.filter((property) => property.id === propertyId)
      : allProperties;
  const breakdown = properties.map((property) => ({
    name: property.name,
    hours: property.currentPeriodHours,
    employees: property.activeEmployees + property.inactiveEmployees,
    payroll: property.currentPeriodPayroll,
  }));
  const totalEmployees = properties.reduce(
    (sum, property) => sum + property.activeEmployees + property.inactiveEmployees,
    0,
  );
  const activeEmployees = properties.reduce((sum, property) => sum + property.activeEmployees, 0);
  const inactiveEmployees = properties.reduce((sum, property) => sum + property.inactiveEmployees, 0);
  const todayHours = Number(properties.reduce((sum, property) => sum + property.todayHours, 0).toFixed(1));
  const totalHours = Number(properties.reduce((sum, property) => sum + property.currentPeriodHours, 0).toFixed(1));
  const activeShifts = properties.reduce((sum, property) => sum + Math.max(2, property.openShifts + 3), 0);
  const monthlySpend = breakdown.reduce((sum, property) => sum + property.payroll, 0);
  const plan = getPlanForOrganization(organizationIndex);
  const billing = createBilling(plan, properties, totalEmployees, monthlySpend);
  const trend = createTrend(range, properties, seed);
  const shiftCollections = createShifts(properties, seed);
  const activeShiftItems = shiftCollections.today.filter((shift) => shift.status === "active" || shift.status === "late");
  const recentShiftItems = shiftCollections.today;
  const reviewShiftItems = shiftCollections.open;
  const summary = {
    activeEmployees,
    inactiveEmployees,
    todayHours,
    openShiftCount: shiftCollections.open.length,
    reviewShiftCount: reviewShiftItems.length,
    currentRangeHours: totalHours,
    employeesWithShifts: new Set(recentShiftItems.map((shift) => shift.employee).filter(Boolean)).size,
  } satisfies DashboardSummary;
  const permissions = {
    canManageBilling: role === "owner" || role === "admin",
    canManageUsers: role === "owner" || role === "admin",
    canInviteUsers: role !== "manager",
    canAddProperty: role !== "manager" && billing.canAddProperty,
  } satisfies DashboardPermissions;
  const capabilities = {
    analytics: billing.analyticsEntitlement,
    payroll: false,
    timeTracking: true,
    userAccess: permissions.canManageUsers,
  } satisfies DashboardCapabilities;

  return {
    generatedAt: new Date().toISOString(),
    role,
    allProperties,
    properties,
    kpis: createKpis(properties, totalEmployees, totalHours, summary.openShiftCount, seed),
    metrics: createMetrics(properties, totalEmployees, totalHours, activeShifts, monthlySpend, billing, range, seed),
    summary,
    capabilities,
    breakdown,
    trend,
    recentClockIns: createRecentClockIns(properties, seed),
    employeesWithoutShifts: createCoverageGaps(properties, seed),
    shifts: {
      ...shiftCollections,
      active: activeShiftItems,
      recent: recentShiftItems,
      review: reviewShiftItems,
    },
    alerts: createAlerts(properties, billing, seed),
    billing,
    permissions,
    users: createUsers(role, user, seed),
    previewData,
  };
}

export function useOrganizationDashboard({
  organization,
  organizationIndex,
  user,
  range,
  propertyId,
}: UseOrganizationDashboardOptions) {
  return useQuery({
    queryKey: ["organization-dashboard", organization?.id ?? "none", organizationIndex, range, propertyId ?? "all"],
    queryFn: async () => {
      if (!organization) {
        throw new Error("Organization context is required.");
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, 220);
      });

      return buildDashboardData(organization, organizationIndex, user, range, propertyId);
    },
    enabled: Boolean(organization),
    placeholderData: (previousData) => previousData,
  });
}

export function formatDashboardRole(role: DashboardRole): string {
  return titleCase(role);
}
