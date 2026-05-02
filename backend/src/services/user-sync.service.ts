import type { Prisma, User } from "../../generated/prisma-rbac";

import { prisma } from "../lib/prisma";
import type { AuthenticatedSupabaseUser } from "../lib/supabase-auth";

export type ClientUserProfile = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  lastActiveOrganizationId: string | null;
  createdAt: string;
  updatedAt: string;
};

function toClientUserProfile(user: User): ClientUserProfile {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    lastActiveOrganizationId: user.lastActiveOrganizationId,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export const INVITED_USER_PLACEHOLDER_NAME = "__invited_user__";

function getInvitedPlaceholderEmail(userId: string): string {
  return `invited+${userId}@placeholder.local`;
}

async function createAuthenticatedUser(
  tx: Prisma.TransactionClient,
  authUser: AuthenticatedSupabaseUser
): Promise<User> {
  return tx.user.create({
    data: {
      id: authUser.id,
      email: authUser.email,
      fullName: authUser.fullName,
      phone: authUser.phone,
      avatarUrl: authUser.avatarUrl,
    },
  });
}

export async function syncAuthenticatedUser(authUser: AuthenticatedSupabaseUser): Promise<ClientUserProfile> {
  const user = await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { id: authUser.id },
    });

    if (existingUser) {
      return tx.user.update({
        where: { id: authUser.id },
        data: {
          email: authUser.email,
          fullName: authUser.fullName,
          phone: authUser.phone,
          avatarUrl: authUser.avatarUrl,
        },
      });
    }

    const invitedPlaceholderUser = await tx.user.findUnique({
      where: { email: authUser.email },
    });

    if (!invitedPlaceholderUser) {
      return createAuthenticatedUser(tx, authUser);
    }

    await tx.user.update({
      where: { id: invitedPlaceholderUser.id },
      data: {
        email: getInvitedPlaceholderEmail(invitedPlaceholderUser.id),
      },
    });

    const authenticatedUser = await createAuthenticatedUser(tx, authUser);

    await tx.organization.updateMany({
      where: { ownerUserId: invitedPlaceholderUser.id },
      data: { ownerUserId: authenticatedUser.id },
    });

    await tx.organizationMember.updateMany({
      where: { userId: invitedPlaceholderUser.id },
      data: { userId: authenticatedUser.id },
    });

    await tx.organizationMember.updateMany({
      where: { invitedByUserId: invitedPlaceholderUser.id },
      data: { invitedByUserId: authenticatedUser.id },
    });

    await tx.propertyUserRole.updateMany({
      where: { userId: invitedPlaceholderUser.id },
      data: { userId: authenticatedUser.id },
    });

    await tx.employee.updateMany({
      where: { userId: invitedPlaceholderUser.id },
      data: { userId: authenticatedUser.id },
    });

    await tx.user.delete({
      where: { id: invitedPlaceholderUser.id },
    });

    return authenticatedUser;
  });

  return toClientUserProfile(user);
}
