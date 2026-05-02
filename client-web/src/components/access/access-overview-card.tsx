import type { UserAccess } from "@/api/property";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AccessOverviewCardProps = {
  access: UserAccess | undefined;
  isLoading: boolean;
};

export function AccessOverviewCard({ access, isLoading }: AccessOverviewCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Access Overview</CardTitle>
        <CardDescription>Review the selected user’s current role, permission keys, and property scope.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading access details...</p>
        ) : access ? (
          <>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Role</p>
              <p className="mt-2 text-base font-semibold text-foreground">{access.role.name}</p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Permissions</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {access.permissions.map((permission) => (
                  <Badge key={permission} variant="secondary">
                    {permission}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Assigned properties</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {access.properties.length > 0 ? (
                  access.properties.map((property) => (
                    <Badge key={property.id} variant="outline">
                      {property.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No property restrictions assigned.</span>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Select a user to inspect current access.</p>
        )}
      </CardContent>
    </Card>
  );
}
