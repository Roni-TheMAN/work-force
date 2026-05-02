import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

import { PERMISSIONS } from "../../lib/permissions";
import { HttpError } from "../../lib/http-error";
import { hasPermission } from "../../lib/rbac";
import { prisma } from "../../lib/prisma";
import { getAuthenticatedUser } from "../../middleware/authenticate-client";
import { syncAuthenticatedUser, INVITED_USER_PLACEHOLDER_NAME } from "../../services/user-sync.service";

type InviteUserRequestBody = {
  organizationId?: string;
  email?: string;
  roleId?: string;
};

type AcceptInviteRequestBody = {
  organizationId?: string;
};

type RemoveOrganizationUserRequestBody = {
  organizationId?: string;
};

type MembershipWithPermissions = {
  id: string;
  userId: string;
  status: string;
  invitedEmail: string | null;
  joinedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    avatarUrl?: string | null;
  };
  role: {
    id: string;
    name: string;
    permissions?: Array<{
      key: string;
    }>;
  };
};

type OrganizationRoleWithPermissions = {
  id: string;
  name: string;
  description?: string | null;
  isDefault?: boolean;
  isSystem?: boolean;
  permissions: Array<{
    key: string;
  }>;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isPlaceholderUser(user: { fullName: string | null }) {
  return user.fullName === INVITED_USER_PLACEHOLDER_NAME;
}

function getPermissionKeys(membership: MembershipWithPermissions | null): Set<string> {
  return new Set(membership?.role.permissions?.map((permission) => permission.key) ?? []);
}

function isOwnerMembership(membership: MembershipWithPermissions | null): boolean {
  return getPermissionKeys(membership).has(PERMISSIONS.ORG_MANAGE);
}

function isAdminMembership(membership: MembershipWithPermissions | null): boolean {
  const permissionKeys = getPermissionKeys(membership);

  return (
    !permissionKeys.has(PERMISSIONS.ORG_MANAGE) &&
    permissionKeys.has(PERMISSIONS.USER_INVITE) &&
    permissionKeys.has(PERMISSIONS.USER_MANAGE)
  );
}

function isOwnerRole(role: OrganizationRoleWithPermissions | null): boolean {
  return new Set(role?.permissions.map((permission) => permission.key) ?? []).has(PERMISSIONS.ORG_MANAGE);
}

function canAssignOrganizationRole(
  actorMembership: MembershipWithPermissions | null,
  targetRole: OrganizationRoleWithPermissions | null
): boolean {
  if (!actorMembership || actorMembership.status !== "active" || !targetRole) {
    return false;
  }

  if (isOwnerRole(targetRole)) {
    return isOwnerMembership(actorMembership);
  }

  return isOwnerMembership(actorMembership) || isAdminMembership(actorMembership);
}

function getInviteRoleBlockedReason(
  actorMembership: MembershipWithPermissions | null,
  targetRole: OrganizationRoleWithPermissions | null
): string | null {
  if (!actorMembership || actorMembership.status !== "active") {
    return "You do not have access to this organization.";
  }

  if (!targetRole) {
    return "Role not found for this organization.";
  }

  if (isOwnerRole(targetRole)) {
    return "Each organization can only have one owner.";
  }

  if (!canAssignOrganizationRole(actorMembership, targetRole)) {
    return "You do not have permission to assign this role.";
  }

  return null;
}

function canRemoveOrganizationMember(
  actorMembership: MembershipWithPermissions | null,
  targetMembership: MembershipWithPermissions | null
): boolean {
  if (!actorMembership || actorMembership.status !== "active" || !targetMembership) {
    return false;
  }

  const actorIsOwner = isOwnerMembership(actorMembership);
  const actorIsAdmin = isAdminMembership(actorMembership);

  if (!actorIsOwner && !actorIsAdmin) {
    return false;
  }

  if (isOwnerMembership(targetMembership)) {
    return false;
  }

  if (isAdminMembership(targetMembership) && !actorIsOwner) {
    return false;
  }

  return true;
}

function getRemovalBlockedReason(
  actorMembership: MembershipWithPermissions | null,
  targetMembership: MembershipWithPermissions
): string | null {
  if (!actorMembership || actorMembership.status !== "active") {
    return "You do not have access to this organization.";
  }

  if (!isOwnerMembership(actorMembership) && !isAdminMembership(actorMembership)) {
    return "Only admins and owners can remove users.";
  }

  if (isOwnerMembership(targetMembership)) {
    return "Owners cannot be removed from the organization.";
  }

  if (isAdminMembership(targetMembership) && !isOwnerMembership(actorMembership)) {
    return "Only an owner can remove an admin.";
  }

  return null;
}

function serializeMembership(membership: {
  id: string;
  organizationId: string;
  userId: string;
  roleId: string;
  status: string;
  invitedEmail: string | null;
  joinedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    email: string;
    fullName: string | null;
  };
  role: {
    id: string;
    name: string;
  };
}) {
  return {
    id: membership.id,
    organizationId: membership.organizationId,
    userId: membership.userId,
    roleId: membership.roleId,
    status: membership.status,
    invitedEmail: membership.invitedEmail,
    joinedAt: membership.joinedAt?.toISOString() ?? null,
    createdAt: membership.createdAt.toISOString(),
    updatedAt: membership.updatedAt.toISOString(),
    user: {
      id: membership.user.id,
      email: membership.user.email,
      fullName: membership.user.fullName,
    },
    role: membership.role,
  };
}

export const inviteUserToOrgController: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthenticatedUser(req);
    const inviter = await syncAuthenticatedUser(authUser);
    const { organizationId, email, roleId } = (req.body ?? {}) as InviteUserRequestBody;

    if (!organizationId?.trim()) {
      throw new HttpError(400, "organizationId is required.");
    }

    if (!email?.trim()) {
      throw new HttpError(400, "email is required.");
    }

    if (!roleId?.trim()) {
      throw new HttpError(400, "roleId is required.");
    }

    const normalizedEmail = normalizeEmail(email);
    const canManageOrganization = await hasPermission(inviter.id, organizationId, PERMISSIONS.USER_INVITE);

    if (!canManageOrganization) {
      throw new HttpError(403, "You do not have permission to invite users.");
    }

    const [actorMembership, role] = await Promise.all([
      prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: inviter.id,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              avatarUrl: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
              permissions: {
                select: {
                  key: true,
                },
              },
            },
          },
        },
      }),
      prisma.organizationRole.findFirst({
        where: {
          id: roleId,
          organizationId,
        },
        select: {
          id: true,
          name: true,
          permissions: {
            select: {
              key: true,
            },
          },
        },
      }),
    ]);

    if (!role) {
      throw new HttpError(404, "Role not found for this organization.");
    }

    const blockedReason = getInviteRoleBlockedReason(actorMembership, role);

    if (blockedReason) {
      throw new HttpError(403, blockedReason);
    }

    const membership = await prisma.$transaction(async (tx) => {
      let invitedUser = await tx.user.findUnique({
        where: {
          email: normalizedEmail,
        },
      });

      if (!invitedUser) {
        invitedUser = await tx.user.create({
          data: {
            id: randomUUID(),
            email: normalizedEmail,
            fullName: INVITED_USER_PLACEHOLDER_NAME,
          },
        });
      }

      const existingMembership = await tx.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: invitedUser.id,
          },
        },
      });

      const nextStatus = isPlaceholderUser(invitedUser) ? "invited" : "active";
      const joinedAt = nextStatus === "active" ? new Date() : null;

      if (existingMembership) {
        return tx.organizationMember.update({
          where: { id: existingMembership.id },
          data: {
            roleId: role.id,
            status: existingMembership.status === "active" ? "active" : nextStatus,
            invitedEmail: normalizedEmail,
            invitedByUserId: inviter.id,
            joinedAt: existingMembership.status === "active" ? existingMembership.joinedAt ?? new Date() : joinedAt,
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
              },
            },
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });
      }

      return tx.organizationMember.create({
        data: {
          organizationId,
          userId: invitedUser.id,
          roleId: role.id,
          status: nextStatus,
          invitedEmail: normalizedEmail,
          invitedByUserId: inviter.id,
          joinedAt,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    res.status(201).json({
      membership: serializeMembership(membership),
    });
  } catch (error) {
    next(error);
  }
};

export const acceptInviteController: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthenticatedUser(req);
    const localUser = await syncAuthenticatedUser(authUser);
    const { organizationId } = (req.body ?? {}) as AcceptInviteRequestBody;

    if (!organizationId?.trim()) {
      throw new HttpError(400, "organizationId is required.");
    }

    const normalizedEmail = normalizeEmail(authUser.email);
    const existingMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: localUser.id,
        },
      },
    });

    if (!existingMembership || existingMembership.status !== "invited" || existingMembership.invitedEmail !== normalizedEmail) {
      throw new HttpError(404, "No pending invite was found for this organization.");
    }

    const membership = await prisma.organizationMember.update({
      where: { id: existingMembership.id },
      data: {
        status: "active",
        joinedAt: new Date(),
        invitedEmail: normalizedEmail,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({
      membership: serializeMembership(membership),
    });
  } catch (error) {
    next(error);
  }
};

export const listOrganizationRolesController: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthenticatedUser(req);
    const requester = await syncAuthenticatedUser(authUser);
    const organizationId =
      typeof req.query.organizationId === "string" && req.query.organizationId.trim().length > 0
        ? req.query.organizationId.trim()
        : null;

    if (!organizationId) {
      throw new HttpError(400, "organizationId is required.");
    }

    const [actorMembership, roles] = await Promise.all([
      prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: requester.id,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              avatarUrl: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
              permissions: {
                select: {
                  key: true,
                },
              },
            },
          },
        },
      }),
      prisma.organizationRole.findMany({
        where: {
          organizationId,
        },
        orderBy: [{ isSystem: "desc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          description: true,
          isDefault: true,
          isSystem: true,
          permissions: {
            select: {
              key: true,
            },
          },
        },
      }),
    ]);

    const visibleRoles = roles.filter((role) => getInviteRoleBlockedReason(actorMembership, role) === null);

    res.json({
      roles: visibleRoles.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description ?? null,
        isDefault: role.isDefault ?? false,
        isSystem: role.isSystem ?? false,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const listOrganizationUsersController: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthenticatedUser(req);
    const requester = await syncAuthenticatedUser(authUser);
    const organizationId =
      typeof req.query.organizationId === "string" && req.query.organizationId.trim().length > 0
        ? req.query.organizationId.trim()
        : null;

    if (!organizationId) {
      throw new HttpError(400, "organizationId is required.");
    }

    const requesterMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: requester.id,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            permissions: {
              select: {
                key: true,
              },
            },
          },
        },
      },
    });

    const memberships = await prisma.organizationMember.findMany({
      where: {
        organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });

    res.json({
      users: memberships.map((membership) => ({
        id: membership.user.id,
        email: membership.invitedEmail ?? membership.user.email,
        fullName:
          membership.user.fullName && membership.user.fullName !== INVITED_USER_PLACEHOLDER_NAME
            ? membership.user.fullName
            : null,
        avatarUrl: membership.user.avatarUrl,
        role: membership.role,
        status: membership.status,
        joinedAt: membership.joinedAt?.toISOString() ?? null,
        createdAt: membership.createdAt.toISOString(),
        canRemove: canRemoveOrganizationMember(requesterMembership, membership),
        removeBlockedReason: getRemovalBlockedReason(requesterMembership, membership),
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const removeOrganizationUserController: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthenticatedUser(req);
    const actor = await syncAuthenticatedUser(authUser);
    const targetUserId =
      typeof req.params.userId === "string" && req.params.userId.trim().length > 0 ? req.params.userId.trim() : null;
    const { organizationId } = (req.body ?? {}) as RemoveOrganizationUserRequestBody;

    if (!organizationId?.trim()) {
      throw new HttpError(400, "organizationId is required.");
    }

    if (!targetUserId) {
      throw new HttpError(400, "userId is required.");
    }

    const [actorMembership, targetMembership] = await Promise.all([
      prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: actor.id,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
              permissions: {
                select: {
                  key: true,
                },
              },
            },
          },
        },
      }),
      prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: targetUserId,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
              permissions: {
                select: {
                  key: true,
                },
              },
            },
          },
        },
      }),
    ]);

    if (!targetMembership) {
      throw new HttpError(404, "Organization user not found.");
    }

    const removalBlockedReason = getRemovalBlockedReason(actorMembership, targetMembership);

    if (removalBlockedReason) {
      throw new HttpError(403, removalBlockedReason);
    }

    await prisma.$transaction(async (tx) => {
      await tx.organizationMember.delete({
        where: {
          id: targetMembership.id,
        },
      });

      await tx.propertyUserRole.deleteMany({
        where: {
          userId: targetMembership.userId,
          property: {
            organizationId,
          },
        },
      });

      if (targetMembership.user.fullName !== INVITED_USER_PLACEHOLDER_NAME) {
        return;
      }

      const remainingMembershipCount = await tx.organizationMember.count({
        where: {
          userId: targetMembership.userId,
        },
      });

      if (remainingMembershipCount === 0) {
        await tx.user.delete({
          where: {
            id: targetMembership.userId,
          },
        });
      }
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
