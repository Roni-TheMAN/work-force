-- Strengthen the existing Phase 1 tenant boundary so Phase 2 can use composite scope-safe foreign keys.
CREATE UNIQUE INDEX "properties_id_organization_id_key" ON "properties"("id", "organization_id");
CREATE UNIQUE INDEX "employees_id_organization_id_key" ON "employees"("id", "organization_id");

-- CreateTable
CREATE TABLE "property_devices" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "device_name" TEXT NOT NULL,
    "device_type" TEXT NOT NULL,
    "pairing_code" TEXT NOT NULL,
    "auth_token_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "last_seen_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "property_devices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "property_devices_device_type_check" CHECK ("device_type" IN ('kiosk', 'mobile', 'tablet', 'desktop', 'other')),
    CONSTRAINT "property_devices_pairing_code_check" CHECK (char_length(btrim("pairing_code")) > 0),
    CONSTRAINT "property_devices_auth_token_hash_check" CHECK (char_length(btrim("auth_token_hash")) > 0),
    CONSTRAINT "property_devices_status_check" CHECK ("status" IN ('active', 'inactive', 'retired', 'blocked'))
);

-- CreateTable
CREATE TABLE "time_punches" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "property_device_id" UUID,
    "punch_type" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "business_date" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "photo_url" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL,
    "replaced_by_punch_id" UUID,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_punches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "time_punches_punch_type_check" CHECK ("punch_type" IN ('clock_in', 'clock_out', 'break_start', 'break_end')),
    CONSTRAINT "time_punches_source_check" CHECK ("source" IN ('kiosk', 'mobile', 'admin', 'import', 'auto_close')),
    CONSTRAINT "time_punches_status_check" CHECK ("status" IN ('valid', 'voided', 'replaced')),
    CONSTRAINT "time_punches_replaced_by_punch_id_check" CHECK ("replaced_by_punch_id" IS NULL OR "replaced_by_punch_id" <> "id")
);

-- CreateTable
CREATE TABLE "time_shift_sessions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "clock_in_punch_id" UUID NOT NULL,
    "clock_out_punch_id" UUID,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),
    "business_date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "total_minutes" INTEGER,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "payable_minutes" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "time_shift_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "time_shift_sessions_status_check" CHECK ("status" IN ('open', 'closed', 'auto_closed', 'edited')),
    CONSTRAINT "time_shift_sessions_ended_at_check" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at"),
    CONSTRAINT "time_shift_sessions_total_minutes_check" CHECK ("total_minutes" IS NULL OR "total_minutes" >= 0),
    CONSTRAINT "time_shift_sessions_break_minutes_check" CHECK ("break_minutes" >= 0),
    CONSTRAINT "time_shift_sessions_payable_minutes_check" CHECK ("payable_minutes" IS NULL OR "payable_minutes" >= 0),
    CONSTRAINT "time_shift_sessions_payable_le_total_check" CHECK (
        "total_minutes" IS NULL
        OR "payable_minutes" IS NULL
        OR "payable_minutes" <= "total_minutes"
    ),
    CONSTRAINT "time_shift_sessions_closed_rollup_check" CHECK (
        "ended_at" IS NULL
        OR ("total_minutes" IS NOT NULL AND "payable_minutes" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "shift_break_segments" (
    "id" UUID NOT NULL,
    "shift_session_id" UUID NOT NULL,
    "break_type" TEXT NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),
    "duration_minutes" INTEGER,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_break_segments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shift_break_segments_break_type_check" CHECK ("break_type" IN ('meal', 'rest', 'other')),
    CONSTRAINT "shift_break_segments_source_check" CHECK ("source" IN ('kiosk', 'mobile', 'admin', 'import', 'auto_close', 'system')),
    CONSTRAINT "shift_break_segments_ended_at_check" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at"),
    CONSTRAINT "shift_break_segments_duration_minutes_check" CHECK ("duration_minutes" IS NULL OR "duration_minutes" >= 0)
);

-- CreateTable
CREATE TABLE "time_adjustments" (
    "id" UUID NOT NULL,
    "shift_session_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "adjusted_by_user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "before_snapshot" JSONB NOT NULL,
    "after_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_adjustments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "time_adjustments_reason_check" CHECK (char_length(btrim("reason")) > 0)
);

-- CreateTable
CREATE TABLE "overtime_policies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "property_id" UUID,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "ot1_multiplier" DECIMAL(6,3) NOT NULL,
    "ot2_multiplier" DECIMAL(6,3) NOT NULL,
    "ot1_daily_after_minutes" INTEGER,
    "ot2_daily_after_minutes" INTEGER,
    "ot1_weekly_after_minutes" INTEGER,
    "ot2_weekly_after_minutes" INTEGER,
    "rules_json" JSONB,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "overtime_policies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "overtime_policies_status_check" CHECK ("status" IN ('active', 'inactive', 'archived')),
    CONSTRAINT "overtime_policies_ot1_multiplier_check" CHECK ("ot1_multiplier" > 0),
    CONSTRAINT "overtime_policies_ot2_multiplier_check" CHECK ("ot2_multiplier" >= "ot1_multiplier"),
    CONSTRAINT "overtime_policies_daily_thresholds_check" CHECK (
        ("ot1_daily_after_minutes" IS NULL OR "ot1_daily_after_minutes" >= 0)
        AND ("ot2_daily_after_minutes" IS NULL OR "ot2_daily_after_minutes" >= 0)
        AND ("ot1_daily_after_minutes" IS NULL OR "ot2_daily_after_minutes" IS NULL OR "ot2_daily_after_minutes" >= "ot1_daily_after_minutes")
    ),
    CONSTRAINT "overtime_policies_weekly_thresholds_check" CHECK (
        ("ot1_weekly_after_minutes" IS NULL OR "ot1_weekly_after_minutes" >= 0)
        AND ("ot2_weekly_after_minutes" IS NULL OR "ot2_weekly_after_minutes" >= 0)
        AND ("ot1_weekly_after_minutes" IS NULL OR "ot2_weekly_after_minutes" IS NULL OR "ot2_weekly_after_minutes" >= "ot1_weekly_after_minutes")
    ),
    CONSTRAINT "overtime_policies_effective_window_check" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from")
);

-- CreateTable
CREATE TABLE "employee_pay_rates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "property_id" UUID,
    "pay_type" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "base_hourly_rate_cents" BIGINT,
    "annual_salary_cents" BIGINT,
    "overtime_policy_id" UUID NOT NULL,
    "title" TEXT,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employee_pay_rates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "employee_pay_rates_pay_type_check" CHECK ("pay_type" IN ('hourly', 'salary')),
    CONSTRAINT "employee_pay_rates_currency_check" CHECK (char_length("currency") = 3 AND "currency" = upper("currency")),
    CONSTRAINT "employee_pay_rates_amounts_check" CHECK (
        ("base_hourly_rate_cents" IS NULL OR "base_hourly_rate_cents" >= 0)
        AND ("annual_salary_cents" IS NULL OR "annual_salary_cents" >= 0)
    ),
    CONSTRAINT "employee_pay_rates_pay_shape_check" CHECK (
        ("pay_type" = 'hourly' AND "base_hourly_rate_cents" IS NOT NULL AND "annual_salary_cents" IS NULL)
        OR ("pay_type" = 'salary' AND "annual_salary_cents" IS NOT NULL AND "base_hourly_rate_cents" IS NULL)
    ),
    CONSTRAINT "employee_pay_rates_effective_window_check" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from")
);

-- CreateTable
CREATE TABLE "payroll_calendars" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "week_starts_on" INTEGER,
    "anchor_start_date" DATE NOT NULL,
    "semi_monthly_first_day" INTEGER,
    "semi_monthly_second_day" INTEGER,
    "pay_delay_days" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "config_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payroll_calendars_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payroll_calendars_frequency_check" CHECK ("frequency" IN ('weekly', 'biweekly', 'semimonthly', 'monthly', 'custom')),
    CONSTRAINT "payroll_calendars_status_check" CHECK ("status" IN ('active', 'inactive', 'archived')),
    CONSTRAINT "payroll_calendars_pay_delay_days_check" CHECK ("pay_delay_days" >= 0),
    CONSTRAINT "payroll_calendars_week_start_check" CHECK (
        ("frequency" IN ('weekly', 'biweekly') AND "week_starts_on" BETWEEN 0 AND 6)
        OR ("frequency" NOT IN ('weekly', 'biweekly') AND "week_starts_on" IS NULL)
    ),
    CONSTRAINT "payroll_calendars_semimonthly_days_check" CHECK (
        ("frequency" = 'semimonthly'
            AND "semi_monthly_first_day" BETWEEN 1 AND 31
            AND "semi_monthly_second_day" BETWEEN 1 AND 31
            AND "semi_monthly_first_day" < "semi_monthly_second_day")
        OR ("frequency" <> 'semimonthly'
            AND "semi_monthly_first_day" IS NULL
            AND "semi_monthly_second_day" IS NULL)
    )
);

-- CreateTable
CREATE TABLE "property_payroll_settings" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "payroll_calendar_id" UUID NOT NULL,
    "default_overtime_policy_id" UUID NOT NULL,
    "rounding_increment_minutes" INTEGER NOT NULL DEFAULT 1,
    "rounding_mode" TEXT NOT NULL DEFAULT 'nearest',
    "auto_close_after_hours" INTEGER,
    "meal_break_deduction_minutes" INTEGER,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "property_payroll_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "property_payroll_settings_rounding_increment_check" CHECK ("rounding_increment_minutes" > 0),
    CONSTRAINT "property_payroll_settings_rounding_mode_check" CHECK ("rounding_mode" IN ('none', 'nearest', 'up', 'down')),
    CONSTRAINT "property_payroll_settings_auto_close_check" CHECK ("auto_close_after_hours" IS NULL OR "auto_close_after_hours" > 0),
    CONSTRAINT "property_payroll_settings_meal_break_deduction_check" CHECK ("meal_break_deduction_minutes" IS NULL OR "meal_break_deduction_minutes" >= 0),
    CONSTRAINT "property_payroll_settings_effective_window_check" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from")
);

-- CreateTable
CREATE TABLE "payroll_periods" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "payroll_calendar_id" UUID NOT NULL,
    "period_start_date" DATE NOT NULL,
    "period_end_date" DATE NOT NULL,
    "pay_date" DATE,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payroll_periods_status_check" CHECK ("status" IN ('open', 'locked', 'processing', 'finalized', 'paid')),
    CONSTRAINT "payroll_periods_date_range_check" CHECK ("period_end_date" >= "period_start_date"),
    CONSTRAINT "payroll_periods_pay_date_check" CHECK ("pay_date" IS NULL OR "pay_date" >= "period_end_date")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "payroll_period_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payroll_runs_status_check" CHECK ("status" IN ('pending', 'running', 'completed', 'failed', 'canceled')),
    CONSTRAINT "payroll_runs_completed_at_check" CHECK ("completed_at" IS NULL OR "started_at" IS NULL OR "completed_at" >= "started_at")
);

-- CreateTable
CREATE TABLE "payroll_run_employee_summaries" (
    "id" UUID NOT NULL,
    "payroll_run_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "total_minutes" INTEGER NOT NULL,
    "regular_minutes" INTEGER NOT NULL,
    "overtime1_minutes" INTEGER NOT NULL,
    "overtime2_minutes" INTEGER NOT NULL,
    "break_minutes" INTEGER NOT NULL,
    "payable_minutes" INTEGER NOT NULL,
    "regular_pay_cents" BIGINT NOT NULL,
    "overtime1_pay_cents" BIGINT NOT NULL,
    "overtime2_pay_cents" BIGINT NOT NULL,
    "gross_pay_cents" BIGINT NOT NULL,
    "rate_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_run_employee_summaries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payroll_run_employee_summaries_minutes_check" CHECK (
        "total_minutes" >= 0
        AND "regular_minutes" >= 0
        AND "overtime1_minutes" >= 0
        AND "overtime2_minutes" >= 0
        AND "break_minutes" >= 0
        AND "payable_minutes" >= 0
        AND "payable_minutes" <= "total_minutes"
        AND ("regular_minutes" + "overtime1_minutes" + "overtime2_minutes") = "payable_minutes"
    ),
    CONSTRAINT "payroll_run_employee_summaries_pay_check" CHECK (
        "regular_pay_cents" >= 0
        AND "overtime1_pay_cents" >= 0
        AND "overtime2_pay_cents" >= 0
        AND "gross_pay_cents" >= 0
        AND ("regular_pay_cents" + "overtime1_pay_cents" + "overtime2_pay_cents") = "gross_pay_cents"
    )
);

-- CreateTable
CREATE TABLE "payroll_run_property_breakdowns" (
    "id" UUID NOT NULL,
    "payroll_run_employee_summary_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "total_minutes" INTEGER NOT NULL,
    "regular_minutes" INTEGER NOT NULL,
    "overtime1_minutes" INTEGER NOT NULL,
    "overtime2_minutes" INTEGER NOT NULL,
    "gross_pay_cents" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_run_property_breakdowns_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payroll_run_property_breakdowns_minutes_check" CHECK (
        "total_minutes" >= 0
        AND "regular_minutes" >= 0
        AND "overtime1_minutes" >= 0
        AND "overtime2_minutes" >= 0
        AND ("regular_minutes" + "overtime1_minutes" + "overtime2_minutes") <= "total_minutes"
    ),
    CONSTRAINT "payroll_run_property_breakdowns_gross_pay_check" CHECK ("gross_pay_cents" >= 0)
);

-- CreateTable
CREATE TABLE "payroll_batches" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "as_of_date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payroll_batches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payroll_batches_status_check" CHECK ("status" IN ('pending', 'running', 'completed', 'failed', 'canceled'))
);

-- CreateTable
CREATE TABLE "payroll_batch_runs" (
    "id" UUID NOT NULL,
    "payroll_batch_id" UUID NOT NULL,
    "payroll_run_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_batch_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_labor_daily_metrics" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "metric_date" DATE NOT NULL,
    "employees_worked_count" INTEGER NOT NULL,
    "shifts_count" INTEGER NOT NULL,
    "open_shifts_count" INTEGER NOT NULL,
    "total_minutes" INTEGER NOT NULL,
    "regular_minutes" INTEGER NOT NULL,
    "overtime1_minutes" INTEGER NOT NULL,
    "overtime2_minutes" INTEGER NOT NULL,
    "gross_labor_cents" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "property_labor_daily_metrics_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "property_labor_daily_metrics_values_check" CHECK (
        "employees_worked_count" >= 0
        AND "shifts_count" >= 0
        AND "open_shifts_count" >= 0
        AND "total_minutes" >= 0
        AND "regular_minutes" >= 0
        AND "overtime1_minutes" >= 0
        AND "overtime2_minutes" >= 0
        AND "gross_labor_cents" >= 0
    )
);

-- CreateTable
CREATE TABLE "organization_labor_daily_metrics" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "metric_date" DATE NOT NULL,
    "properties_reporting_count" INTEGER NOT NULL,
    "employees_worked_count" INTEGER NOT NULL,
    "shifts_count" INTEGER NOT NULL,
    "open_shifts_count" INTEGER NOT NULL,
    "total_minutes" INTEGER NOT NULL,
    "regular_minutes" INTEGER NOT NULL,
    "overtime1_minutes" INTEGER NOT NULL,
    "overtime2_minutes" INTEGER NOT NULL,
    "gross_labor_cents" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organization_labor_daily_metrics_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "organization_labor_daily_metrics_values_check" CHECK (
        "properties_reporting_count" >= 0
        AND "employees_worked_count" >= 0
        AND "shifts_count" >= 0
        AND "open_shifts_count" >= 0
        AND "total_minutes" >= 0
        AND "regular_minutes" >= 0
        AND "overtime1_minutes" >= 0
        AND "overtime2_minutes" >= 0
        AND "gross_labor_cents" >= 0
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "property_devices_pairing_code_key" ON "property_devices"("pairing_code");
CREATE UNIQUE INDEX "property_devices_auth_token_hash_key" ON "property_devices"("auth_token_hash");
CREATE UNIQUE INDEX "property_devices_id_property_id_key" ON "property_devices"("id", "property_id");
CREATE INDEX "property_devices_property_id_idx" ON "property_devices"("property_id");
CREATE INDEX "property_devices_status_idx" ON "property_devices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "time_punches_id_organization_id_property_id_employee_id_key"
ON "time_punches"("id", "organization_id", "property_id", "employee_id");
CREATE INDEX "time_punches_organization_id_business_date_idx" ON "time_punches"("organization_id", "business_date");
CREATE INDEX "time_punches_property_id_business_date_idx" ON "time_punches"("property_id", "business_date");
CREATE INDEX "time_punches_employee_id_occurred_at_idx" ON "time_punches"("employee_id", "occurred_at");
CREATE INDEX "time_punches_property_device_id_idx" ON "time_punches"("property_device_id");
CREATE INDEX "time_punches_created_by_user_id_idx" ON "time_punches"("created_by_user_id");
CREATE INDEX "time_punches_status_idx" ON "time_punches"("status");

-- CreateIndex
CREATE UNIQUE INDEX "time_shift_sessions_clock_in_punch_id_key" ON "time_shift_sessions"("clock_in_punch_id");
CREATE UNIQUE INDEX "time_shift_sessions_clock_out_punch_id_key" ON "time_shift_sessions"("clock_out_punch_id");
CREATE UNIQUE INDEX "time_shift_sessions_scope_key"
ON "time_shift_sessions"("id", "organization_id", "property_id", "employee_id");
CREATE INDEX "time_shift_sessions_organization_id_business_date_idx" ON "time_shift_sessions"("organization_id", "business_date");
CREATE INDEX "time_shift_sessions_property_id_business_date_idx" ON "time_shift_sessions"("property_id", "business_date");
CREATE INDEX "time_shift_sessions_employee_id_started_at_idx" ON "time_shift_sessions"("employee_id", "started_at");
CREATE INDEX "time_shift_sessions_status_idx" ON "time_shift_sessions"("status");
CREATE UNIQUE INDEX "time_shift_sessions_one_open_shift_per_employee_idx"
ON "time_shift_sessions"("employee_id")
WHERE "ended_at" IS NULL;

-- CreateIndex
CREATE INDEX "shift_break_segments_shift_session_id_started_at_idx" ON "shift_break_segments"("shift_session_id", "started_at");
CREATE UNIQUE INDEX "shift_break_segments_one_open_break_per_shift_idx"
ON "shift_break_segments"("shift_session_id")
WHERE "ended_at" IS NULL;

-- CreateIndex
CREATE INDEX "time_adjustments_shift_session_id_idx" ON "time_adjustments"("shift_session_id");
CREATE INDEX "time_adjustments_organization_id_created_at_idx" ON "time_adjustments"("organization_id", "created_at");
CREATE INDEX "time_adjustments_property_id_created_at_idx" ON "time_adjustments"("property_id", "created_at");
CREATE INDEX "time_adjustments_employee_id_created_at_idx" ON "time_adjustments"("employee_id", "created_at");
CREATE INDEX "time_adjustments_adjusted_by_user_id_idx" ON "time_adjustments"("adjusted_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "overtime_policies_id_organization_id_key" ON "overtime_policies"("id", "organization_id");
CREATE INDEX "overtime_policies_organization_id_effective_from_idx" ON "overtime_policies"("organization_id", "effective_from");
CREATE INDEX "overtime_policies_property_id_effective_from_idx" ON "overtime_policies"("property_id", "effective_from");
CREATE INDEX "overtime_policies_status_idx" ON "overtime_policies"("status");
CREATE UNIQUE INDEX "overtime_policies_org_default_name_effective_from_key"
ON "overtime_policies"("organization_id", "name", "effective_from")
WHERE "property_id" IS NULL;
CREATE UNIQUE INDEX "overtime_policies_property_override_name_effective_from_key"
ON "overtime_policies"("organization_id", "property_id", "name", "effective_from")
WHERE "property_id" IS NOT NULL;

-- CreateIndex
CREATE INDEX "employee_pay_rates_organization_id_effective_from_idx" ON "employee_pay_rates"("organization_id", "effective_from");
CREATE INDEX "employee_pay_rates_employee_id_effective_from_idx" ON "employee_pay_rates"("employee_id", "effective_from");
CREATE INDEX "employee_pay_rates_property_id_effective_from_idx" ON "employee_pay_rates"("property_id", "effective_from");
CREATE INDEX "employee_pay_rates_overtime_policy_id_idx" ON "employee_pay_rates"("overtime_policy_id");
CREATE UNIQUE INDEX "employee_pay_rates_employee_org_default_effective_from_key"
ON "employee_pay_rates"("employee_id", "effective_from")
WHERE "property_id" IS NULL;
CREATE UNIQUE INDEX "employee_pay_rates_employee_property_effective_from_key"
ON "employee_pay_rates"("employee_id", "property_id", "effective_from")
WHERE "property_id" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "payroll_calendars_id_organization_id_key" ON "payroll_calendars"("id", "organization_id");
CREATE UNIQUE INDEX "payroll_calendars_organization_id_name_key" ON "payroll_calendars"("organization_id", "name");
CREATE INDEX "payroll_calendars_organization_id_status_idx" ON "payroll_calendars"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "property_payroll_settings_property_id_effective_from_key"
ON "property_payroll_settings"("property_id", "effective_from");
CREATE INDEX "property_payroll_settings_property_id_effective_from_idx" ON "property_payroll_settings"("property_id", "effective_from");
CREATE INDEX "property_payroll_settings_payroll_calendar_id_idx" ON "property_payroll_settings"("payroll_calendar_id");
CREATE INDEX "property_payroll_settings_default_overtime_policy_id_idx" ON "property_payroll_settings"("default_overtime_policy_id");
CREATE UNIQUE INDEX "property_payroll_settings_one_open_ended_per_property_idx"
ON "property_payroll_settings"("property_id")
WHERE "effective_to" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "payroll_periods_id_organization_id_key" ON "payroll_periods"("id", "organization_id");
CREATE UNIQUE INDEX "payroll_periods_calendar_range_key"
ON "payroll_periods"("payroll_calendar_id", "period_start_date", "period_end_date");
CREATE INDEX "payroll_periods_organization_id_period_start_date_idx" ON "payroll_periods"("organization_id", "period_start_date");
CREATE INDEX "payroll_periods_status_idx" ON "payroll_periods"("status");

-- CreateIndex
CREATE INDEX "payroll_runs_organization_id_created_at_idx" ON "payroll_runs"("organization_id", "created_at");
CREATE INDEX "payroll_runs_payroll_period_id_idx" ON "payroll_runs"("payroll_period_id");
CREATE INDEX "payroll_runs_requested_by_user_id_idx" ON "payroll_runs"("requested_by_user_id");
CREATE INDEX "payroll_runs_status_idx" ON "payroll_runs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_run_employee_summaries_payroll_run_id_employee_id_key"
ON "payroll_run_employee_summaries"("payroll_run_id", "employee_id");
CREATE INDEX "payroll_run_employee_summaries_employee_id_idx" ON "payroll_run_employee_summaries"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_run_property_breakdowns_summary_property_key"
ON "payroll_run_property_breakdowns"("payroll_run_employee_summary_id", "property_id");
CREATE INDEX "payroll_run_property_breakdowns_property_id_idx" ON "payroll_run_property_breakdowns"("property_id");

-- CreateIndex
CREATE INDEX "payroll_batches_organization_id_as_of_date_idx" ON "payroll_batches"("organization_id", "as_of_date");
CREATE INDEX "payroll_batches_requested_by_user_id_idx" ON "payroll_batches"("requested_by_user_id");
CREATE INDEX "payroll_batches_status_idx" ON "payroll_batches"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_batch_runs_payroll_batch_id_payroll_run_id_key"
ON "payroll_batch_runs"("payroll_batch_id", "payroll_run_id");
CREATE INDEX "payroll_batch_runs_payroll_run_id_idx" ON "payroll_batch_runs"("payroll_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "property_labor_daily_metrics_property_id_metric_date_key"
ON "property_labor_daily_metrics"("property_id", "metric_date");
CREATE INDEX "property_labor_daily_metrics_organization_id_metric_date_idx"
ON "property_labor_daily_metrics"("organization_id", "metric_date");

-- CreateIndex
CREATE UNIQUE INDEX "org_labor_daily_metrics_org_date_key"
ON "organization_labor_daily_metrics"("organization_id", "metric_date");

-- AddForeignKey
ALTER TABLE "property_devices"
ADD CONSTRAINT "property_devices_property_id_fkey"
FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "time_punches"
ADD CONSTRAINT "time_punches_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "time_punches"
ADD CONSTRAINT "time_punches_property_id_fkey"
FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_punches"
ADD CONSTRAINT "time_punches_employee_id_fkey"
FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_punches"
ADD CONSTRAINT "time_punches_property_device_id_fkey"
FOREIGN KEY ("property_device_id") REFERENCES "property_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_punches"
ADD CONSTRAINT "time_punches_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "time_punches"
ADD CONSTRAINT "time_punches_replaced_by_punch_id_fkey"
FOREIGN KEY ("replaced_by_punch_id") REFERENCES "time_punches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "time_punches"
ADD CONSTRAINT "time_punches_property_scope_fkey"
FOREIGN KEY ("property_id", "organization_id") REFERENCES "properties"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_punches"
ADD CONSTRAINT "time_punches_employee_scope_fkey"
FOREIGN KEY ("employee_id", "organization_id") REFERENCES "employees"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_punches"
ADD CONSTRAINT "time_punches_employee_property_assignment_fkey"
FOREIGN KEY ("employee_id", "property_id") REFERENCES "employee_property_assignments"("employee_id", "property_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_punches"
ADD CONSTRAINT "time_punches_property_device_scope_fkey"
FOREIGN KEY ("property_device_id", "property_id") REFERENCES "property_devices"("id", "property_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_shift_sessions"
ADD CONSTRAINT "time_shift_sessions_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "time_shift_sessions"
ADD CONSTRAINT "time_shift_sessions_property_id_fkey"
FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_shift_sessions"
ADD CONSTRAINT "time_shift_sessions_employee_id_fkey"
FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_shift_sessions"
ADD CONSTRAINT "time_shift_sessions_clock_in_punch_id_fkey"
FOREIGN KEY ("clock_in_punch_id") REFERENCES "time_punches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_shift_sessions"
ADD CONSTRAINT "time_shift_sessions_clock_out_punch_id_fkey"
FOREIGN KEY ("clock_out_punch_id") REFERENCES "time_punches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_shift_sessions"
ADD CONSTRAINT "time_shift_sessions_property_scope_fkey"
FOREIGN KEY ("property_id", "organization_id") REFERENCES "properties"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_shift_sessions"
ADD CONSTRAINT "time_shift_sessions_employee_scope_fkey"
FOREIGN KEY ("employee_id", "organization_id") REFERENCES "employees"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_shift_sessions"
ADD CONSTRAINT "time_shift_sessions_employee_property_assignment_fkey"
FOREIGN KEY ("employee_id", "property_id") REFERENCES "employee_property_assignments"("employee_id", "property_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_shift_sessions"
ADD CONSTRAINT "time_shift_sessions_clock_in_scope_fkey"
FOREIGN KEY ("clock_in_punch_id", "organization_id", "property_id", "employee_id")
REFERENCES "time_punches"("id", "organization_id", "property_id", "employee_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_shift_sessions"
ADD CONSTRAINT "time_shift_sessions_clock_out_scope_fkey"
FOREIGN KEY ("clock_out_punch_id", "organization_id", "property_id", "employee_id")
REFERENCES "time_punches"("id", "organization_id", "property_id", "employee_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shift_break_segments"
ADD CONSTRAINT "shift_break_segments_shift_session_id_fkey"
FOREIGN KEY ("shift_session_id") REFERENCES "time_shift_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "time_adjustments"
ADD CONSTRAINT "time_adjustments_shift_session_id_fkey"
FOREIGN KEY ("shift_session_id") REFERENCES "time_shift_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "time_adjustments"
ADD CONSTRAINT "time_adjustments_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "time_adjustments"
ADD CONSTRAINT "time_adjustments_property_id_fkey"
FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_adjustments"
ADD CONSTRAINT "time_adjustments_employee_id_fkey"
FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_adjustments"
ADD CONSTRAINT "time_adjustments_adjusted_by_user_id_fkey"
FOREIGN KEY ("adjusted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_adjustments"
ADD CONSTRAINT "time_adjustments_property_scope_fkey"
FOREIGN KEY ("property_id", "organization_id") REFERENCES "properties"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_adjustments"
ADD CONSTRAINT "time_adjustments_employee_scope_fkey"
FOREIGN KEY ("employee_id", "organization_id") REFERENCES "employees"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "time_adjustments"
ADD CONSTRAINT "time_adjustments_shift_scope_fkey"
FOREIGN KEY ("shift_session_id", "organization_id", "property_id", "employee_id")
REFERENCES "time_shift_sessions"("id", "organization_id", "property_id", "employee_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "overtime_policies"
ADD CONSTRAINT "overtime_policies_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "overtime_policies"
ADD CONSTRAINT "overtime_policies_property_id_fkey"
FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "overtime_policies"
ADD CONSTRAINT "overtime_policies_property_scope_fkey"
FOREIGN KEY ("property_id", "organization_id") REFERENCES "properties"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_pay_rates"
ADD CONSTRAINT "employee_pay_rates_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_pay_rates"
ADD CONSTRAINT "employee_pay_rates_employee_id_fkey"
FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_pay_rates"
ADD CONSTRAINT "employee_pay_rates_property_id_fkey"
FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_pay_rates"
ADD CONSTRAINT "employee_pay_rates_overtime_policy_id_fkey"
FOREIGN KEY ("overtime_policy_id") REFERENCES "overtime_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_pay_rates"
ADD CONSTRAINT "employee_pay_rates_employee_scope_fkey"
FOREIGN KEY ("employee_id", "organization_id") REFERENCES "employees"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_pay_rates"
ADD CONSTRAINT "employee_pay_rates_property_scope_fkey"
FOREIGN KEY ("property_id", "organization_id") REFERENCES "properties"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_pay_rates"
ADD CONSTRAINT "employee_pay_rates_overtime_policy_scope_fkey"
FOREIGN KEY ("overtime_policy_id", "organization_id") REFERENCES "overtime_policies"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_calendars"
ADD CONSTRAINT "payroll_calendars_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "property_payroll_settings"
ADD CONSTRAINT "property_payroll_settings_property_id_fkey"
FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "property_payroll_settings"
ADD CONSTRAINT "property_payroll_settings_payroll_calendar_id_fkey"
FOREIGN KEY ("payroll_calendar_id") REFERENCES "payroll_calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "property_payroll_settings"
ADD CONSTRAINT "property_payroll_settings_default_overtime_policy_id_fkey"
FOREIGN KEY ("default_overtime_policy_id") REFERENCES "overtime_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_periods"
ADD CONSTRAINT "payroll_periods_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_periods"
ADD CONSTRAINT "payroll_periods_payroll_calendar_id_fkey"
FOREIGN KEY ("payroll_calendar_id") REFERENCES "payroll_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_periods"
ADD CONSTRAINT "payroll_periods_calendar_scope_fkey"
FOREIGN KEY ("payroll_calendar_id", "organization_id") REFERENCES "payroll_calendars"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_runs"
ADD CONSTRAINT "payroll_runs_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_runs"
ADD CONSTRAINT "payroll_runs_payroll_period_id_fkey"
FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_runs"
ADD CONSTRAINT "payroll_runs_requested_by_user_id_fkey"
FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_runs"
ADD CONSTRAINT "payroll_runs_period_scope_fkey"
FOREIGN KEY ("payroll_period_id", "organization_id") REFERENCES "payroll_periods"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_run_employee_summaries"
ADD CONSTRAINT "payroll_run_employee_summaries_payroll_run_id_fkey"
FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_run_employee_summaries"
ADD CONSTRAINT "payroll_run_employee_summaries_employee_id_fkey"
FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_run_property_breakdowns"
ADD CONSTRAINT "payroll_run_property_breakdowns_summary_fkey"
FOREIGN KEY ("payroll_run_employee_summary_id") REFERENCES "payroll_run_employee_summaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_run_property_breakdowns"
ADD CONSTRAINT "payroll_run_property_breakdowns_property_id_fkey"
FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_batches"
ADD CONSTRAINT "payroll_batches_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_batches"
ADD CONSTRAINT "payroll_batches_requested_by_user_id_fkey"
FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_batch_runs"
ADD CONSTRAINT "payroll_batch_runs_payroll_batch_id_fkey"
FOREIGN KEY ("payroll_batch_id") REFERENCES "payroll_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_batch_runs"
ADD CONSTRAINT "payroll_batch_runs_payroll_run_id_fkey"
FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "property_labor_daily_metrics"
ADD CONSTRAINT "property_labor_daily_metrics_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "property_labor_daily_metrics"
ADD CONSTRAINT "property_labor_daily_metrics_property_id_fkey"
FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "property_labor_daily_metrics"
ADD CONSTRAINT "property_labor_daily_metrics_property_scope_fkey"
FOREIGN KEY ("property_id", "organization_id") REFERENCES "properties"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_labor_daily_metrics"
ADD CONSTRAINT "organization_labor_daily_metrics_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Comments
COMMENT ON TABLE "property_devices" IS 'Property-bound kiosk or app devices used for property-scoped time capture.';
COMMENT ON TABLE "time_punches" IS 'Immutable source-of-truth clock events that preserve original punch history.';
COMMENT ON TABLE "time_shift_sessions" IS 'Normalized work sessions derived from punches for payroll and labor costing.';
COMMENT ON TABLE "shift_break_segments" IS 'Normalized break segments attached to a shift session.';
COMMENT ON TABLE "time_adjustments" IS 'Audit trail of admin time edits without mutating raw punch history.';
COMMENT ON TABLE "overtime_policies" IS 'Historically versioned overtime rules at org default or property override scope.';
COMMENT ON TABLE "employee_pay_rates" IS 'Historical pay rates and overtime policy bindings for payroll reruns and exports.';
COMMENT ON TABLE "payroll_calendars" IS 'Payroll schedule definitions that properties can attach to over time.';
COMMENT ON TABLE "property_payroll_settings" IS 'Property-scoped payroll settings tying a property to a calendar and default labor rules.';
COMMENT ON TABLE "payroll_periods" IS 'Generated pay periods from payroll calendars for locked payroll windows.';
COMMENT ON TABLE "payroll_runs" IS 'One payroll calculation run for a pay period, allowing auditable reruns.';
COMMENT ON TABLE "payroll_run_employee_summaries" IS 'Employee-level payroll totals with frozen rate snapshots.';
COMMENT ON TABLE "payroll_run_property_breakdowns" IS 'Property-level payroll breakdowns within an org-wide employee summary.';
COMMENT ON TABLE "payroll_batches" IS 'Org-wide wrapper for pulling payroll across multiple property calendars.';
COMMENT ON TABLE "payroll_batch_runs" IS 'Join table linking consolidated payroll batches to individual payroll runs.';
COMMENT ON TABLE "property_labor_daily_metrics" IS 'Property-level daily labor rollups for dashboards and costing analytics.';
COMMENT ON TABLE "organization_labor_daily_metrics" IS 'Organization-level daily labor rollups for consolidated dashboards.';
