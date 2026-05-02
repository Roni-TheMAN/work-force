import { getInitials } from "@/components/dashboard/dashboard-formatters";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDashboardRole, type DashboardUser } from "@/hooks/useOrganizationDashboard";

type UserAccessProps = {
  users: DashboardUser[];
};

export function UserAccess({ users }: UserAccessProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">User Access</CardTitle>
        <CardDescription>Recent org members and permission holders.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {users.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted px-4 py-6">
            <p className="text-sm font-medium text-foreground">Org user membership data is unavailable here.</p>
            <p className="mt-1 text-sm text-muted-foreground">User access details require organization user management permission.</p>
          </div>
        ) : (
          users.slice(0, 3).map((user) => (
            <div key={user.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3">
              <Avatar className="size-10">
                <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                <p className="truncate text-sm text-muted-foreground">{user.email}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{formatDashboardRole(user.role)}</p>
                <p className="text-sm text-muted-foreground">{user.joinedAtLabel}</p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
