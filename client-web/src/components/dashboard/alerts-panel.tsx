import { AlertTriangle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardAlert } from "@/hooks/useOrganizationDashboard";
import { cn } from "@/lib/utils";

type AlertsPanelProps = {
  alerts: DashboardAlert[];
};

function getAlertClasses(severity: DashboardAlert["severity"]) {
  if (severity === "critical") {
    return "border-destructive/20 bg-destructive-soft";
  }

  if (severity === "warning") {
    return "border-border bg-accent";
  }

  return "border-border bg-muted";
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Alerts</CardTitle>
        <CardDescription>Operational exceptions that need a fast decision.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted px-4 py-6">
            <p className="text-sm font-medium text-foreground">No live org-wide shift alerts right now.</p>
            <p className="mt-1 text-sm text-muted-foreground">Open, auto-closed, and edited shifts will surface here when they occur.</p>
          </div>
        ) : (
          alerts.slice(0, 3).map((alert) => (
            <div key={alert.id} className={cn("rounded-2xl border px-4 py-3", getAlertClasses(alert.severity))}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-background/80 p-2">
                  <AlertTriangle className="size-4 text-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{alert.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{alert.description}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {alert.property} · {alert.count} open items
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
