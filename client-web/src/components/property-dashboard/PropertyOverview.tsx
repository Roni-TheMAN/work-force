import type { PropertyDashboardData } from "@/api/property";
import { formatHours, formatNumber } from "@/components/dashboard/dashboard-formatters";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PropertyOverviewProps = {
  overview: PropertyDashboardData["overview"];
  propertyName: string;
};

export function PropertyOverview({ overview, propertyName }: PropertyOverviewProps) {
  const totalAlerts = overview.alerts.reduce((sum, alert) => sum + alert.count, 0);

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Active employees</CardDescription>
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {formatNumber(overview.activeEmployees)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Hours today</CardDescription>
            <CardTitle className="text-2xl font-semibold tracking-tight">{formatHours(overview.hoursToday)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Open alerts</CardDescription>
            <CardTitle className="text-2xl font-semibold tracking-tight">{formatNumber(totalAlerts)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Property signal</CardTitle>
          <CardDescription>Live operating signal for {propertyName}, limited to this single location.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {overview.alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-4"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{alert.title}</p>
                <p className="text-sm text-muted-foreground">
                  {alert.count > 0 ? `${alert.count} items need attention` : "No active issues right now"}
                </p>
              </div>
              <Badge variant={alert.count > 0 ? "secondary" : "outline"}>{alert.severity}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
