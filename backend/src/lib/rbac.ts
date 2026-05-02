import { prisma } from "./prisma";
import { PERMISSIONS } from "./permissions";

export function hasPropertyScopeBypassPermission(permissionKeys: Iterable<string>): boolean {
  const permissions = permissionKeys instanceof Set ? permissionKeys : new Set(permissionKeys);

  return (
    permissions.has(PERMISSIONS.ORG_MANAGE) ||
    permissions.has(PERMISSIONS.PROPERTY_SCOPE_BYPASS) ||
    (permissions.has(PERMISSIONS.PROPERTY_WRITE) &&
      permissions.has(PERMISSIONS.USER_INVITE) &&
      permissions.has(PERMISSIONS.USER_MANAGE))
  );
}

export async function getOrganizationMembership(userId: string, organizationId: string) {
  return prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    include: {
      role: {
        include: {
          permissions: true,
        },
      },
    },
  });
}

export async function getPermissionKeys(userId: string, organizationId: string): Promise<Set<string>> {
  const membership = await getOrganizationMembership(userId, organizationId);

  if (!membership || membership.status !== "active") {
    return new Set<string>();
  }

  return new Set(membership.role.permissions.map((permission) => permission.key));
}

export async function hasPermission(userId: string, organizationId: string, permissionKey: string): Promise<boolean> {
  const permissions = await getPermissionKeys(userId, organizationId);
  return permissions.has(permissionKey);
}

export async function hasPropertyAccess(userId: string, propertyId: string): Promise<boolean> {
  const assignment = await prisma.propertyUserRole.findUnique({
    where: {
      propertyId_userId: {
        propertyId,
        userId,
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(assignment);
}

export async function canBypassPropertyScope(userId: string, organizationId: string): Promise<boolean> {
  const permissions = await getPermissionKeys(userId, organizationId);

  return hasPropertyScopeBypassPermission(permissions);
}
