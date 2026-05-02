import { useEffect, useState } from "react";

import type { PropertyDashboardData } from "@/api/property";
import { getInitials } from "@/components/dashboard/dashboard-formatters";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PropertyAccessProps = {
  access: PropertyDashboardData["access"];
  isSaving: boolean;
  onSaveRole: (userId: string, roleId: string | null) => void;
};

export function PropertyAccess({ access, isSaving, onSaveRole }: PropertyAccessProps) {
  const [draftRoles, setDraftRoles] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraftRoles(
      Object.fromEntries(access.users.map((user) => [user.userId, user.role?.id ?? "no-access"]))
    );
  }, [access.users]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Access & roles</CardTitle>
        <CardDescription>Users listed here have direct access to this property through property-level roles.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {access.users.length > 0 ? (
          access.users.map((user) => {
            const currentValue = draftRoles[user.userId] ?? "no-access";
            const hasChanged = currentValue !== (user.role?.id ?? "no-access");
            const selectedRoleLabel =
              currentValue === "no-access"
                ? "No access"
                : access.availableRoles.find((role) => role.id === currentValue)?.displayName;

            return (
              <div
                key={user.id}
                className="grid gap-4 rounded-2xl border border-border bg-background px-4 py-4 md:grid-cols-[1fr_220px_auto]"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarImage src={user.avatarUrl ?? undefined} alt={user.fullName ?? user.email} />
                    <AvatarFallback>{getInitials(user.fullName ?? user.email)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">{user.fullName ?? user.email}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <Select
                  value={currentValue}
                  onValueChange={(value) =>
                    setDraftRoles((currentDraftRoles) => ({
                      ...currentDraftRoles,
                      [user.userId]: value ?? "no-access",
                    }))
                  }
                >
                  <SelectTrigger className="w-full bg-card">
                    <SelectValue placeholder="Select property role">{selectedRoleLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-access">No access</SelectItem>
                    {access.availableRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant={hasChanged ? "default" : "outline"}
                  disabled={!hasChanged || isSaving}
                  onClick={() => onSaveRole(user.userId, currentValue === "no-access" ? null : currentValue)}
                >
                  Save
                </Button>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-10 text-center">
            <p className="font-medium text-foreground">No direct property access assignments</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Property-specific user roles will appear once access is assigned.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
