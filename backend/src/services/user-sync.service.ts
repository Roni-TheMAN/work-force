import type { User } from "../generated/prisma";

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

export async function syncAuthenticatedUser(authUser: AuthenticatedSupabaseUser): Promise<ClientUserProfile> {
  const user = await prisma.user.upsert({
    where: { id: authUser.id },
    update: {
      email: authUser.email,
      fullName: authUser.fullName,
      phone: authUser.phone,
      avatarUrl: authUser.avatarUrl,
    },
    create: {
      id: authUser.id,
      email: authUser.email,
      fullName: authUser.fullName,
      phone: authUser.phone,
      avatarUrl: authUser.avatarUrl,
    },
  });

  return toClientUserProfile(user);
}
