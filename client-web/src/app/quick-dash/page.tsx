import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { AppScreen } from "@/components/layout/app-screen";
import { OrganizationPropertySelector } from "@/components/onboarding/organization-property-selector";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Organization } from "@/data/onboarding";
import { useClientOrganizations } from "@/hooks/useClientOrganizations";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { syncOrganizationCheckoutSession, type ClientProperty } from "@/lib/api";
import {
  clientOrganizationsQueryKeyBase,
  getOrganizationBillingSummaryQueryKey,
  getOrganizationPermissionsQueryKey,
} from "@/lib/query-keys";
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
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { signOut } = useAuth();
  const [checkoutSyncError, setCheckoutSyncError] = useState<string | null>(null);
  const [isCheckoutSyncing, setIsCheckoutSyncing] = useState(false);
  const { data: currentUser, isLoading, isError } = useCurrentUser();
  const {
    data: organizations = [],
    isLoading: isOrganizationsLoading,
    isError: isOrganizationsError,
  } = useClientOrganizations();
  const checkoutStatus = searchParams.get("checkout");
  const checkoutSessionId = searchParams.get("session_id");
  const checkoutOrganizationId = searchParams.get("organization");

  useEffect(() => {
    if (checkoutStatus !== "success" || !checkoutSessionId || !checkoutOrganizationId) {
      return;
    }

    let cancelled = false;

    setCheckoutSyncError(null);
    setIsCheckoutSyncing(true);

    void syncOrganizationCheckoutSession({
      organizationId: checkoutOrganizationId,
      sessionId: checkoutSessionId,
    })
      .then(async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: clientOrganizationsQueryKeyBase }),
          queryClient.invalidateQueries({ queryKey: getOrganizationPermissionsQueryKey(checkoutOrganizationId) }),
          queryClient.invalidateQueries({ queryKey: getOrganizationBillingSummaryQueryKey(checkoutOrganizationId) }),
          queryClient.invalidateQueries({ queryKey: ["organization-dashboard", checkoutOrganizationId] }),
        ]);

        if (!cancelled) {
          navigate(`/quick-dash?organization=${encodeURIComponent(checkoutOrganizationId)}`, { replace: true });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setCheckoutSyncError(error instanceof Error ? error.message : "Unable to finalize Stripe checkout.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsCheckoutSyncing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [checkoutOrganizationId, checkoutSessionId, checkoutStatus, navigate, queryClient]);

  const displayName = currentUser?.fullName ?? currentUser?.email ?? "User";
  const quickDashOrganizations = toQuickDashOrganizations(organizations);

  return (
    <AppScreen
      title={isLoading ? "Loading your quick dash" : `Quick dash for ${displayName}`}
      description={
        checkoutSyncError
          ? checkoutSyncError
          : isCheckoutSyncing
            ? "Finalizing Stripe checkout and syncing the organization subscription."
            : isError || isOrganizationsError
          ? "Your session is active, but the backend user bootstrap failed. Fix /api/client/auth/me before continuing."
          : "Choose an organization to open the dashboard instantly, or browse its properties first without leaving this screen."
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
        onOpenDashboard={(organizationId) => {
          void navigate(`/dashboard?orgId=${encodeURIComponent(organizationId)}`);
        }}
        onOpenPropertyDashboard={(propertyId) => {
          void navigate(`/dashboard/property/${encodeURIComponent(propertyId)}`);
        }}
      />
    </AppScreen>
  );
}
