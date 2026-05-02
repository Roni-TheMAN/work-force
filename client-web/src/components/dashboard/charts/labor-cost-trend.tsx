import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartTooltip } from "@/components/dashboard/charts/chart-tooltip";
import { formatCurrency } from "@/components/dashboard/dashboard-formatters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardTrendPoint } from "@/hooks/useOrganizationDashboard";

type LaborCostTrendProps = {
  trend: DashboardTrendPoint[];
};

export function LaborCostTrend({ trend }: LaborCostTrendProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Labor Cost Trend</CardTitle>
        <CardDescription>Projected payroll movement over the current window.</CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trend} margin={{ top: 8, right: 0, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="labor-cost-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              tickFormatter={(value) => formatCurrency(Number(value))}
            />
            <Tooltip content={<ChartTooltip formatter={formatCurrency} />} />
            <Area
              type="monotone"
              dataKey="payroll"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#labor-cost-fill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
