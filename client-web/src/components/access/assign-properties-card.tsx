import { useEffect, useState } from "react";

import type { UserAccess } from "@/api/property";
import { useAssignUserToProperties } from "@/hooks/useProperty";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AssignPropertiesCardProps = {
  organizationId: string;
  userId: string | null;
  properties: Array<{
    id: string;
    name: string;
  }>;
  access: UserAccess | undefined;
  disabled: boolean;
};

export function AssignPropertiesCard({
  organizationId,
  userId,
  properties,
  access,
  disabled,
}: AssignPropertiesCardProps) {
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const assignProperties = useAssignUserToProperties(organizationId, userId ?? undefined);

  useEffect(() => {
    setSelectedPropertyIds(access?.properties.map((property) => property.id) ?? []);
  }, [access]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Assign Properties</CardTitle>
        <CardDescription>Choose which properties the selected user can access.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {userId ? (
          <>
            <div className="flex flex-wrap gap-2">
              {properties.map((property) => {
                const isSelected = selectedPropertyIds.includes(property.id);

                return (
                  <button
                    key={property.id}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      setSelectedPropertyIds((current) =>
                        current.includes(property.id)
                          ? current.filter((currentId) => currentId !== property.id)
                          : [...current, property.id]
                      )
                    }
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      isSelected
                        ? "border-primary/35 bg-primary text-primary-foreground ring-1 ring-primary/15 ring-inset"
                        : "border-border bg-background text-muted-foreground",
                      disabled && "cursor-not-allowed opacity-60"
                    )}
                  >
                    {property.name}
                  </button>
                );
              })}
            </div>

            {assignProperties.error ? <p className="text-sm text-destructive">{assignProperties.error.message}</p> : null}

            <Button
              type="button"
              disabled={disabled || assignProperties.isPending}
              onClick={() =>
                assignProperties.mutate({
                  organizationId,
                  userId,
                  propertyIds: selectedPropertyIds,
                })
              }
            >
              {assignProperties.isPending ? "Saving..." : "Save property access"}
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Select a user to edit property access.</p>
        )}
      </CardContent>
    </Card>
  );
}
