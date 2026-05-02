import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_ROLES } from "../lib/defaultRoles";
import { bootstrapDefaultRolesForNewOrganization } from "./seedRoles";

type RoleCreateManyArgs = {
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
};

type RoleFindManyArgs = {
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
};

type RolePermissionCreateManyArgs = {
  data: Array<{
    roleId: string;
    key: string;
    createdAt: Date;
  }>;
  skipDuplicates?: boolean;
};

test("bootstrapDefaultRolesForNewOrganization uses bulk writes and skips stale-permission cleanup", async () => {
  const captured = {
    permissionCreateManyArgs: null as RolePermissionCreateManyArgs | null,
    roleCreateManyArgs: null as RoleCreateManyArgs | null,
    roleFindManyArgs: null as RoleFindManyArgs | null,
  };
  let deleteManyCallCount = 0;

  const db = {
    organizationRole: {
      createMany: async (args: RoleCreateManyArgs) => {
        captured.roleCreateManyArgs = args;
      },
      findMany: async (args: RoleFindManyArgs) => {
        captured.roleFindManyArgs = args;

        return DEFAULT_ROLES.map((roleDefinition, index) => ({
          id: `role-${index + 1}`,
          name: roleDefinition.name,
        }));
      },
    },
    organizationRolePermission: {
      createMany: async (args: RolePermissionCreateManyArgs) => {
        captured.permissionCreateManyArgs = args;
      },
      deleteMany: async () => {
        deleteManyCallCount += 1;
      },
    },
  };

  const roleIdsByName = await bootstrapDefaultRolesForNewOrganization("org-123", db as never);

  assert.ok(captured.roleCreateManyArgs);
  assert.equal(captured.roleCreateManyArgs!.skipDuplicates, true);
  assert.deepEqual(
    captured.roleCreateManyArgs!.data.map((role) => role.name),
    DEFAULT_ROLES.map((role) => role.name)
  );
  assert.equal(captured.roleCreateManyArgs!.data[0]?.organizationId, "org-123");

  assert.ok(captured.roleFindManyArgs);
  assert.equal(captured.roleFindManyArgs!.where.organizationId, "org-123");
  assert.deepEqual(captured.roleFindManyArgs!.where.name.in, DEFAULT_ROLES.map((role) => role.name));

  assert.ok(captured.permissionCreateManyArgs);
  assert.equal(captured.permissionCreateManyArgs!.skipDuplicates, true);
  assert.ok(captured.permissionCreateManyArgs!.data.length > DEFAULT_ROLES.length);
  assert.equal(deleteManyCallCount, 0);

  assert.deepEqual(
    Object.keys(roleIdsByName).sort(),
    DEFAULT_ROLES.map((roleDefinition) => roleDefinition.name).sort()
  );
  assert.equal(roleIdsByName.Owner, "role-1");
});

test("bootstrapDefaultRolesForNewOrganization throws when a default role is missing after insert", async () => {
  const db = {
    organizationRole: {
      createMany: async () => {},
      findMany: async () => [{ id: "role-1", name: "Owner" }],
    },
    organizationRolePermission: {
      createMany: async () => {},
      deleteMany: async () => {
        throw new Error("deleteMany should not be called");
      },
    },
  };

  await assert.rejects(
    () => bootstrapDefaultRolesForNewOrganization("org-123", db as never),
    /The default organization roles could not be created/
  );
});
