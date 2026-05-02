import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { ChartTooltip } from "@/components/dashboard/charts/chart-tooltip";
import { formatHours, formatNumber } from "@/components/dashboard/dashboard-formatters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardBreakdown } from "@/hooks/useOrganizationDashboard";

const chartPalette = [
  "hsl(var(--primary))",
  "hsl(var(--primary) / 0.82)",
  "hsl(var(--primary) / 0.68)",
  "hsl(var(--primary) / 0.54)",
  "hsl(var(--primary) / 0.4)",
];

type PropertyDistributionChartProps = {
  breakdown: DashboardBreakdown[];
};

export function PropertyDistributionChart({ breakdown }: PropertyDistributionChartProps) {
  const topItems = [...breakdown].sort((left, right) => right.employees - left.employees).slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Property Distribution</CardTitle>
        <CardDescription>Headcount mix across the selected properties.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<ChartTooltip formatter={formatNumber} />} />
              <Pie
                data={breakdown}
                dataKey="employees"
                nameKey="name"
                innerRadius={58}
                outerRadius={82}
                paddingAngle={3}
              >
                {breakdown.map((item, index) => (
                  <Cell key={item.name} fill={chartPalette[index % chartPalette.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3">
          {topItems.map((item, index) => (
            <div key={item.name} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                <p className="truncate text-sm text-muted-foreground">{formatHours(item.hours)} in the current range</p>
              </div>
              <div
                className="size-3 rounded-full"
                style={{ backgroundColor: chartPalette[index % chartPalette.length] }}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
