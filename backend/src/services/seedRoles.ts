import type { Prisma, PrismaClient } from "../../generated/prisma-rbac";

import { DEFAULT_ROLES, resolveRolePermissions } from "../lib/defaultRoles";
import { prisma } from "../lib/prisma";

type SeedRolesClient = Prisma.TransactionClient | PrismaClient;
type RoleRecord = {
  id: string;
  name: string;
};

type NewOrganizationRoleBootstrapClient = {
  organizationRole: {
    createMany(args: {
      data: Array<{
        organizationId: string;
        name: string;
        description: string;
        isSystem: boolean;
        isDefault: boolean;
        createdAt: Date;
        updatedAt: Date;
      }>;
      skipDuplicates?: boolean;
    }): Promise<unknown>;
    findMany(args: {
      where: {
        organizationId: string;
        name: {
          in: string[];
        };
      };
      select: {
        id: true;
        name: true;
      };
    }): Promise<RoleRecord[]>;
    upsert: SeedRolesClient["organizationRole"]["upsert"];
  };
  organizationRolePermission: {
    createMany(args: {
      data: Array<{
        roleId: string;
        key: string;
        createdAt: Date;
      }>;
      skipDuplicates?: boolean;
    }): Promise<unknown>;
    upsert: SeedRolesClient["organizationRolePermission"]["upsert"];
    deleteMany: SeedRolesClient["organizationRolePermission"]["deleteMany"];
  };
};

function getDefaultRolePermissionKeysByName(): Record<string, string[]> {
  return Object.fromEntries(
    DEFAULT_ROLES.map((roleDefinition) => [
      roleDefinition.name,
      Array.from(new Set(resolveRolePermissions(roleDefinition.permissions))),
    ])
  );
}

function getMissingRoleNames(roleIdsByName: Record<string, string>): string[] {
  return DEFAULT_ROLES.map((roleDefinition) => roleDefinition.name).filter((roleName) => !roleIdsByName[roleName]);
}

export async function bootstrapDefaultRolesForNewOrganization(
  organizationId: string,
  db: NewOrganizationRoleBootstrapClient = prisma
): Promise<Record<string, string>> {
  const now = new Date();
  const defaultRoleNames = DEFAULT_ROLES.map((roleDefinition) => roleDefinition.name);

  await db.organizationRole.createMany({
    data: DEFAULT_ROLES.map((roleDefinition) => ({
      organizationId,
      name: roleDefinition.name,
      description: roleDefinition.description,
      isSystem: true,
      isDefault: roleDefinition.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    })),
    skipDuplicates: true,
  });

  const roles = await db.organizationRole.findMany({
    where: {
      organizationId,
      name: {
        in: defaultRoleNames,
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  const roleIdsByName = Object.fromEntries(roles.map((role) => [role.name, role.id]));
  const missingRoleNames = getMissingRoleNames(roleIdsByName);

  if (missingRoleNames.length > 0) {
    throw new Error(`The default organization roles could not be created: ${missingRoleNames.join(", ")}.`);
  }

  const permissionKeysByRoleName = getDefaultRolePermissionKeysByName();
  const permissionRows = roles.flatMap((role) =>
    (permissionKeysByRoleName[role.name] ?? []).map((key) => ({
      roleId: role.id,
      key,
      createdAt: now,
    }))
  );

  if (permissionRows.length > 0) {
    await db.organizationRolePermission.createMany({
      data: permissionRows,
      skipDuplicates: true,
    });
  }

  return roleIdsByName;
}

export async function seedRolesForOrganization(
  organizationId: string,
  db: SeedRolesClient = prisma
): Promise<Record<string, string>> {
  const roleIdsByName: Record<string, string> = {};

  for (const roleDefinition of DEFAULT_ROLES) {
    const role = await db.organizationRole.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: roleDefinition.name,
        },
      },
      update: {
        description: roleDefinition.description,
        isSystem: true,
        isDefault: roleDefinition.isDefault ?? false,
      },
      create: {
        organizationId,
        name: roleDefinition.name,
        description: roleDefinition.description,
        isSystem: true,
        isDefault: roleDefinition.isDefault ?? false,
      },
    });

    const permissionKeys = Array.from(new Set(resolveRolePermissions(roleDefinition.permissions)));

    for (const key of permissionKeys) {
      await db.organizationRolePermission.upsert({
        where: {
          roleId_key: {
            roleId: role.id,
            key,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          key,
        },
      });
    }

    await db.organizationRolePermission.deleteMany({
      where: {
        roleId: role.id,
        key: {
          notIn: permissionKeys,
        },
      },
    });

    roleIdsByName[role.name] = role.id;
  }

  return roleIdsByName;
}
