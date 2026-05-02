import type { PropertyShiftExceptionFlags, PropertyShiftPayrollImpact } from "@/api/property";
import { Badge } from "@/components/ui/badge";

export function ShiftFlagBadges({
  flags,
  lockedLabel = "finalized payroll",
}: {
  flags: PropertyShiftExceptionFlags;
  lockedLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {flags.manual ? <Badge variant="outline">manual</Badge> : null}
      {flags.edited ? <Badge variant="secondary">edited</Badge> : null}
      {flags.autoClosed ? <Badge variant="secondary">auto-closed</Badge> : null}
      {flags.locked ? <Badge variant="secondary">{lockedLabel}</Badge> : null}
    </div>
  );
}

export function buildPayrollImpactLabel(payrollImpact: PropertyShiftPayrollImpact) {
  if (payrollImpact.locked) {
    return payrollImpact.payrollRunVersion
      ? `Locked by finalized payroll run v${payrollImpact.payrollRunVersion}.`
      : "Locked by finalized payroll.";
  }

  if (payrollImpact.payrollRunStatus) {
    return payrollImpact.payrollRunVersion
      ? `Included in ${payrollImpact.payrollRunStatus} payroll run v${payrollImpact.payrollRunVersion}.`
      : `Included in ${payrollImpact.payrollRunStatus} payroll review.`;
  }

  return "Not included in a payroll run yet.";
}
