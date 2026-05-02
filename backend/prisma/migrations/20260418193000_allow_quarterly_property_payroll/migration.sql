ALTER TABLE "payroll_calendars"
DROP CONSTRAINT IF EXISTS "payroll_calendars_frequency_check";

ALTER TABLE "payroll_calendars"
ADD CONSTRAINT "payroll_calendars_frequency_check"
CHECK ("frequency" IN ('weekly', 'biweekly', 'semimonthly', 'monthly', 'quarterly', 'custom'));
