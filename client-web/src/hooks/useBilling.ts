import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addOrganizationBillingAddon,
  fetchOrganizationBillingSummary,
  removeOrganizationBillingAddon,
  updateOrganizationBillingAddon,
} from "@/lib/api";
import {
  getOrganizationBillingSummaryQueryKey,
  organizationPermissionsQueryKeyBase,
} from "@/lib/query-keys";
import { useAuth } from "@/providers/auth-provider";

function invalidateBillingRelatedQueries(queryClient: ReturnType<typeof useQueryClient>, organizationId: string | undefined) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: getOrganizationBillingSummaryQueryKey(organizationId) }),
    queryClient.invalidateQueries({ queryKey: [...organizationPermissionsQueryKeyBase, organizationId ?? "none"] }),
    queryClient.invalidateQueries({ queryKey: ["organization-dashboard", organizationId ?? "none"] }),
  ]);
}

export function useOrganizationBillingSummary(organizationId: string | undefined, enabled = true) {
  const { session } = useAuth();

  return useQuery({
    queryKey: getOrganizationBillingSummaryQueryKey(organizationId),
    queryFn: ({ signal }) => fetchOrganizationBillingSummary(organizationId!, signal),
    enabled: Boolean(session?.access_token && organizationId && enabled),
  });
}

export function useAddOrganizationBillingAddon(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addOrganizationBillingAddon,
    onSuccess: async () => {
      await invalidateBillingRelatedQueries(queryClient, organizationId);
    },
  });
}

export function useUpdateOrganizationBillingAddon(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateOrganizationBillingAddon,
    onSuccess: async () => {
      await invalidateBillingRelatedQueries(queryClient, organizationId);
    },
  });
}

export function useRemoveOrganizationBillingAddon(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeOrganizationBillingAddon,
    onSuccess: async () => {
      await invalidateBillingRelatedQueries(queryClient, organizationId);
    },
  });
}
