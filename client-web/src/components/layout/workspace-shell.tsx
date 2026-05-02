import { startTransition, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { AppLayout } from "@/components/layout/app-layout";
import { Sidebar, type WorkspaceSection, workspaceSections } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganizationPermissions } from "@/hooks/useOrg";
import { usePropertyPermissions } from "@/hooks/useProperty";
import { useClientOrganizations } from "@/hooks/useClientOrganizations";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PERMISSIONS, canAccess } from "@/lib/permissions";
import type { ClientOrganization, CurrentUser } from "@/lib/api";

export type WorkspaceShellRenderProps = {
  currentUser: CurrentUser | null;
  organizationIndex: number;
  selectedOrganization: ClientOrganization;
  selectedPropertyId: string | null;
  currentSection: WorkspaceSection;
  updateParams: (updates: Record<string, string | null>) => void;
};

type WorkspaceShellProps = {
  children: (context: WorkspaceShellRenderProps) => ReactNode;
};

function WorkspaceSkeleton() {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-40 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
        <div className="grid gap-6 xl:grid-cols-3">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

function WorkspaceError({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Workspace unavailable</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function WorkspaceShell({ children }: WorkspaceShellProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const selectedOrganizationId = searchParams.get("orgId");
  const selectedPropertyId = searchParams.get("propertyId");
  const rawSection = searchParams.get("section");
  const currentSection = workspaceSections.includes(rawSection as WorkspaceSection)
    ? (rawSection as WorkspaceSection)
    : "dashboard";

  const { data: currentUser, isLoading: isUserLoading, isError: isUserError } = useCurrentUser();
  const {
    data: organizations = [],
    isLoading: isOrganizationsLoading,
    isError: isOrganizationsError,
  } = useClientOrganizations();

  const selectedOrganization =
    organizations.find((organization) => organization.id === selectedOrganizationId) ?? organizations[0] ?? null;
  const organizationIndex = selectedOrganization
    ? Math.max(0, organizations.findIndex((organization) => organization.id === selectedOrganization.id))
    : 0;

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
            return nextParams;
          },
          { replace: true },
        );
      });
    }
  }, [currentUser?.lastActiveOrganizationId, organizations, selectedOrganizationId, setSearchParams]);

  useEffect(() => {
    if (!selectedOrganization || !selectedPropertyId) {
      return;
    }

    if (!selectedOrganization.properties.some((property) => property.id === selectedPropertyId)) {
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
  }, [selectedOrganization, selectedPropertyId, setSearchParams]);

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

  const organizationName = selectedOrganization?.name ?? "Workspace";
  const userName = currentUser?.fullName?.trim() || currentUser?.email || "Current User";
  const userEmail = currentUser?.email ?? "Signed in";
  const propertyOptions =
    selectedOrganization?.properties.map((property) => ({
      id: property.id,
      name: property.name,
    })) ?? [];
  const { data: permissionSnapshot } = useOrganizationPermissions(selectedOrganization?.id);
  const { data: propertyPermissionSnapshot } = usePropertyPermissions(selectedPropertyId ?? undefined);
  const availableSections = workspaceSections.filter((section) => {
    if (!permissionSnapshot) {
      return true;
    }

    switch (section) {
      case "properties":
        return selectedPropertyId
          ? propertyPermissionSnapshot
            ? propertyPermissionSnapshot.canViewOverview
            : true
          : canAccess(permissionSnapshot, PERMISSIONS.PROPERTY_READ);
      case "employees":
        return selectedPropertyId
          ? propertyPermissionSnapshot
            ? propertyPermissionSnapshot.canViewWorkforce
            : true
          : canAccess(permissionSnapshot, PERMISSIONS.EMPLOYEE_READ);
        case "documents":
          return (
            canAccess(permissionSnapshot, PERMISSIONS.DOCUMENTS_TEMPLATE_READ) ||
            canAccess(permissionSnapshot, PERMISSIONS.DOCUMENTS_EMPLOYEE_READ) ||
            canAccess(permissionSnapshot, PERMISSIONS.DOCUMENTS_EXTERNAL_READ)
          );
      case "users":
        return (
          canAccess(permissionSnapshot, PERMISSIONS.USER_INVITE) ||
          canAccess(permissionSnapshot, PERMISSIONS.USER_MANAGE)
        );
      case "scheduling":
        return selectedPropertyId
          ? propertyPermissionSnapshot
            ? propertyPermissionSnapshot.canViewSchedule
            : true
          : canAccess(permissionSnapshot, PERMISSIONS.SCHEDULE_READ);
      case "payroll":
        return selectedPropertyId
          ? propertyPermissionSnapshot
            ? propertyPermissionSnapshot.canViewPayroll
            : true
          : canAccess(permissionSnapshot, PERMISSIONS.PAYROLL_READ);
      case "billing":
        return canAccess(permissionSnapshot, PERMISSIONS.BILLING_MANAGE);
      default:
        return true;
    }
  });

  const isLoading = isUserLoading || isOrganizationsLoading;
  const hasError = isUserError || isOrganizationsError;

  useEffect(() => {
    if (availableSections.length === 0) {
      return;
    }

    if (!availableSections.includes(currentSection)) {
      updateParams({ section: availableSections[0] });
    }
  }, [availableSections, currentSection]);

  return (
    <AppLayout
      isSidebarOpen={isSidebarOpen}
      onSidebarOpenChange={setIsSidebarOpen}
      sidebar={
        <Sidebar
          availableSections={availableSections}
          organizationName={organizationName}
          currentSection={currentSection}
          onSectionChange={(section) => updateParams({ section })}
          onNavigate={() => setIsSidebarOpen(false)}
        />
      }
      topbar={
        <Topbar
          organizationId={selectedOrganization?.id ?? ""}
          organizationName={organizationName}
          propertyOptions={propertyOptions}
          selectedPropertyId={selectedPropertyId}
          onPropertyChange={(propertyId) => updateParams({ propertyId })}
          userName={userName}
          userEmail={userEmail}
          userAvatarUrl={currentUser?.avatarUrl ?? null}
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />
      }
    >
      {hasError ? <WorkspaceError message="We could not load the current organization context." /> : null}
      {!hasError && isLoading ? <WorkspaceSkeleton /> : null}
      {!hasError && !isLoading && selectedOrganization
        ? children({
            currentUser: currentUser ?? null,
            organizationIndex,
            selectedOrganization,
            selectedPropertyId,
            currentSection,
            updateParams,
          })
        : null}
    </AppLayout>
  );
}
