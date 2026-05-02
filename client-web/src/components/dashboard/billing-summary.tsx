import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/components/dashboard/dashboard-formatters";
import type { DashboardBilling } from "@/hooks/useOrganizationDashboard";

type BillingSummaryProps = {
  billing: DashboardBilling;
};

function UsageBar({ value, limit }: { value: number; limit: number }) {
  const percent = limit > 0 ? Math.min(100, (value / limit) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          {value} / {limit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function BillingSummary({ billing }: BillingSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Billing Summary</CardTitle>
        <CardDescription>Plan posture and current capacity against org-level limits.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">Current plan</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground capitalize">{billing.plan}</p>
          <p className="mt-2 text-sm text-muted-foreground">{formatCurrency(billing.monthlySpend)} projected this cycle</p>
        </div>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Property usage</p>
            <UsageBar value={billing.propertyUsage} limit={billing.propertyLimit} />
          </div>
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Employee usage</p>
            <UsageBar value={billing.employeeUsage} limit={billing.employeeLimit} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
