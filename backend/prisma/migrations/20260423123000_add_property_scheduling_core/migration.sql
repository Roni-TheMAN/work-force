CREATE TABLE "schedules" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "property_id" UUID NOT NULL,
  "week_start_date" DATE NOT NULL,
  "status" TEXT NOT NULL,
  "published_at" TIMESTAMPTZ(6),
  "published_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "schedules_status_check" CHECK ("status" IN ('draft', 'published'))
);

CREATE TABLE "shifts" (
  "id" UUID NOT NULL,
  "schedule_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "property_id" UUID NOT NULL,
  "employee_id" UUID,
  "position_label" TEXT,
  "date" DATE NOT NULL,
  "start_at" TIMESTAMPTZ(6) NOT NULL,
  "end_at" TIMESTAMPTZ(6) NOT NULL,
  "break_minutes" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "created_by_user_id" UUID NOT NULL,
  "updated_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "shifts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shifts_break_minutes_check" CHECK ("break_minutes" >= 0),
  CONSTRAINT "shifts_status_check" CHECK ("status" IN ('scheduled', 'open', 'cancelled')),
  CONSTRAINT "shifts_window_check" CHECK ("end_at" > "start_at")
);

ALTER TABLE "schedules"
ADD CONSTRAINT "schedules_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schedules"
ADD CONSTRAINT "schedules_property_id_fkey"
FOREIGN KEY ("property_id") REFERENCES "properties"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schedules"
ADD CONSTRAINT "schedules_published_by_user_id_fkey"
FOREIGN KEY ("published_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shifts"
ADD CONSTRAINT "shifts_schedule_id_fkey"
FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shifts"
ADD CONSTRAINT "shifts_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shifts"
ADD CONSTRAINT "shifts_property_id_fkey"
FOREIGN KEY ("property_id") REFERENCES "properties"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shifts"
ADD CONSTRAINT "shifts_employee_id_fkey"
FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shifts"
ADD CONSTRAINT "shifts_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shifts"
ADD CONSTRAINT "shifts_updated_by_user_id_fkey"
FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "schedules_property_id_week_start_date_key"
ON "schedules"("property_id", "week_start_date");

CREATE INDEX "schedules_organization_id_week_start_date_idx"
ON "schedules"("organization_id", "week_start_date");

CREATE INDEX "schedules_property_id_status_idx"
ON "schedules"("property_id", "status");

CREATE INDEX "schedules_published_by_user_id_idx"
ON "schedules"("published_by_user_id");

CREATE INDEX "shifts_schedule_id_date_idx"
ON "shifts"("schedule_id", "date");

CREATE INDEX "shifts_organization_id_date_idx"
ON "shifts"("organization_id", "date");

CREATE INDEX "shifts_property_id_date_idx"
ON "shifts"("property_id", "date");

CREATE INDEX "shifts_employee_id_start_at_end_at_idx"
ON "shifts"("employee_id", "start_at", "end_at");

CREATE INDEX "shifts_created_by_user_id_idx"
ON "shifts"("created_by_user_id");

CREATE INDEX "shifts_updated_by_user_id_idx"
ON "shifts"("updated_by_user_id");
