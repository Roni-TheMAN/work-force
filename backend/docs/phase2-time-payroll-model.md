# Phase 2 Time and Payroll Model

## Design goals

This Phase 2 extension keeps the Phase 1 tenant model intact:

- `organizations` remains the tenant root.
- `properties` remain organization-scoped locations.
- `employees` remain organization-scoped workforce records.
- `employee_property_assignments` remains the source of truth for where an employee may work.
- `property_user_roles` remains software access, not workforce assignment.
- Billing and entitlements stay organization-level.

No Phase 1 tables were removed or renamed. The migration is additive.

## Relationship model

### Time capture

- `property_devices` binds a kiosk or app device to one property.
- `time_punches` is the immutable audit log of clock events.
- `time_shift_sessions` is the normalized work-session layer derived from punches.
- `shift_break_segments` stores structured breaks inside a shift session.
- `time_adjustments` stores before/after snapshots for admin edits without mutating the raw punch stream.

Why it is modeled this way:

- Raw punches stay auditable and replayable.
- Payroll and labor costing can operate on normalized sessions instead of ad hoc punch pairing.
- Admin edits preserve original evidence and add an explicit audit trail.

### Labor rules and historical compensation

- `overtime_policies` stores org-default or property-override overtime rules with effective windows.
- `employee_pay_rates` stores historical pay rates with effective windows and the overtime policy used for that rate.

Why it is modeled this way:

- Overtime rules are data-driven instead of hardcoded in app code.
- Wage history is preserved for payroll reruns, corrections, and exports.
- Property-specific overrides are supported without duplicating employee rows.

### Payroll structure

- `payroll_calendars` defines payroll schedules.
- `property_payroll_settings` attaches a property to a payroll calendar and default overtime behavior over time.
- `payroll_periods` stores generated period windows per calendar.
- `payroll_runs` stores one calculation run for a payroll period.
- `payroll_run_employee_summaries` stores org-level employee totals for a run.
- `payroll_run_property_breakdowns` stores per-property breakdowns inside each employee summary.
- `payroll_batches` and `payroll_batch_runs` support consolidated org-wide pulls when multiple properties use different calendars.

Why it is modeled this way:

- Properties can follow different payroll calendars without breaking org-wide payroll visibility.
- Payroll can be reviewed at both org and property scope from the same run data.
- Runs are auditable and rerunnable instead of overwriting one mutable payroll result.

### Analytics and rollups

- `property_labor_daily_metrics` stores property-level daily labor rollups.
- `organization_labor_daily_metrics` stores org-level daily labor rollups.

Why it is modeled this way:

- Dashboard reads do not need to recalculate from raw punches every time.
- Property-local dashboards and org-wide dashboards can both read pre-aggregated data.

## Tenant-safety choices

The migration adds composite scope keys on existing Phase 1 tables:

- `properties (id, organization_id)`
- `employees (id, organization_id)`

These were added only to support stronger composite foreign keys from the new Phase 2 tables. That lets the database enforce more of the required guard flow directly:

1. Org scope
2. Property scope
3. Employee scope
4. Employee-property assignment scope when work is property-specific

## Important implementation boundaries

- Employees are still organization-scoped and are never duplicated per property.
- Property-specific work eligibility still comes from `employee_property_assignments`.
- Property payroll settings do not move payroll ownership or billing ownership down to the property level.
- Historical and audit-heavy records use restrictive foreign keys so operational deletes do not silently damage payroll history.

