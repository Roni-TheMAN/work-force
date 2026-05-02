-- CreateTable
CREATE TABLE "property_user_roles" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "employee_code" TEXT,
    "pin_hash" TEXT,
    "employment_status" TEXT NOT NULL,
    "hire_date" TIMESTAMP(3),
    "terminated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_property_assignments" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "active_from" TIMESTAMP(3),
    "active_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_property_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "property_user_roles_user_id_idx" ON "property_user_roles"("user_id");

-- CreateIndex
CREATE INDEX "property_user_roles_property_id_idx" ON "property_user_roles"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "property_user_roles_property_id_user_id_key" ON "property_user_roles"("property_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_idx" ON "employees"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organization_id_employee_code_key" ON "employees"("organization_id", "employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organization_id_user_id_key" ON "employees"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "employee_property_assignments_property_id_idx" ON "employee_property_assignments"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_property_assignments_employee_id_property_id_key" ON "employee_property_assignments"("employee_id", "property_id");

-- AddForeignKey
ALTER TABLE "property_user_roles" ADD CONSTRAINT "property_user_roles_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_user_roles" ADD CONSTRAINT "property_user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_user_roles" ADD CONSTRAINT "property_user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "organization_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_property_assignments" ADD CONSTRAINT "employee_property_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_property_assignments" ADD CONSTRAINT "employee_property_assignments_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
