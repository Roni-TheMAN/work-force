-- CreateTable
CREATE TABLE "organization_roles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_role_permissions" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_role_permissions_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "organization_members" ADD COLUMN "role_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "organization_roles_organization_id_name_key" ON "organization_roles"("organization_id", "name");

-- CreateIndex
CREATE INDEX "organization_roles_organization_id_idx" ON "organization_roles"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_role_permissions_role_id_key_key" ON "organization_role_permissions"("role_id", "key");

-- CreateIndex
CREATE INDEX "organization_role_permissions_role_id_idx" ON "organization_role_permissions"("role_id");

-- Seed default system roles for existing organizations
INSERT INTO "organization_roles" (
    "id",
    "organization_id",
    "name",
    "description",
    "is_system",
    "is_default",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    organizations.id,
    default_roles.name,
    default_roles.description,
    true,
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "organizations"
CROSS JOIN (
    VALUES
        ('Owner', 'Full access to organization payroll, people, schedules, roles, and invites.'),
        ('Admin', 'Operational access to payroll, employees, and schedules.'),
        ('HR', 'Payroll-focused access for HR workflows.')
) AS default_roles("name", "description")
ON CONFLICT ("organization_id", "name") DO NOTHING;

-- Seed permissions for default system roles
INSERT INTO "organization_role_permissions" (
    "id",
    "role_id",
    "key",
    "created_at"
)
SELECT
    gen_random_uuid(),
    organization_roles.id,
    role_permissions.permission_key,
    CURRENT_TIMESTAMP
FROM "organization_roles"
JOIN (
    VALUES
        ('Owner', 'view_payroll'),
        ('Owner', 'edit_payroll'),
        ('Owner', 'view_employees'),
        ('Owner', 'edit_employees'),
        ('Owner', 'view_schedule'),
        ('Owner', 'edit_schedule'),
        ('Owner', 'manage_roles'),
        ('Owner', 'invite_users'),
        ('Admin', 'view_payroll'),
        ('Admin', 'edit_payroll'),
        ('Admin', 'view_employees'),
        ('Admin', 'edit_employees'),
        ('Admin', 'view_schedule'),
        ('Admin', 'edit_schedule'),
        ('HR', 'view_payroll'),
        ('HR', 'edit_payroll')
) AS role_permissions("role_name", "permission_key")
    ON role_permissions.role_name = organization_roles.name
ON CONFLICT ("role_id", "key") DO NOTHING;

-- Preserve any non-system legacy role names that already exist on memberships
INSERT INTO "organization_roles" (
    "id",
    "organization_id",
    "name",
    "description",
    "is_system",
    "is_default",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    legacy_roles.organization_id,
    legacy_roles.role_name,
    'Migrated from the legacy organization_members.role column.',
    false,
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT
        organization_id,
        CASE
            WHEN btrim(COALESCE(role, '')) = '' THEN 'Member'
            ELSE regexp_replace(initcap(replace(btrim(role), '_', ' ')), '\s+', ' ', 'g')
        END AS role_name
    FROM "organization_members"
    WHERE lower(btrim(COALESCE(role, ''))) NOT IN ('owner', 'admin', 'manager', 'hr')
) AS legacy_roles
ON CONFLICT ("organization_id", "name") DO NOTHING;

-- Backfill role_id from legacy role values
UPDATE "organization_members" AS organization_members
SET "role_id" = organization_roles.id
FROM "organization_roles"
WHERE organization_roles.organization_id = organization_members.organization_id
  AND (
    (lower(btrim(COALESCE(organization_members.role, ''))) = 'owner' AND organization_roles.name = 'Owner')
    OR (lower(btrim(COALESCE(organization_members.role, ''))) IN ('admin', 'manager') AND organization_roles.name = 'Admin')
    OR (lower(btrim(COALESCE(organization_members.role, ''))) = 'hr' AND organization_roles.name = 'HR')
    OR (
        lower(btrim(COALESCE(organization_members.role, ''))) NOT IN ('owner', 'admin', 'manager', 'hr')
        AND organization_roles.name = CASE
            WHEN btrim(COALESCE(organization_members.role, '')) = '' THEN 'Member'
            ELSE regexp_replace(initcap(replace(btrim(organization_members.role), '_', ' ')), '\s+', ' ', 'g')
        END
    )
  );

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "organization_members"
        WHERE "role_id" IS NULL
    ) THEN
        RAISE EXCEPTION 'Failed to backfill organization_members.role_id for all rows.';
    END IF;
END $$;

-- Rebuild foreign keys with the new delete behavior
ALTER TABLE "organization_members" DROP CONSTRAINT "organization_members_organization_id_fkey";
ALTER TABLE "organization_members" DROP CONSTRAINT "organization_members_user_id_fkey";

-- AlterTable
ALTER TABLE "organization_members" ALTER COLUMN "role_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "organization_members" DROP COLUMN "role";

-- CreateIndex
CREATE INDEX "organization_members_role_id_idx" ON "organization_members"("role_id");

-- AddForeignKey
ALTER TABLE "organization_roles" ADD CONSTRAINT "organization_roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_role_permissions" ADD CONSTRAINT "organization_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "organization_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "organization_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
