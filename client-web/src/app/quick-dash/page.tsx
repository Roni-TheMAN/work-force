import { Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { AppScreen } from "@/components/layout/app-screen";
import { OrganizationPropertySelector } from "@/components/onboarding/organization-property-selector";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Organization } from "@/data/onboarding";
import { useClientOrganizations } from "@/hooks/useClientOrganizations";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { ClientProperty } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

function toDisplayRole(role: string): string {
  return role
    .split("_")
    .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join(" ");
}

function toQuickDashProperty(property: ClientProperty) {
  return {
    id: property.id,
    name: property.name,
    code: property.code,
    timezone: property.timezone,
    addressLine1: property.addressLine1,
    addressLine2: property.addressLine2,
    city: property.city,
    stateRegion: property.stateRegion,
    postalCode: property.postalCode,
    countryCode: property.countryCode,
    status: property.status,
  };
}

function toQuickDashOrganizations(
  organizations: Array<{
    id: string;
    name: string;
    role: string;
    status: string;
    timezone: string;
    properties?: ClientProperty[];
  }>,
): Organization[] {
  return organizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
    role: toDisplayRole(organization.role),
    status: organization.status,
    timezone: organization.timezone,
    lastActive: `Status: ${organization.status}`,
    properties: (organization.properties ?? []).map(toQuickDashProperty),
  }));
}

export function QuickDashPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: currentUser, isLoading, isError } = useCurrentUser();
  const {
    data: organizations = [],
    isLoading: isOrganizationsLoading,
    isError: isOrganizationsError,
  } = useClientOrganizations();

  const displayName = currentUser?.fullName ?? currentUser?.email ?? "User";
  const quickDashOrganizations = toQuickDashOrganizations(organizations);

  return (
    <AppScreen
      title={isLoading ? "Loading your quick dash" : `Quick dash for ${displayName}`}
      description={
        isError || isOrganizationsError
          ? "Your session is active, but the backend user bootstrap failed. Fix /api/client/auth/me before continuing."
          : "Choose an organization and property first, then jump into the full organization dashboard with that scope preselected."
      }
      actions={
        <>
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
          <Link to="/onboarding/create-organization" className={cn(buttonVariants({ variant: "outline" }))}>
            <Plus className="size-4" />
            Create organization
          </Link>
        </>
      }
    >
      <OrganizationPropertySelector
        organizations={isOrganizationsLoading ? [] : quickDashOrganizations}
        onContinue={({ organizationId, propertyId }) => {
          void navigate(`/dashboard?orgId=${encodeURIComponent(organizationId)}&propertyId=${encodeURIComponent(propertyId)}`);
        }}
      />
    </AppScreen>
  );
}
