import { ArrowUpRight, CalendarDays } from "lucide-react";
import { useNavigate } from "react-router-dom";

import type { OrganizationSchedulingSummary } from "@/api/org";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type OrganizationSchedulingSummaryProps = {
  compact?: boolean;
  errorMessage?: string | null;
  isLoading?: boolean;
  summary?: OrganizationSchedulingSummary;
};

function SchedulingSummarySkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48 rounded-xl" />
        <Skeleton className="h-4 w-64 rounded-xl" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-20 rounded-2xl" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: compact ? 3 : 5 }, (_, index) => (
            <Skeleton key={index} className="h-16 rounded-2xl" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function statusLabel(status: OrganizationSchedulingSummary["properties"][number]["status"]) {
  if (status === "not_started") {
    return "Not started";
  }

  return status === "published" ? "Published" : "Draft";
}

function statusVariant(
  status: OrganizationSchedulingSummary["properties"][number]["status"]
): "default" | "outline" | "secondary" {
  return status === "published" ? "default" : status === "draft" ? "secondary" : "outline";
}

export function OrganizationSchedulingSummaryPanel({
  compact = false,
  errorMessage,
  isLoading = false,
  summary,
}: OrganizationSchedulingSummaryProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return <SchedulingSummarySkeleton compact={compact} />;
  }

  if (errorMessage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Schedule Status</CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!summary) {
    return null;
  }

  const visibleProperties = compact ? summary.properties.slice(0, 4) : summary.properties;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Schedule Status</CardTitle>
        <CardDescription>Org-wide oversight for the current local week by property. Editing still happens inside each property workspace.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-background px-4 py-4">
            <p className="text-sm text-muted-foreground">Published properties</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{summary.summary.publishedProperties}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background px-4 py-4">
            <p className="text-sm text-muted-foreground">Unpublished properties</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{summary.summary.unpublishedProperties}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background px-4 py-4">
            <p className="text-sm text-muted-foreground">Scheduled shifts</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{summary.summary.scheduledShiftCount}</p>
          </div>
        </div>

        {visibleProperties.length > 0 ? (
          <div className="space-y-3">
            {visibleProperties.map((property) => (
              <button
                key={`${property.propertyId}:${property.weekStartDate}`}
                type="button"
                onClick={() => void navigate(`/dashboard/property/${encodeURIComponent(property.propertyId)}?section=schedule`)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background px-4 py-4 transition-colors duration-150 hover:bg-muted/40">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="truncate text-sm font-medium text-foreground">{property.propertyName}</p>
                      <Badge variant={statusVariant(property.status)}>{statusLabel(property.status)}</Badge>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      Week of {new Date(`${property.weekStartDate}T12:00:00.000Z`).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })} · {property.scheduledShiftCount} scheduled shifts
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
                    <CalendarDays className="size-4" />
                    <ArrowUpRight className="size-4" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">No property schedules are visible in this scope.</p>
            <p className="mt-1 text-sm text-muted-foreground">Once a property schedule is opened or published, it will appear here.</p>
          </div>
        )}

        {compact && summary.properties.length > visibleProperties.length ? (
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => void navigate("/dashboard?section=scheduling")}>
              Open scheduling overview
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
