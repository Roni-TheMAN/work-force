import { useEffect, useState } from "react";

import { useInviteUser, useOrganizationRoles } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type InviteUserModalProps = {
  organizationId: string;
  disabled: boolean;
};

export function InviteUserModal({ organizationId, disabled }: InviteUserModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string>("");
  const inviteUser = useInviteUser(organizationId);
  const { data: roles = [] } = useOrganizationRoles(organizationId, isOpen && !disabled);
  const selectedRoleName = roles.find((role) => role.id === roleId)?.name;

  useEffect(() => {
    if (!roleId && roles.length > 0) {
      setRoleId(roles[0].id);
    }
  }, [roleId, roles]);

  useEffect(() => {
    if (!inviteUser.isSuccess) {
      return;
    }

    setEmail("");
    setRoleId(roles[0]?.id ?? "");
    setIsOpen(false);
  }, [inviteUser.isSuccess, roles]);

  const canSubmit = !disabled && email.trim().length > 0 && roleId.length > 0 && !inviteUser.isPending;

  return (
    <>
      <Button type="button" onClick={() => setIsOpen(true)} disabled={disabled}>
        Invite user
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <Card className="w-full max-w-lg border-border/80 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Invite User</CardTitle>
              <CardDescription>Send an organization invite and assign the starting role.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.com"
                type="email"
                autoFocus
              />
              <Select value={roleId} onValueChange={(value) => setRoleId(value ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select role">{selectedRoleName}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {inviteUser.error ? (
                <p className="text-sm text-destructive">{inviteUser.error.message}</p>
              ) : null}

              <div className="flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} disabled={inviteUser.isPending}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!canSubmit}
                  onClick={() =>
                    inviteUser.mutate({
                      organizationId,
                      email: email.trim(),
                      roleId,
                    })
                  }
                >
                  {inviteUser.isPending ? "Sending..." : "Send invite"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
