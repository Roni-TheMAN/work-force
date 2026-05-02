import { formatNumber } from "@/components/dashboard/dashboard-formatters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardShift } from "@/hooks/useOrganizationDashboard";

type SchedulingOverviewProps = {
  active: DashboardShift[];
  recent: DashboardShift[];
  review: DashboardShift[];
};

export function SchedulingOverview({ active, recent, review }: SchedulingOverviewProps) {
  const stats = [
    { label: "On shift now", value: formatNumber(active.length) },
    { label: "Logged today", value: formatNumber(recent.length) },
    { label: "Needs review", value: formatNumber(review.length) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Shift Overview</CardTitle>
        <CardDescription>Live time activity, today&apos;s recorded shifts, and review exceptions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {recent.slice(0, 3).map((shift) => (
            <div key={shift.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{shift.employee ?? "Open assignment"}</p>
                <p className="truncate text-sm text-muted-foreground">{shift.property}</p>
              </div>
              <p className="shrink-0 text-sm text-muted-foreground">
                {shift.start} - {shift.end}
              </p>
            </div>
          ))}
          {recent.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted px-4 py-6">
              <p className="text-sm font-medium text-foreground">No live shifts recorded today.</p>
              <p className="mt-1 text-sm text-muted-foreground">Clock-ins and manual shifts will appear here once recorded.</p>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
