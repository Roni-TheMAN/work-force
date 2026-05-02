import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardCoverageGap } from "@/hooks/useOrganizationDashboard";

type EmployeesMissingShiftsProps = {
  items: DashboardCoverageGap[];
};

export function EmployeesMissingShifts({ items }: EmployeesMissingShiftsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Employees Without Shifts</CardTitle>
        <CardDescription>Active employees with no recorded shifts in the current dashboard range.</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-2xl border border-border bg-muted px-4 py-6">
            <p className="text-sm font-medium text-foreground">No active employees are missing shifts in this view.</p>
            <p className="mt-1 text-sm text-muted-foreground">Everyone in scope has recorded time in the selected range.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.slice(0, 4).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {item.role} · {item.property}
                  </p>
                </div>
                <p className="shrink-0 text-sm text-muted-foreground">{item.lastShift}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
