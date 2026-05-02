import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  acceptInvite,
  fetchOrganizationPermissions,
  fetchOrganizationRoles,
  fetchOrganizationUsers,
  inviteUser,
  removeOrganizationUser,
} from "@/api/org";
import {
  getClientOrganizationsQueryKey,
  getOrganizationPermissionsQueryKey,
  getOrganizationRolesQueryKey,
  getOrganizationUsersQueryKey,
} from "@/lib/query-keys";
import { useAuth } from "@/providers/auth-provider";

export function useOrganizationPermissions(organizationId: string | undefined) {
  const { session } = useAuth();

  return useQuery({
    queryKey: getOrganizationPermissionsQueryKey(organizationId),
    queryFn: ({ signal }) => fetchOrganizationPermissions(organizationId!, signal),
    enabled: Boolean(session?.access_token && organizationId),
  });
}

export function useOrganizationRoles(organizationId: string | undefined, enabled = true) {
  const { session } = useAuth();

  return useQuery({
    queryKey: getOrganizationRolesQueryKey(organizationId),
    queryFn: ({ signal }) => fetchOrganizationRoles(organizationId!, signal),
    enabled: Boolean(session?.access_token && organizationId && enabled),
  });
}

export function useOrganizationUsers(organizationId: string | undefined, enabled = true) {
  const { session } = useAuth();

  return useQuery({
    queryKey: getOrganizationUsersQueryKey(organizationId),
    queryFn: ({ signal }) => fetchOrganizationUsers(organizationId!, signal),
    enabled: Boolean(session?.access_token && organizationId && enabled),
  });
}

export function useInviteUser(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: inviteUser,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getOrganizationUsersQueryKey(organizationId) }),
        queryClient.invalidateQueries({ queryKey: getClientOrganizationsQueryKey(session?.user.id) }),
      ]);
    },
  });
}

export function useAcceptInvite(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: acceptInvite,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getOrganizationUsersQueryKey(organizationId) }),
        queryClient.invalidateQueries({ queryKey: getClientOrganizationsQueryKey(session?.user.id) }),
      ]);
    },
  });
}

export function useRemoveOrganizationUser(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: removeOrganizationUser,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getOrganizationUsersQueryKey(organizationId) }),
        queryClient.invalidateQueries({ queryKey: getClientOrganizationsQueryKey(session?.user.id) }),
      ]);
    },
  });
}
