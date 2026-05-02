ALTER TABLE "payroll_run_shift_snapshots"
ADD COLUMN "actual_started_at" TIMESTAMPTZ(6),
ADD COLUMN "actual_ended_at" TIMESTAMPTZ(6),
ADD COLUMN "week_start_date" DATE,
ADD COLUMN "week_end_date" DATE,
ADD COLUMN "regular_minutes" INTEGER,
ADD COLUMN "overtime1_minutes" INTEGER,
ADD COLUMN "overtime2_minutes" INTEGER,
ADD COLUMN "department_label" TEXT,
ADD COLUMN "punch_info" TEXT;
