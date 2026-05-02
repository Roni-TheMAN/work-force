import { useEffect, useState } from "react";

import { AccessOverviewCard } from "@/components/access/access-overview-card";
import { AssignPropertiesCard } from "@/components/access/assign-properties-card";
import { InviteUserModal } from "@/components/access/invite-user-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS, canAccess } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useOrganizationPermissions, useOrganizationUsers, useRemoveOrganizationUser } from "@/hooks/useOrg";
import { useUserAccess } from "@/hooks/useProperty";

function getInitials(name: string | null, email: string): string {
  if (!name?.trim()) {
    return email.slice(0, 2).toUpperCase();
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

type UsersManagementProps = {
  organizationId: string;
  properties: Array<{
    id: string;
    name: string;
  }>;
  canInviteUsers: boolean;
  canManageUsers: boolean;
};

export function UsersManagement({
  organizationId,
  properties,
  canInviteUsers,
  canManageUsers,
}: UsersManagementProps) {
  const { data: permissionSnapshot } = useOrganizationPermissions(organizationId);
  const canManageOrganization = canAccess(permissionSnapshot, PERMISSIONS.USER_MANAGE);
  const { data: organizationUsers = [], isLoading: isUsersLoading } = useOrganizationUsers(
    organizationId,
    canManageOrganization
  );
  const removeOrganizationUser = useRemoveOrganizationUser(organizationId);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { data: selectedUserAccess, isLoading: isAccessLoading } = useUserAccess(
    organizationId,
    selectedUserId ?? undefined
  );

  useEffect(() => {
    if (organizationUsers.length === 0) {
      setSelectedUserId(null);
      return;
    }

    setSelectedUserId((currentSelectedUserId) => {
      if (currentSelectedUserId && organizationUsers.some((user) => user.id === currentSelectedUserId)) {
        return currentSelectedUserId;
      }

      return organizationUsers[0]?.id ?? null;
    });
  }, [organizationUsers]);

  const selectedUser = organizationUsers.find((user) => user.id === selectedUserId) ?? null;
  const canInvite = canInviteUsers && canAccess(permissionSnapshot, PERMISSIONS.USER_INVITE);
  const canEditUsers = canManageUsers && canManageOrganization;
  const canAssignProperties =
    canManageUsers &&
    canManageOrganization &&
    canAccess(permissionSnapshot, PERMISSIONS.PROPERTY_WRITE);
  const canRemoveSelectedUser = canEditUsers && Boolean(selectedUser?.canRemove);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Organization Access</h2>
          <p className="text-sm text-muted-foreground">
            Invite teammates, review role permissions, and scope property access.
          </p>
        </div>
        <InviteUserModal organizationId={organizationId} disabled={!canInvite} />
      </div>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Members</CardTitle>
            <CardDescription>Live organization membership with invite status and current role.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isUsersLoading ? (
              <p className="text-sm text-muted-foreground">Loading organization users...</p>
            ) : organizationUsers.length > 0 ? (
              organizationUsers.map((user) => {
                const isSelected = user.id === selectedUserId;

                return (
                  <button
                    key={`${user.id}-${user.status}`}
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-4 rounded-2xl border border-border bg-background px-4 py-3 text-left transition-colors",
                      isSelected && "border-primary bg-primary-soft"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="size-10">
                        <AvatarImage src={user.avatarUrl ?? undefined} alt={user.fullName ?? user.email} />
                        <AvatarFallback>{getInitials(user.fullName, user.email)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{user.fullName ?? user.email}</p>
                        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="secondary">{user.role.name}</Badge>
                      <Badge variant={user.status === "active" ? "outline" : "ghost"}>{user.status}</Badge>
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No organization users found.</p>
            )}

            {!canInvite ? (
              <p className="text-sm text-muted-foreground">You do not have the `user.invite` permission.</p>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <AccessOverviewCard access={selectedUserAccess} isLoading={isAccessLoading} />
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Membership Controls</CardTitle>
              <CardDescription>Remove the selected user when the organization policy allows it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedUser ? (
                <>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{selectedUser.fullName ?? selectedUser.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedUser.canRemove
                        ? "This user can be removed from the organization."
                        : selectedUser.removeBlockedReason ?? "This user cannot be removed."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={!canRemoveSelectedUser || removeOrganizationUser.isPending}
                    onClick={() => {
                      if (!selectedUser.canRemove) {
                        return;
                      }

                      const confirmed = window.confirm(
                        `Remove ${selectedUser.fullName ?? selectedUser.email} from this organization?`
                      );

                      if (!confirmed) {
                        return;
                      }

                      removeOrganizationUser.mutate({
                        organizationId,
                        userId: selectedUser.id,
                      });
                    }}
                  >
                    {removeOrganizationUser.isPending ? "Removing..." : "Remove from organization"}
                  </Button>
                  {removeOrganizationUser.error ? (
                    <p className="text-sm text-destructive">{removeOrganizationUser.error.message}</p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Select a user to review removal controls.</p>
              )}
            </CardContent>
          </Card>
          <AssignPropertiesCard
            organizationId={organizationId}
            userId={selectedUser?.id ?? null}
            properties={properties}
            access={selectedUserAccess}
            disabled={!canEditUsers || !canAssignProperties}
          />
        </div>
      </section>
    </section>
  );
}
