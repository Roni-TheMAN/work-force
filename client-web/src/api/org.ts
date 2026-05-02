import { apiRequest } from "@/lib/api";

export type OrganizationPermissionSnapshot = {
  billingPlanCode: string | null;
  entitlements: Record<string, unknown>;
  organizationRole: string | null;
  permissions: string[];
};

export type OrganizationRoleOption = {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isSystem: boolean;
};

export type OrganizationUser = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: {
    id: string;
    name: string;
  };
  status: string;
  joinedAt: string | null;
  createdAt: string;
  canRemove: boolean;
  removeBlockedReason: string | null;
};

export type OrganizationMembership = {
  id: string;
  organizationId: string;
  userId: string;
  roleId: string;
  status: string;
  invitedEmail: string | null;
  joinedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
  };
  role: {
    id: string;
    name: string;
  };
};

export type OrganizationSchedulingSummary = {
  generatedAt: string;
  organizationId: string;
  properties: Array<{
    propertyId: string;
    propertyName: string;
    publishedAt: string | null;
    scheduledShiftCount: number;
    status: "draft" | "not_started" | "published";
    timezone: string;
    weekEndDate: string;
    weekStartDate: string;
  }>;
  summary: {
    draftProperties: number;
    notStartedProperties: number;
    propertyCount: number;
    publishedProperties: number;
    scheduledShiftCount: number;
    unpublishedProperties: number;
  };
};

export type InviteUserPayload = {
  organizationId: string;
  email: string;
  roleId: string;
};

export type AcceptInvitePayload = {
  organizationId: string;
};

export type RemoveOrganizationUserPayload = {
  organizationId: string;
  userId: string;
};

export async function fetchOrganizationPermissions(
  organizationId: string,
  signal?: AbortSignal
): Promise<OrganizationPermissionSnapshot> {
  return apiRequest<OrganizationPermissionSnapshot>(
    `/api/client/auth/permissions?organizationId=${encodeURIComponent(organizationId)}`,
    {
      auth: true,
      signal,
    }
  );
}

export async function fetchOrganizationRoles(
  organizationId: string,
  signal?: AbortSignal
): Promise<OrganizationRoleOption[]> {
  const response = await apiRequest<{ roles: OrganizationRoleOption[] }>(
    `/api/client/org/roles?organizationId=${encodeURIComponent(organizationId)}`,
    {
      auth: true,
      signal,
    }
  );

  return response.roles;
}

export async function fetchOrganizationUsers(
  organizationId: string,
  signal?: AbortSignal
): Promise<OrganizationUser[]> {
  const response = await apiRequest<{ users: OrganizationUser[] }>(
    `/api/client/org/users?organizationId=${encodeURIComponent(organizationId)}`,
    {
      auth: true,
      signal,
    }
  );

  return response.users;
}

export async function fetchOrganizationSchedulingSummary(
  organizationId: string,
  signal?: AbortSignal
): Promise<OrganizationSchedulingSummary> {
  const response = await apiRequest<{ overview: OrganizationSchedulingSummary }>(
    `/api/client/organizations/${encodeURIComponent(organizationId)}/scheduling/overview`,
    {
      auth: true,
      signal,
    }
  );

  return response.overview;
}

export async function inviteUser(payload: InviteUserPayload): Promise<OrganizationMembership> {
  const response = await apiRequest<{ membership: OrganizationMembership }>("/api/client/org/invite", {
    auth: true,
    method: "POST",
    body: payload,
  });

  return response.membership;
}

export async function acceptInvite(payload: AcceptInvitePayload): Promise<OrganizationMembership> {
  const response = await apiRequest<{ membership: OrganizationMembership }>("/api/client/org/accept-invite", {
    auth: true,
    method: "POST",
    body: payload,
  });

  return response.membership;
}

export async function removeOrganizationUser(payload: RemoveOrganizationUserPayload): Promise<void> {
  await apiRequest<void>(`/api/client/org/users/${encodeURIComponent(payload.userId)}`, {
    auth: true,
    method: "DELETE",
    body: {
      organizationId: payload.organizationId,
    },
  });
}
