import { useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Fingerprint,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { type PropertyDashboardData, type PropertyDashboardSection } from "@/api/property";
import { AppLogo } from "@/components/brand/app-logo";
import { getInitials } from "@/components/dashboard/dashboard-formatters";
import { AppLayout } from "@/components/layout/app-layout";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  useAdvancePropertyPayrollPeriod,
  usePropertyDashboard,
  useUpdatePropertyAccess,
  useUpdatePropertySettings,
} from "@/hooks/useProperty";
import { PropertyAccess } from "@/components/property-dashboard/PropertyAccess";
import { PropertyClock } from "@/components/property-dashboard/PropertyClock";
import { PropertyOverview } from "@/components/property-dashboard/PropertyOverview";
import { PropertyPayroll } from "@/components/property-dashboard/PropertyPayroll";
import { PropertySchedule } from "@/components/property-dashboard/PropertySchedule";
import { PropertySettings } from "@/components/property-dashboard/PropertySettings";
import { PropertyTime } from "@/components/property-dashboard/PropertyTime";
import { PropertyWorkforce } from "@/components/property-dashboard/PropertyWorkforce";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

const propertySections: Array<{
  id: PropertyDashboardSection;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "workforce", label: "Workforce", icon: Users },
  { id: "clock", label: "Clock In / Out", icon: Fingerprint },
  { id: "time", label: "Time & Attendance", icon: Clock3 },
  { id: "schedule", label: "Scheduling", icon: CalendarDays },
  { id: "payroll", label: "Payroll", icon: Receipt },
  { id: "access", label: "Access & Roles", icon: ShieldCheck },
  { id: "settings", label: "Property Settings", icon: Settings },
] as const;

type PropertySectionId = PropertyDashboardSection;

function resolveSection(value: string | null): PropertySectionId {
  return propertySections.some((section) => section.id === value) ? (value as PropertySectionId) : "overview";
}

function PropertyDashboardSkeleton() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}

function PropertyDashboardError({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Property dashboard unavailable</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

type PropertySidebarProps = {
  currentSection: PropertySectionId;
  property: PropertyDashboardData["property"];
  availableSections: PropertyDashboardSection[];
  onSectionChange: (section: PropertySectionId) => void;
  onNavigate?: () => void;
};

function PropertySidebar({ currentSection, property, availableSections, onSectionChange, onNavigate }: PropertySidebarProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <aside className="flex h-full flex-col px-4 py-5">
      <div className="border-b border-border pb-5">
        <AppLogo compact />
        <div className="mt-4 rounded-2xl border border-border bg-background px-4 py-4">
          <p className="text-sm font-medium text-foreground">{property.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{property.code ?? property.timezone}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 w-full justify-start"
            onClick={() => {
              onNavigate?.();
              void navigate(
                `/dashboard?orgId=${encodeURIComponent(property.organizationId)}&propertyId=${encodeURIComponent(property.id)}`
              );
            }}
          >
            <ArrowLeft className="size-4" />
            Back to org dashboard
          </Button>
        </div>
      </div>

      <nav className="mt-6 flex-1 space-y-1">
        {propertySections.filter((section) => availableSections.includes(section.id)).map((section) => {
          const Icon = section.icon;
          const isActive = currentSection === section.id;

          return (
            <button
              key={section.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                onSectionChange(section.id);
                onNavigate?.();
              }}
              className={cn(
                buttonVariants({ variant: isActive ? "secondary" : "ghost", size: "default" }),
                "h-10 w-full justify-start gap-3 px-3",
                isActive && "border border-border bg-secondary text-foreground"
              )}
            >
              <Icon className="size-4" />
              <span>{section.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-4 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            void signOut();
          }}
          className={cn(
            buttonVariants({ variant: "ghost", size: "default" }),
            "h-10 w-full justify-start gap-3 px-3 text-muted-foreground hover:text-foreground"
          )}
        >
          <LogOut className="size-4" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

type PropertyHeaderProps = {
  dashboard: PropertyDashboardData;
  onOpenSidebar: () => void;
  onPropertyChange: (propertyId: string) => void;
  user: ReturnType<typeof useCurrentUser>["data"];
};

function PropertyHeader({ dashboard, onOpenSidebar, onPropertyChange, user }: PropertyHeaderProps) {
  const addressLine =
    [dashboard.property.city, dashboard.property.stateRegion].filter(Boolean).join(", ") ||
    dashboard.property.addressLine1 ||
    "Property scope";
  const selectedPropertyLabel =
    dashboard.propertyOptions.find((propertyOption) => propertyOption.id === dashboard.property.id)?.name ??
    dashboard.property.name;

  return (
    <header className="mx-auto flex h-18 w-full max-w-[1400px] items-center gap-3 px-4 sm:px-6">
      <Button type="button" variant="ghost" size="icon-sm" className="lg:hidden" onClick={onOpenSidebar}>
        <Menu className="size-4" />
      </Button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-semibold text-foreground">{dashboard.property.name}</p>
        <p className="truncate text-sm text-muted-foreground">{addressLine}</p>
      </div>

      <Select value={dashboard.property.id} onValueChange={(value) => value && onPropertyChange(value)}>
        <SelectTrigger className="w-[190px] bg-card sm:w-[240px]">
          <SelectValue placeholder="Switch property">{selectedPropertyLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {dashboard.propertyOptions.map((propertyOption) => (
            <SelectItem key={propertyOption.id} value={propertyOption.id}>
              {propertyOption.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ThemeToggle />

      <div className="hidden items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2 sm:flex">
        <Avatar className="size-10">
          <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.fullName ?? user?.email ?? "User"} />
          <AvatarFallback>{getInitials(user?.fullName ?? user?.email ?? "User")}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{user?.fullName ?? user?.email ?? "User"}</p>
          <p className="truncate text-sm text-muted-foreground">{user?.email ?? "Signed in"}</p>
        </div>
      </div>
    </header>
  );
}

function SectionSurface({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function renderSection(
  section: PropertySectionId,
  dashboard: PropertyDashboardData,
  currentUserId: string | null,
  onSaveAccessRole: (userId: string, roleId: string | null) => void,
  isSavingAccess: boolean,
  onSaveSettings: (payload: {
    name: string;
    timezone: string;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    stateRegion: string | null;
    postalCode: string | null;
    countryCode: string | null;
    payroll: {
      frequency: "biweekly" | "custom_days" | "monthly" | "quarterly" | "weekly";
      anchorStartDate: string;
      customDayInterval: number | null;
      autoCloseAfterHours: number | null;
    };
  }) => void,
  isSavingSettings: boolean,
  onAdvancePayrollPeriod: () => void,
  isAdvancingPayrollPeriod: boolean
) {
  switch (section) {
    case "overview":
      return (
        <SectionSurface
          title="Overview"
          description="A property-scoped operating snapshot for the current location, without any organization-wide spillover."
        >
          <PropertyOverview overview={dashboard.overview} propertyName={dashboard.property.name} />
        </SectionSurface>
      );
    case "workforce":
      return (
        <SectionSurface
          title="Workforce"
          description="Roster, shift posture, and clock controls for employees assigned to this property."
        >
          <PropertyWorkforce workforce={dashboard.workforce} />
        </SectionSurface>
      );
    case "time":
      return (
        <SectionSurface
          title="Time & Attendance"
          description="Timeline, open shifts, and weekly hour accumulation for this one location."
        >
          <PropertyTime
            property={dashboard.property}
            workforce={dashboard.workforce}
            currentPayPeriod={dashboard.currentPayPeriod}
            effectivePermissions={dashboard.permissions.effectivePermissions}
          />
        </SectionSurface>
      );
    case "clock":
      return (
        <SectionSurface
          title="Clock In / Out"
          description="Property-scoped punch controls, device registration, and real shift sessions pulled from the time-tracking tables."
        >
          <PropertyClock
            property={dashboard.property}
            workforce={dashboard.workforce}
            currentUserId={currentUserId}
            effectivePermissions={dashboard.permissions.effectivePermissions}
          />
        </SectionSurface>
      );
    case "schedule":
      return (
        <SectionSurface
          title="Scheduling"
          description="Build, review, and publish one property schedule at a time without leaving this location context."
        >
          <PropertySchedule
            organizationId={dashboard.property.organizationId}
            permissions={dashboard.permissions}
            property={dashboard.property}
            schedule={dashboard.scheduling}
            workforce={dashboard.workforce}
          />
        </SectionSurface>
      );
    case "payroll":
      return (
        <SectionSurface
          title="Payroll"
          description="Property-scoped payroll runs, approvals, history, and final report exports."
        >
          <PropertyPayroll
            propertyId={dashboard.property.id}
            payroll={dashboard.payroll}
            currentPayPeriod={dashboard.currentPayPeriod}
            isAdvancing={isAdvancingPayrollPeriod}
            onAdvancePeriod={onAdvancePayrollPeriod}
          />
        </SectionSurface>
      );
    case "access":
      return (
        <SectionSurface
          title="Access & Roles"
          description="Property-specific user access based on direct property role assignments."
        >
          <PropertyAccess access={dashboard.access} isSaving={isSavingAccess} onSaveRole={onSaveAccessRole} />
        </SectionSurface>
      );
    case "settings":
      return (
        <SectionSurface
          title="Property Settings"
          description="Property identity, timezone, address, and payroll cadence for this single location."
        >
          <PropertySettings
            property={dashboard.property}
            payrollConfig={dashboard.payrollConfig}
            currentPayPeriod={dashboard.currentPayPeriod}
            nextPayPeriod={dashboard.nextPayPeriod}
            isSaving={isSavingSettings}
            onSave={onSaveSettings}
          />
        </SectionSurface>
      );
  }
}

export function PropertyDashboardScreen() {
  const shouldReduceMotion = useReducedMotion();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const currentSection = resolveSection(searchParams.get("section"));
  const propertyDashboard = usePropertyDashboard(propertyId);
  const currentUser = useCurrentUser();
  const updateAccess = useUpdatePropertyAccess(propertyId);
  const updateSettings = useUpdatePropertySettings(propertyId);
  const advancePayrollPeriod = useAdvancePropertyPayrollPeriod(propertyId);
  const dashboard = propertyDashboard.data;
  const availableSections = dashboard?.permissions.availableSections ?? [];

  useEffect(() => {
    if (!dashboard) {
      return;
    }

    if (availableSections.includes(currentSection)) {
      return;
    }

    const nextSection = availableSections[0] ?? "overview";
    setSearchParams(
      (previousParams) => {
        const nextParams = new URLSearchParams(previousParams);
        nextParams.set("section", nextSection);
        return nextParams;
      },
      { replace: true }
    );
  }, [availableSections, currentSection, dashboard, setSearchParams]);

  if (!propertyId) {
    return <PropertyDashboardError message="Property id is missing from the route." />;
  }

  if (propertyDashboard.isLoading) {
    return <PropertyDashboardSkeleton />;
  }

  if (propertyDashboard.isError || !propertyDashboard.data) {
    return <PropertyDashboardError message="We could not load the selected property workspace." />;
  }

  const resolvedDashboard = propertyDashboard.data;

  if (!availableSections.includes(currentSection)) {
    return <PropertyDashboardSkeleton />;
  }

  return (
    <AppLayout
      isSidebarOpen={isSidebarOpen}
      onSidebarOpenChange={setIsSidebarOpen}
      sidebar={
        <PropertySidebar
          currentSection={currentSection}
          property={resolvedDashboard.property}
          availableSections={availableSections}
          onSectionChange={(section) => {
            setSearchParams((previousParams) => {
              const nextParams = new URLSearchParams(previousParams);
              nextParams.set("section", section);
              return nextParams;
            }, { replace: true });
          }}
          onNavigate={() => setIsSidebarOpen(false)}
        />
      }
      topbar={
        <PropertyHeader
          dashboard={resolvedDashboard}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onPropertyChange={(nextPropertyId) => {
            void navigate(`/dashboard/property/${encodeURIComponent(nextPropertyId)}?section=${currentSection}`);
          }}
          user={currentUser.data}
        />
      }
    >
      {(updateAccess.error || updateSettings.error || advancePayrollPeriod.error) ? (
        <div className="mx-auto max-w-[1400px] px-4 pt-4 sm:px-6">
          <Card className="border-destructive/40">
            <CardContent className="py-4">
              <p className="text-sm text-destructive">
                {updateAccess.error?.message ?? updateSettings.error?.message ?? advancePayrollPeriod.error?.message}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <motion.div
        key={`${resolvedDashboard.property.id}-${currentSection}`}
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {renderSection(
          currentSection,
          resolvedDashboard,
          currentUser.data?.id ?? null,
          (userId, roleId) => updateAccess.mutate({ propertyId: resolvedDashboard.property.id, userId, roleId }),
          updateAccess.isPending,
          (payload) => updateSettings.mutate({ propertyId: resolvedDashboard.property.id, ...payload }),
          updateSettings.isPending,
          () => advancePayrollPeriod.mutate(),
          advancePayrollPeriod.isPending
        )}
      </motion.div>
    </AppLayout>
  );
}
