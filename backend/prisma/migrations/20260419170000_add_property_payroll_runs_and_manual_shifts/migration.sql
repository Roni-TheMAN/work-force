ALTER TABLE "time_shift_sessions"
ADD COLUMN "entry_mode" TEXT NOT NULL DEFAULT 'punch';

ALTER TABLE "payroll_runs"
ADD COLUMN "property_id" UUID,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "finalized_at" TIMESTAMPTZ(6),
ADD COLUMN "finalized_by_user_id" UUID,
ADD COLUMN "superseded_by_payroll_run_id" UUID;

UPDATE "payroll_runs" AS "payrollRun"
SET "property_id" = "setting"."property_id"
FROM "payroll_periods" AS "period"
INNER JOIN "property_payroll_settings" AS "setting"
  ON "setting"."payroll_calendar_id" = "period"."payroll_calendar_id"
WHERE "payrollRun"."payroll_period_id" = "period"."id"
  AND "payrollRun"."property_id" IS NULL;

ALTER TABLE "payroll_runs"
ALTER COLUMN "property_id" SET NOT NULL;

ALTER TABLE "payroll_runs"
ADD CONSTRAINT "payroll_runs_property_id_fkey"
FOREIGN KEY ("property_id") REFERENCES "properties"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_runs"
ADD CONSTRAINT "payroll_runs_finalized_by_user_id_fkey"
FOREIGN KEY ("finalized_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_runs"
ADD CONSTRAINT "payroll_runs_superseded_by_payroll_run_id_fkey"
FOREIGN KEY ("superseded_by_payroll_run_id") REFERENCES "payroll_runs"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "payroll_runs_payroll_period_id_property_id_version_key"
ON "payroll_runs"("payroll_period_id", "property_id", "version");

CREATE INDEX "payroll_runs_property_id_created_at_idx"
ON "payroll_runs"("property_id", "created_at");

CREATE INDEX "payroll_runs_finalized_by_user_id_idx"
ON "payroll_runs"("finalized_by_user_id");

CREATE INDEX "payroll_runs_superseded_by_payroll_run_id_idx"
ON "payroll_runs"("superseded_by_payroll_run_id");

ALTER TABLE "payroll_run_employee_summaries"
ADD COLUMN "approval_status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "approved_at" TIMESTAMPTZ(6),
ADD COLUMN "approved_by_user_id" UUID,
ADD COLUMN "approval_note" TEXT;

ALTER TABLE "payroll_run_employee_summaries"
ADD CONSTRAINT "payroll_run_employee_summaries_approved_by_user_id_fkey"
FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "payroll_run_employee_summaries_approval_status_idx"
ON "payroll_run_employee_summaries"("approval_status");

CREATE INDEX "payroll_run_employee_summaries_approved_by_user_id_idx"
ON "payroll_run_employee_summaries"("approved_by_user_id");

CREATE TABLE "payroll_run_shift_snapshots" (
  "id" UUID NOT NULL,
  "payroll_run_id" UUID NOT NULL,
  "shift_session_id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "employee_name" TEXT NOT NULL,
  "started_at" TIMESTAMPTZ(6) NOT NULL,
  "ended_at" TIMESTAMPTZ(6),
  "business_date" DATE NOT NULL,
  "total_minutes" INTEGER NOT NULL,
  "break_minutes" INTEGER NOT NULL,
  "payable_minutes" INTEGER NOT NULL,
  "estimated_gross_cents" BIGINT,
  "source" TEXT NOT NULL,
  "entry_mode" TEXT NOT NULL,
  "shift_status" TEXT NOT NULL,
  "is_manual" BOOLEAN NOT NULL DEFAULT false,
  "is_edited" BOOLEAN NOT NULL DEFAULT false,
  "is_auto_closed" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_run_shift_snapshots_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "payroll_run_shift_snapshots"
ADD CONSTRAINT "payroll_run_shift_snapshots_payroll_run_id_fkey"
FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "payroll_run_shift_snapshots_payroll_run_id_shift_session_id_key"
ON "payroll_run_shift_snapshots"("payroll_run_id", "shift_session_id");

CREATE INDEX "payroll_run_shift_snapshots_payroll_run_id_employee_id_idx"
ON "payroll_run_shift_snapshots"("payroll_run_id", "employee_id");
