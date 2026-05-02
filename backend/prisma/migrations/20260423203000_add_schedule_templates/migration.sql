CREATE TABLE "schedule_templates" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "property_id" UUID NOT NULL,
  "slot_index" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "updated_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "schedule_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "schedule_templates_slot_index_check" CHECK ("slot_index" BETWEEN 1 AND 3)
);

CREATE TABLE "schedule_template_shifts" (
  "id" UUID NOT NULL,
  "template_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "property_id" UUID NOT NULL,
  "employee_id" UUID,
  "day_index" INTEGER NOT NULL,
  "start_minutes" INTEGER NOT NULL,
  "end_minutes" INTEGER NOT NULL,
  "is_overnight" BOOLEAN NOT NULL DEFAULT false,
  "break_minutes" INTEGER NOT NULL DEFAULT 0,
  "position_label" TEXT,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "schedule_template_shifts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "schedule_template_shifts_day_index_check" CHECK ("day_index" BETWEEN 0 AND 6),
  CONSTRAINT "schedule_template_shifts_start_minutes_check" CHECK ("start_minutes" BETWEEN 0 AND 1439),
  CONSTRAINT "schedule_template_shifts_end_minutes_check" CHECK ("end_minutes" BETWEEN 0 AND 1439),
  CONSTRAINT "schedule_template_shifts_break_minutes_check" CHECK ("break_minutes" >= 0),
  CONSTRAINT "schedule_template_shifts_status_check" CHECK ("status" IN ('scheduled', 'open', 'cancelled')),
  CONSTRAINT "schedule_template_shifts_window_check" CHECK (
    ("is_overnight" = false AND "end_minutes" > "start_minutes")
    OR
    ("is_overnight" = true AND "end_minutes" <> "start_minutes")
  )
);

ALTER TABLE "schedule_templates"
ADD CONSTRAINT "schedule_templates_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schedule_templates"
ADD CONSTRAINT "schedule_templates_property_id_fkey"
FOREIGN KEY ("property_id") REFERENCES "properties"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schedule_templates"
ADD CONSTRAINT "schedule_templates_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "schedule_templates"
ADD CONSTRAINT "schedule_templates_updated_by_user_id_fkey"
FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "schedule_template_shifts"
ADD CONSTRAINT "schedule_template_shifts_template_id_fkey"
FOREIGN KEY ("template_id") REFERENCES "schedule_templates"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schedule_template_shifts"
ADD CONSTRAINT "schedule_template_shifts_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schedule_template_shifts"
ADD CONSTRAINT "schedule_template_shifts_property_id_fkey"
FOREIGN KEY ("property_id") REFERENCES "properties"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schedule_template_shifts"
ADD CONSTRAINT "schedule_template_shifts_employee_id_fkey"
FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "schedule_templates_property_id_slot_index_key"
ON "schedule_templates"("property_id", "slot_index");

CREATE INDEX "schedule_templates_organization_id_property_id_idx"
ON "schedule_templates"("organization_id", "property_id");

CREATE INDEX "schedule_templates_created_by_user_id_idx"
ON "schedule_templates"("created_by_user_id");

CREATE INDEX "schedule_templates_updated_by_user_id_idx"
ON "schedule_templates"("updated_by_user_id");

CREATE INDEX "schedule_template_shifts_template_id_day_index_idx"
ON "schedule_template_shifts"("template_id", "day_index");

CREATE INDEX "schedule_template_shifts_organization_id_property_id_day_index_idx"
ON "schedule_template_shifts"("organization_id", "property_id", "day_index");

CREATE INDEX "schedule_template_shifts_employee_id_day_index_start_minutes_end_minutes_idx"
ON "schedule_template_shifts"("employee_id", "day_index", "start_minutes", "end_minutes");
