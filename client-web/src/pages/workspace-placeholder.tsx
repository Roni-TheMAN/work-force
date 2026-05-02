import { Building2 } from "lucide-react";

import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type WorkspacePlaceholderProps = {
  title: string;
  description: string;
};

export function WorkspacePlaceholder({ title, description }: WorkspacePlaceholderProps) {
  return (
    <WorkspaceShell>
      {({ selectedOrganization, selectedPropertyId }) => {
        const selectedProperty =
          selectedOrganization.properties.find((property) => property.id === selectedPropertyId) ?? null;

        return (
          <div className="mx-auto max-w-[1400px] px-6 py-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="rounded-2xl border border-border bg-background p-6">
                    <div className="flex items-start gap-4">
                      <div className="rounded-2xl bg-primary-soft p-3">
                        <Building2 className="size-5 text-foreground" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-base font-semibold text-foreground">Section shell is active</p>
                        <p className="text-sm text-muted-foreground">
                          Navigation, organization context, and property switching are now wired for this area.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-3">
                    <div className="rounded-2xl border border-border bg-background p-6">
                      <p className="text-sm text-muted-foreground">Organization</p>
                      <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                        {selectedOrganization.name}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-background p-6">
                      <p className="text-sm text-muted-foreground">Property scope</p>
                      <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                        {selectedProperty?.name ?? "All properties"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-background p-6">
                      <p className="text-sm text-muted-foreground">Status</p>
                      <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">Ready</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      }}
    </WorkspaceShell>
  );
}
