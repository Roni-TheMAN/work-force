import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { formatDelta, formatValue } from "@/components/dashboard/dashboard-formatters";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { DashboardKpi } from "@/hooks/useOrganizationDashboard";
import { cn } from "@/lib/utils";

type KpiCardsProps = {
  kpis: DashboardKpi[];
};

export function KpiCards({ kpis }: KpiCardsProps) {
  return (
    <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        const showDelta = typeof kpi.delta === "number";
        const isPositive = (kpi.delta ?? 0) >= 0;

        return (
          <Card key={kpi.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-0">
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              {showDelta ? (
                <div
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium",
                    isPositive ? "bg-primary-soft text-foreground" : "bg-destructive-soft text-destructive",
                  )}
                >
                  {isPositive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                  <span>{formatDelta(kpi.delta ?? 0)}</span>
                </div>
              ) : (
                <div className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-sm font-medium text-muted-foreground">
                  Live
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {formatValue(kpi.value, kpi.variant)}
              </p>
              <p className="text-sm text-muted-foreground">{kpi.helper}</p>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
