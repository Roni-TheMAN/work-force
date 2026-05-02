ALTER TABLE "time_punches"
DROP CONSTRAINT IF EXISTS "time_punches_source_check";

ALTER TABLE "time_punches"
ADD CONSTRAINT "time_punches_source_check"
CHECK ("source" IN ('kiosk', 'mobile', 'admin', 'import', 'auto_close', 'manual'));

ALTER TABLE "shift_break_segments"
DROP CONSTRAINT IF EXISTS "shift_break_segments_source_check";

ALTER TABLE "shift_break_segments"
ADD CONSTRAINT "shift_break_segments_source_check"
CHECK ("source" IN ('kiosk', 'mobile', 'admin', 'import', 'auto_close', 'system', 'manual'));
