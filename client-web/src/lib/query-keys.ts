export const currentUserQueryKeyBase = ["current-user"] as const;
export const clientOrganizationsQueryKeyBase = ["client-organizations"] as const;

export function getCurrentUserQueryKey(userId: string | undefined) {
  return [...currentUserQueryKeyBase, userId ?? "anonymous"] as const;
}

export function getClientOrganizationsQueryKey(userId: string | undefined) {
  return [...clientOrganizationsQueryKeyBase, userId ?? "anonymous"] as const;
}
