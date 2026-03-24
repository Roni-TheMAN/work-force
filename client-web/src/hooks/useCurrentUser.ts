import { useQuery } from "@tanstack/react-query";

import { fetchCurrentUser } from "@/lib/api";
import { getCurrentUserQueryKey } from "@/lib/query-keys";
import { useAuth } from "@/providers/auth-provider";

export function useCurrentUser() {
  const { session } = useAuth();

  return useQuery({
    queryKey: getCurrentUserQueryKey(session?.user.id),
    queryFn: ({ signal }) => fetchCurrentUser(signal),
    enabled: Boolean(session?.access_token),
  });
}
