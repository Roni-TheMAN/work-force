import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartTooltip } from "@/components/dashboard/charts/chart-tooltip";
import { formatHours } from "@/components/dashboard/dashboard-formatters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardTrendPoint } from "@/hooks/useOrganizationDashboard";

type HoursTrendChartProps = {
  trend: DashboardTrendPoint[];
};

export function HoursTrendChart({ trend }: HoursTrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Hours Trend</CardTitle>
        <CardDescription>Recent labor hours in the current scope.</CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend} margin={{ top: 8, right: 0, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              tickFormatter={(value) => formatHours(Number(value))}
            />
            <Tooltip content={<ChartTooltip formatter={formatHours} />} />
            <Line type="monotone" dataKey="hours" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
