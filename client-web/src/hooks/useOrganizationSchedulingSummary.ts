import { useQuery } from "@tanstack/react-query";

import { fetchOrganizationSchedulingSummary } from "@/api/org";
import { getOrganizationSchedulingSummaryQueryKey } from "@/lib/query-keys";
import { useAuth } from "@/providers/auth-provider";

export function useOrganizationSchedulingSummary(organizationId: string | undefined) {
  const { session } = useAuth();

  return useQuery({
    queryKey: getOrganizationSchedulingSummaryQueryKey(organizationId),
    queryFn: ({ signal }) => fetchOrganizationSchedulingSummary(organizationId!, signal),
    enabled: Boolean(session?.access_token && organizationId),
    placeholderData: (previousData) => previousData,
  });
}
