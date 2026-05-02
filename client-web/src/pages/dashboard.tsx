import { startTransition, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Building2, CreditCard, ShieldCheck, Users } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { BillingManagementPanel } from "@/components/dashboard/billing-management-panel";
import { AnalyticsTabs } from "@/components/dashboard/analytics-tabs";
import { BillingSummary } from "@/components/dashboard/billing-summary";
import { DocumentsPanel } from "@/components/dashboard/documents-panel";
import { EmployeesMissingShifts } from "@/components/dashboard/employees-missing-shifts";
import { formatHours, formatNumber } from "@/components/dashboard/dashboard-formatters";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { OrganizationSchedulingSummaryPanel } from "@/components/dashboard/organization-scheduling-summary";
import { OrganizationEmployeesPanel } from "@/components/dashboard/organization-employees-panel";
import { HoursTrendChart } from "@/components/dashboard/charts/hours-trend-chart";
import { PropertyDistributionChart } from "@/components/dashboard/charts/property-distribution-chart";
import { SchedulingOverview } from "@/components/dashboard/scheduling-overview";
import { UserAccess } from "@/components/dashboard/user-access";
import { UsersManagement } from "@/components/dashboard/users-management";
import { WorkforceOverview } from "@/components/dashboard/workforce-overview";
import { WorkspaceShell, type WorkspaceShellRenderProps } from "@/components/layout/workspace-shell";
import { type WorkspaceSection } from "@/components/layout/sidebar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganizationDashboard, type DashboardAnalyticsTab, type OrganizationDashboardData } from "@/hooks/useOrganizationDashboard";
import { useOrganizationSchedulingSummary } from "@/hooks/useOrganizationSchedulingSummary";

const defaultAnalyticsTab: DashboardAnalyticsTab = "hours";

function resolveAnalyticsTab(value: string | null): DashboardAnalyticsTab {
  if (value === "hours" || value === "payroll" || value === "employees") {
    return value;
  }

  return defaultAnalyticsTab;
}

function DashboardContentSkeleton() {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-40 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <Skeleton className="h-52 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
          <div className="space-y-6 xl:col-span-4">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionSurface({
  title,
  description,
  eyebrow,
  children,
}: {
  title: string;
  description: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <div className="mb-6 flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof Users;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 py-6">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
        </div>
        <div className="rounded-2xl bg-primary-soft p-3">
          <Icon className="size-5 text-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function InfoCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function PropertyCards({ dashboard }: { dashboard: OrganizationDashboardData }) {
  const navigate = useNavigate();

  if (dashboard.allProperties.length === 0) {
    return (
      <Card>
        <CardContent className="py-10">
          <p className="text-sm font-medium text-foreground">No properties are connected to this organization yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a property to start tracking workforce, time, and payroll data at the property level.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="grid gap-6 xl:grid-cols-3">
      {dashboard.allProperties.map((property) => (
        <button
          key={property.id}
          type="button"
          className="text-left"
          onClick={() => void navigate(`/dashboard/property/${encodeURIComponent(property.id)}`)}
        >
        <Card className="h-full transition-colors duration-150 hover:bg-muted/40">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-semibold">{property.name}</CardTitle>
                <CardDescription>{property.location}</CardDescription>
              </div>
              <Badge variant="secondary" className="capitalize">
                {property.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-sm text-muted-foreground">Employees</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                  {formatNumber(property.activeEmployees + property.inactiveEmployees)}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-sm text-muted-foreground">Open shifts</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{formatNumber(property.openShifts)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3">
              <span className="text-sm text-muted-foreground">Today's hours</span>
              <span className="text-sm font-medium text-foreground">{formatHours(property.todayHours)}</span>
            </div>
          </CardContent>
        </Card>
        </button>
      ))}
    </section>
  );
}

function AnalyticsLockedCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Analytics Locked</CardTitle>
        <CardDescription>This workspace does not currently include the analytics entitlement.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Upgrade billing or add analytics capacity before opening trend, payroll, and distribution analytics.
        </p>
      </CardContent>
    </Card>
  );
}

function findKpiValue(dashboard: OrganizationDashboardData, id: OrganizationDashboardData["kpis"][number]["id"]) {
  return dashboard.kpis.find((kpi) => kpi.id === id)?.value ?? 0;
}

function SettingsView({
  selectedOrganization,
  selectedPropertyName,
}: {
  selectedOrganization: WorkspaceShellRenderProps["selectedOrganization"];
  selectedPropertyName: string | null;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-3">
      <StatCard
        label="Organization"
        value={selectedOrganization.name}
        helper="Current workspace context"
        icon={Building2}
      />
      <StatCard
        label="Timezone"
        value={selectedOrganization.timezone}
        helper="Active organization timezone"
        icon={ShieldCheck}
      />
      <StatCard
        label="Property scope"
        value={selectedPropertyName ?? "All properties"}
        helper="Global dashboard filter"
        icon={Users}
      />
    </section>
  );
}

function renderSection(
  section: WorkspaceSection,
  dashboard: OrganizationDashboardData,
  schedulingSummary: ReturnType<typeof useOrganizationSchedulingSummary>["data"],
  schedulingSummaryState: {
    errorMessage: string | null;
    isLoading: boolean;
  },
  analyticsTab: DashboardAnalyticsTab,
  updateParams: WorkspaceShellRenderProps["updateParams"],
  selectedPropertyId: string | null,
  selectedPropertyName: string | null,
  selectedOrganization: WorkspaceShellRenderProps["selectedOrganization"],
) {
  switch (section) {
    case "dashboard":
      return (
        <>
          <KpiCards kpis={dashboard.kpis} />

          <section className="grid gap-6 xl:grid-cols-12">
            <div className="space-y-6 xl:col-span-8">
              <WorkforceOverview
                activeEmployees={dashboard.summary.activeEmployees}
                inactiveEmployees={dashboard.summary.inactiveEmployees}
                totalTodayHours={dashboard.summary.todayHours}
                activeProperties={dashboard.properties.filter((property) => property.status === "active").length}
                propertyScopeName={selectedPropertyName}
              />
              {dashboard.capabilities.timeTracking ? (
                <>
                  <EmployeesMissingShifts items={dashboard.employeesWithoutShifts} />
                  <SchedulingOverview
                    active={dashboard.shifts.active}
                    recent={dashboard.shifts.recent}
                    review={dashboard.shifts.review}
                  />
                </>
              ) : (
                <InfoCard
                  title="Live Time Data Unavailable"
                  description="Your current access scope does not expose organization-wide shift data for this dashboard."
                />
              )}
            </div>
            <div className="space-y-6 xl:col-span-4">
              {dashboard.capabilities.analytics ? (
                <>
                  <HoursTrendChart trend={dashboard.trend} />
                  <PropertyDistributionChart breakdown={dashboard.breakdown} />
                  <InfoCard
                    title="Payroll Analytics Pending"
                    description="Org-level payroll rollups are not implemented yet. Use each property payroll workspace for live payroll detail."
                  />
                </>
              ) : dashboard.billing.analyticsEntitlement ? (
                <InfoCard
                  title="Live Analytics Unavailable"
                  description="This organization has analytics capacity, but your current access scope does not expose live org-wide time data."
                />
              ) : (
                <AnalyticsLockedCard />
              )}
            </div>
          </section>

          <OrganizationSchedulingSummaryPanel
            compact
            summary={schedulingSummary}
            isLoading={schedulingSummaryState.isLoading}
            errorMessage={schedulingSummaryState.errorMessage}
          />

          {dashboard.capabilities.analytics ? (
            <AnalyticsTabs
              value={analyticsTab}
              onValueChange={(value) => updateParams({ analytics: value })}
              trend={dashboard.trend}
              breakdown={dashboard.breakdown}
              payrollEnabled={false}
            />
          ) : null}

          <section className="grid gap-6 xl:grid-cols-3">
            <AlertsPanel alerts={dashboard.alerts} />
            <BillingSummary billing={dashboard.billing} />
            <UserAccess users={dashboard.users} />
          </section>
        </>
      );
    case "properties":
      return (
        <>
          <section className="grid gap-6 md:grid-cols-3">
            <StatCard
              label="Properties"
              value={formatNumber(dashboard.allProperties.length)}
              helper="Tracked operating locations"
              icon={Building2}
            />
            <StatCard
              label="Active properties"
              value={formatNumber(dashboard.allProperties.filter((property) => property.status === "active").length)}
              helper="Currently online"
              icon={ArrowUpRight}
            />
            <StatCard
              label="Total hours today"
              value={formatHours(dashboard.allProperties.reduce((sum, property) => sum + property.todayHours, 0))}
              helper="Across all listed properties"
              icon={CreditCard}
            />
          </section>
          <PropertyCards dashboard={dashboard} />
        </>
      );
    case "employees":
      return (
        <>
          <OrganizationEmployeesPanel
            organizationId={selectedOrganization.id}
            properties={selectedOrganization.properties.map((property) => ({
              id: property.id,
              name: property.name,
            }))}
            selectedPropertyId={selectedPropertyId}
          />
        </>
      );
    case "documents":
      return (
        <DocumentsPanel
          organizationId={selectedOrganization.id}
          selectedPropertyId={selectedPropertyId}
          properties={selectedOrganization.properties.map((property) => ({
            id: property.id,
            name: property.name,
            organizationId: property.organizationId,
          }))}
        />
      );
    case "users":
      return (
        <>
          <section className="grid gap-6 md:grid-cols-3">
            <StatCard
              label="Org users"
              value={dashboard.capabilities.userAccess ? formatNumber(dashboard.users.length) : "Restricted"}
              helper={dashboard.capabilities.userAccess ? "Current seats with access" : "Requires user management access"}
              icon={Users}
            />
            <StatCard
              label="Invite access"
              value={dashboard.permissions.canInviteUsers ? "Enabled" : "Restricted"}
              helper="Based on your current role"
              icon={ShieldCheck}
            />
            <StatCard
              label="Property targets"
              value={formatNumber(dashboard.allProperties.length)}
              helper="Assignable property scopes"
              icon={Building2}
            />
          </section>
          <UsersManagement
            organizationId={selectedOrganization.id}
            properties={dashboard.allProperties}
            canInviteUsers={dashboard.permissions.canInviteUsers}
            canManageUsers={dashboard.permissions.canManageUsers}
          />
        </>
      );
    case "scheduling":
      return (
        <>
          <OrganizationSchedulingSummaryPanel
            summary={schedulingSummary}
            isLoading={schedulingSummaryState.isLoading}
            errorMessage={schedulingSummaryState.errorMessage}
          />
          {dashboard.capabilities.timeTracking ? (
            <>
              <section className="grid gap-6 md:grid-cols-3">
                <StatCard
                  label="Employees without shifts"
                  value={formatNumber(dashboard.employeesWithoutShifts.length)}
                  helper="Active employees without recorded time"
                  icon={Users}
                />
                <StatCard
                  label="Open shifts"
                  value={formatNumber(dashboard.summary.openShiftCount)}
                  helper="Employees currently clocked in"
                  icon={ArrowUpRight}
                />
                <StatCard
                  label="Needs review"
                  value={formatNumber(dashboard.summary.reviewShiftCount)}
                  helper="Auto-closed or edited shifts"
                  icon={CreditCard}
                />
              </section>
              <SchedulingOverview
                active={dashboard.shifts.active}
                recent={dashboard.shifts.recent}
                review={dashboard.shifts.review}
              />
              <AlertsPanel alerts={dashboard.alerts} />
            </>
          ) : null}
        </>
      );
    case "payroll":
      return (
        <>
          <section className="grid gap-6 md:grid-cols-3">
            <StatCard
              label="Hours in range"
              value={formatHours(dashboard.summary.currentRangeHours)}
              helper="Recorded time in the current dashboard window"
              icon={CreditCard}
            />
            <StatCard
              label="Employees with shifts"
              value={formatNumber(dashboard.summary.employeesWithShifts)}
              helper="Distinct employees with recorded time"
              icon={ArrowUpRight}
            />
            <StatCard
              label="Open shifts"
              value={formatNumber(findKpiValue(dashboard, "open-shifts"))}
              helper="Currently clocked in"
              icon={Users}
            />
          </section>
          <InfoCard
            title="Org Payroll Rollups Not Implemented"
            description="Property payroll runs are live, but the organization-level payroll dashboard and final rollups are not implemented yet."
          />
        </>
      );
    case "analytics":
      return (
        <>
          {dashboard.capabilities.analytics ? (
            <>
              <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                <PropertyDistributionChart breakdown={dashboard.breakdown} />
                <HoursTrendChart trend={dashboard.trend} />
              </section>
              <AnalyticsTabs
                value={analyticsTab}
                onValueChange={(value) => updateParams({ analytics: value })}
                trend={dashboard.trend}
                breakdown={dashboard.breakdown}
                payrollEnabled={false}
              />
            </>
          ) : dashboard.billing.analyticsEntitlement ? (
            <InfoCard
              title="Live Analytics Unavailable"
              description="This organization has analytics capacity, but your current access scope does not expose live org-wide time data."
            />
          ) : (
            <AnalyticsLockedCard />
          )}
        </>
      );
    case "billing":
      return (
        <>
          <section className="grid gap-6 md:grid-cols-3">
            <StatCard
              label="Plan"
              value={dashboard.billing.plan}
              helper="Current subscription tier"
              icon={CreditCard}
            />
            <StatCard
              label="Property usage"
              value={`${dashboard.billing.propertyUsage}/${dashboard.billing.propertyLimit}`}
              helper="Locations against plan"
              icon={Building2}
            />
            <StatCard
              label="Employee usage"
              value={`${dashboard.billing.employeeUsage}/${dashboard.billing.employeeLimit}`}
              helper="Seats against plan"
              icon={Users}
            />
          </section>
          <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            <BillingSummary billing={dashboard.billing} />
            <BillingManagementPanel
              organizationId={selectedOrganization.id}
              canManageBilling={dashboard.permissions.canManageBilling}
              propertyUsage={dashboard.billing.propertyUsage}
              propertyLimit={dashboard.billing.propertyLimit}
              employeeUsage={dashboard.billing.employeeUsage}
              employeeLimit={dashboard.billing.employeeLimit}
            />
          </section>
        </>
      );
    case "settings":
      return <SettingsView selectedOrganization={selectedOrganization} selectedPropertyName={selectedPropertyName} />;
  }
}

function getSectionMeta(section: WorkspaceSection) {
  switch (section) {
    case "dashboard":
      return {
        eyebrow: "Overview",
        title: "Dashboard",
        description: "Your live organization view with workforce, time activity, analytics, and billing signal in one surface.",
      };
    case "properties":
      return {
        eyebrow: "Workspace",
        title: "Properties",
        description: "A fast property summary view without leaving the main dashboard shell.",
      };
    case "employees":
      return {
        eyebrow: "Workspace",
        title: "Employees",
        description: "Review staffing posture, users, and assignment gaps in the same page context.",
      };
    case "documents":
      return {
        eyebrow: "Workspace",
        title: "Documents",
        description: "Manage employee document templates, sends, and signed DocuSeal records.",
      };
    case "scheduling":
      return {
        eyebrow: "Workspace",
        title: "Scheduling",
        description: "Read-only publication status across properties, with every drill-down routed back into the property-first scheduling workspace.",
      };
    case "users":
      return {
        eyebrow: "Workspace",
        title: "Users",
        description: "Invite teammates and manage organization or property-level access inside the dashboard shell.",
      };
    case "payroll":
      return {
        eyebrow: "Workspace",
        title: "Payroll",
        description: "Property payroll is live, while org-level payroll rollups are still pending implementation.",
      };
    case "analytics":
      return {
        eyebrow: "Workspace",
        title: "Analytics",
        description: "Hours, payroll, and employee distribution with focused analysis panels.",
      };
    case "billing":
      return {
        eyebrow: "Workspace",
        title: "Billing",
        description: "Plan capacity, payroll spend, and usage posture within the existing dashboard shell.",
      };
    case "settings":
      return {
        eyebrow: "Workspace",
        title: "Settings",
        description: "Current workspace context and global scope controls in a stable view.",
      };
  }
}

export function DashboardScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const analyticsTab = resolveAnalyticsTab(searchParams.get("analytics"));

  return (
    <WorkspaceShell>
      {(context) => (
        <DashboardScreenContent
          analyticsTab={analyticsTab}
          ensureAnalyticsParam={() => {
            if (!searchParams.get("analytics")) {
              startTransition(() => {
                setSearchParams(
                  (previousParams) => {
                    const nextParams = new URLSearchParams(previousParams);
                    nextParams.set("analytics", defaultAnalyticsTab);
                    return nextParams;
                  },
                  { replace: true },
                );
              });
            }
          }}
          {...context}
        />
      )}
    </WorkspaceShell>
  );
}

type DashboardScreenContentProps = {
  analyticsTab: DashboardAnalyticsTab;
  ensureAnalyticsParam: () => void;
} & WorkspaceShellRenderProps;

function DashboardScreenContent({
  analyticsTab,
  ensureAnalyticsParam,
  currentUser,
  organizationIndex,
  selectedOrganization,
  selectedPropertyId,
  currentSection,
  updateParams,
}: DashboardScreenContentProps) {
  const shouldReduceMotion = useReducedMotion();
  const {
    data: dashboard,
    isLoading: isDashboardLoading,
    isError: isDashboardError,
  } = useOrganizationDashboard({
    organization: selectedOrganization,
    organizationIndex,
    user: currentUser,
    range: "week",
    propertyId: selectedPropertyId,
  });
  const {
    data: schedulingSummary,
    error: schedulingSummaryError,
    isLoading: isSchedulingSummaryLoading,
  } = useOrganizationSchedulingSummary(selectedOrganization?.id);
  const effectiveAnalyticsTab =
    analyticsTab === "payroll" && !(dashboard?.capabilities.payroll ?? false) ? "hours" : analyticsTab;
  const schedulingSummaryErrorMessage =
    schedulingSummaryError instanceof Error ? schedulingSummaryError.message : schedulingSummaryError ? "Unable to load schedule status." : null;

  useEffect(() => {
    ensureAnalyticsParam();
  }, [ensureAnalyticsParam]);

  if (isDashboardError) {
    return (
      <div className="mx-auto max-w-[1400px] px-6 py-10">
        <Card>
          <CardContent className="py-6">
            <p className="text-sm font-medium text-foreground">Dashboard data is unavailable.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try refreshing the page to reload the selected organization.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isDashboardLoading || !dashboard) {
    return <DashboardContentSkeleton />;
  }

  const selectedProperty =
    dashboard.allProperties.find((property) => property.id === selectedPropertyId) ?? null;
  const sectionMeta = getSectionMeta(currentSection);

  return (
    <SectionSurface
      eyebrow={sectionMeta.eyebrow}
      title={sectionMeta.title}
      description={sectionMeta.description}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentSection}
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {renderSection(
            currentSection,
            dashboard,
            schedulingSummary,
            {
              errorMessage: schedulingSummaryErrorMessage,
              isLoading: isSchedulingSummaryLoading,
            },
            effectiveAnalyticsTab,
            updateParams,
            selectedPropertyId,
            selectedProperty?.name ?? null,
            selectedOrganization,
          )}
        </motion.div>
      </AnimatePresence>
    </SectionSurface>
  );
}
