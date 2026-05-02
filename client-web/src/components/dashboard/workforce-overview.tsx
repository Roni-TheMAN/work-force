import { formatHours, formatNumber } from "@/components/dashboard/dashboard-formatters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type WorkforceOverviewProps = {
  activeEmployees: number;
  inactiveEmployees: number;
  totalTodayHours: number;
  activeProperties: number;
  propertyScopeName: string | null;
};

export function WorkforceOverview({
  activeEmployees,
  inactiveEmployees,
  totalTodayHours,
  activeProperties,
  propertyScopeName,
}: WorkforceOverviewProps) {
  const avgHoursPerEmployee = activeEmployees > 0 ? totalTodayHours / activeEmployees : 0;

  const stats = [
    { label: "Active employees", value: formatNumber(activeEmployees) },
    { label: "Avg hours / employee", value: formatHours(avgHoursPerEmployee) },
    { label: "Active properties", value: formatNumber(activeProperties) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Workforce Overview</CardTitle>
        <CardDescription>
          {propertyScopeName
            ? `Headcount balance and labor density for ${propertyScopeName}.`
            : "Headcount balance and labor density across the current operating scope."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {formatNumber(inactiveEmployees)} employees are currently inactive or off roster in this view.
        </p>
      </CardContent>
    </Card>
  );
}
