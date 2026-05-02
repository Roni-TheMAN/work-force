ALTER TABLE "time_punches"
  ADD COLUMN IF NOT EXISTS "client_event_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "time_punches_client_event_id_key"
  ON "time_punches" ("client_event_id");

CREATE INDEX IF NOT EXISTS "time_punches_client_event_id_idx"
  ON "time_punches" ("client_event_id");
