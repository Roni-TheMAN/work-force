import { useQuery } from "@tanstack/react-query";

import { fetchClientOrganizations } from "@/lib/api";
import { getClientOrganizationsQueryKey } from "@/lib/query-keys";
import { useAuth } from "@/providers/auth-provider";

export function useClientOrganizations() {
  const { session } = useAuth();

  return useQuery({
    queryKey: getClientOrganizationsQueryKey(session?.user.id),
    queryFn: ({ signal }) => fetchClientOrganizations(signal),
    enabled: Boolean(session?.access_token),
  });
}
