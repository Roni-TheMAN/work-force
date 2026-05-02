ALTER TABLE "time_shift_sessions"
ADD COLUMN "auto_close_at" TIMESTAMPTZ(6);

UPDATE "time_shift_sessions" AS shift
SET "auto_close_at" =
  shift."started_at" + make_interval(hours => COALESCE((
    SELECT setting."auto_close_after_hours"
    FROM "property_payroll_settings" AS setting
    WHERE setting."property_id" = shift."property_id"
      AND setting."effective_from" <= shift."started_at"
      AND (
        setting."effective_to" IS NULL
        OR setting."effective_to" > shift."started_at"
      )
    ORDER BY setting."effective_from" DESC
    LIMIT 1
  ), 12));

ALTER TABLE "time_shift_sessions"
ALTER COLUMN "auto_close_at" SET NOT NULL;

CREATE INDEX "time_shift_sessions_status_auto_close_at_idx"
ON "time_shift_sessions" ("status", "auto_close_at");
