import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartTooltip } from "@/components/dashboard/charts/chart-tooltip";
import { formatCurrency, formatHours, formatNumber } from "@/components/dashboard/dashboard-formatters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DashboardAnalyticsTab, DashboardBreakdown, DashboardTrendPoint } from "@/hooks/useOrganizationDashboard";

type AnalyticsTabsProps = {
  value: DashboardAnalyticsTab;
  onValueChange: (value: DashboardAnalyticsTab) => void;
  trend: DashboardTrendPoint[];
  breakdown: DashboardBreakdown[];
  payrollEnabled?: boolean;
};

export function AnalyticsTabs({ value, onValueChange, trend, breakdown, payrollEnabled = true }: AnalyticsTabsProps) {
  const totalHours = breakdown.reduce((sum, item) => sum + item.hours, 0);
  const totalPayroll = breakdown.reduce((sum, item) => sum + item.payroll, 0);
  const totalEmployees = breakdown.reduce((sum, item) => sum + item.employees, 0);

  return (
    <Card>
      <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-lg font-semibold">Analytics</CardTitle>
          <CardDescription>Focus on one dataset at a time without stacking duplicate views.</CardDescription>
        </div>
        <Tabs value={value} onValueChange={(nextValue) => onValueChange(nextValue as DashboardAnalyticsTab)}>
          <TabsList>
            <TabsTrigger value="hours">Hours</TabsTrigger>
            {payrollEnabled ? <TabsTrigger value="payroll">Payroll</TabsTrigger> : null}
            <TabsTrigger value="employees">Employees</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <Tabs value={value}>
          <TabsContent value="hours" className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
            <div className="h-72 rounded-2xl border border-border bg-background p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 8, right: 0, left: -14, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    tickFormatter={(next) => formatHours(Number(next))}
                  />
                  <Tooltip content={<ChartTooltip formatter={formatHours} />} />
                  <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-sm text-muted-foreground">Total hours</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{formatHours(totalHours)}</p>
              </div>
              {[...breakdown]
                .sort((left, right) => right.hours - left.hours)
                .slice(0, 3)
                .map((item) => (
                  <div key={item.name} className="rounded-2xl border border-border bg-background p-4">
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{formatHours(item.hours)} scheduled this period</p>
                  </div>
                ))}
            </div>
          </TabsContent>

          {payrollEnabled ? (
            <TabsContent value="payroll" className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
              <div className="h-72 rounded-2xl border border-border bg-background p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={breakdown} layout="vertical" margin={{ top: 8, right: 0, left: 12, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      tickFormatter={(next) => formatCurrency(Number(next))}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      width={96}
                    />
                    <Tooltip content={<ChartTooltip formatter={formatCurrency} />} />
                    <Bar dataKey="payroll" fill="hsl(var(--primary))" radius={[0, 10, 10, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-sm text-muted-foreground">Projected payroll</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{formatCurrency(totalPayroll)}</p>
                </div>
                {[...breakdown]
                  .sort((left, right) => right.payroll - left.payroll)
                  .slice(0, 3)
                  .map((item) => (
                    <div key={item.name} className="rounded-2xl border border-border bg-background p-4">
                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{formatCurrency(item.payroll)} projected in range</p>
                    </div>
                  ))}
              </div>
            </TabsContent>
          ) : null}

          <TabsContent value="employees" className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">Total employees</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{formatNumber(totalEmployees)}</p>
            </div>
            <div className="space-y-4 rounded-2xl border border-border bg-background p-4">
              {breakdown.map((item) => {
                const width = totalEmployees > 0 ? (item.employees / totalEmployees) * 100 : 0;

                return (
                  <div key={item.name} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{formatNumber(item.employees)}</p>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
