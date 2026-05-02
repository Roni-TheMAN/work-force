import { useEffect, useMemo, useState } from "react";

import { type EmployeePinMode, type OrganizationEmployee } from "@/api/employee";
import { formatNumber } from "@/components/dashboard/dashboard-formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAddEmployeePropertyAssignment,
  useArchiveEmployee,
  useCreatePropertyEmployee,
  useDeleteEmployee,
  useOrganizationEmployees,
  useRemoveEmployeePropertyAssignment,
  useResetEmployeePin,
  useRevealEmployeePin,
  useUpdateEmployeePropertyAssignment,
} from "@/hooks/useEmployee";
import { useOrganizationPermissions, useOrganizationRoles } from "@/hooks/useOrg";
import { usePropertyPermissions } from "@/hooks/useProperty";
import { PERMISSIONS, canAccess } from "@/lib/permissions";

type OrganizationEmployeesPanelProps = {
  organizationId: string;
  properties: Array<{
    id: string;
    name: string;
  }>;
  selectedPropertyId: string | null;
};

type CreateEmployeeFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  employeeCode: string;
  propertyId: string;
  createLoginAccount: "no" | "yes";
  loginPassword: string;
  propertyRole: "manager" | "property_admin" | "scheduler" | "viewer";
  pinMode: EmployeePinMode;
  manualPin: string;
};

type PropertyRoleOption = {
  id: string;
  key: "manager" | "property_admin" | "scheduler" | "viewer";
  displayName: string;
};

function normalizePropertyRoleOption(role: { id: string; name: string }) : PropertyRoleOption | null {
  const normalizedName = role.name.trim().toLowerCase();

  if (normalizedName === "admin") {
    return {
      id: role.id,
      key: "property_admin",
      displayName: "Property admin",
    };
  }

  if (normalizedName === "manager") {
    return {
      id: role.id,
      key: "manager",
      displayName: "Manager",
    };
  }

  if (normalizedName === "scheduler") {
    return {
      id: role.id,
      key: "scheduler",
      displayName: "Scheduler",
    };
  }

  if (normalizedName === "viewer") {
    return {
      id: role.id,
      key: "viewer",
      displayName: "Viewer",
    };
  }

  return null;
}

function isActivePropertyAssignment(property: OrganizationEmployee["properties"][number]) {
  return !property.activeTo || new Date(property.activeTo).getTime() >= Date.now();
}

function canManageKioskPins(permissionKeys: string[] | undefined): boolean {
  const permissions = new Set(permissionKeys ?? []);

  return (
    permissions.has(PERMISSIONS.ORG_MANAGE) ||
    permissions.has(PERMISSIONS.PROPERTY_SCOPE_BYPASS) ||
    (permissions.has(PERMISSIONS.PROPERTY_WRITE) &&
      permissions.has(PERMISSIONS.USER_INVITE) &&
      permissions.has(PERMISSIONS.USER_MANAGE))
  );
}

function PinRevealModal({
  isOpen,
  employeeName,
  pinValue,
  assignedAt,
  onClose,
}: {
  isOpen: boolean;
  employeeName: string | null;
  pinValue: string | null;
  assignedAt: string | null;
  onClose: () => void;
}) {
  if (!isOpen || !employeeName || !pinValue) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Kiosk PIN</CardTitle>
          <CardDescription>
            Save this PIN for {employeeName}. Plaintext PINs are only shown through explicit reveal actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-border bg-background px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Current PIN</p>
            <p className="mt-2 font-mono text-4xl font-semibold tracking-[0.28em] text-foreground">{pinValue}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {assignedAt ? `Last set ${new Date(assignedAt).toLocaleString()}` : "PIN timestamp unavailable"}
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(pinValue)}>
              Copy PIN
            </Button>
            <Button type="button" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ResetEmployeePinModal({
  isOpen,
  employee,
  pinMode,
  manualPin,
  onPinModeChange,
  onManualPinChange,
  onSubmit,
  onClose,
  isPending,
  errorMessage,
}: {
  isOpen: boolean;
  employee: OrganizationEmployee | null;
  pinMode: EmployeePinMode;
  manualPin: string;
  onPinModeChange: (nextPinMode: EmployeePinMode) => void;
  onManualPinChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  isPending: boolean;
  errorMessage: string | null;
}) {
  if (!isOpen || !employee) {
    return null;
  }

  const canSubmit = pinMode === "auto" || manualPin.trim().length === 6;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Reset kiosk PIN</CardTitle>
          <CardDescription>Rotate the current PIN for {employee.fullName} and reveal the new value once.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>PIN mode</Label>
            <Select value={pinMode} onValueChange={(value) => onPinModeChange((value as EmployeePinMode | null) ?? "auto")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-generate unique PIN</SelectItem>
                <SelectItem value="manual">Set manual PIN</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {pinMode === "manual" ? (
            <div className="space-y-2">
              <Label htmlFor="reset-manual-pin">Manual PIN</Label>
              <Input
                id="reset-manual-pin"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit PIN"
                value={manualPin}
                onChange={(event) => onManualPinChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
          ) : null}
          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={onSubmit} disabled={!canSubmit || isPending}>
              {isPending ? "Resetting..." : "Reset PIN"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateEmployeeModal({
  isOpen,
  onOpenChange,
  formState,
  onFormStateChange,
  onSubmit,
  isPending,
  properties,
  canAssignElevatedRoles,
  canManagePins,
  errorMessage,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  formState: CreateEmployeeFormState;
  onFormStateChange: (nextState: Partial<CreateEmployeeFormState>) => void;
  onSubmit: () => void;
  isPending: boolean;
  properties: Array<{ id: string; name: string }>;
  canAssignElevatedRoles: boolean;
  canManagePins: boolean;
  errorMessage: string | null;
}) {
  const selectedPropertyName = properties.find((property) => property.id === formState.propertyId)?.name;

  if (!isOpen) {
    return null;
  }

  const propertyRoleOptions = canAssignElevatedRoles
    ? [
        { value: "viewer", label: "Viewer" },
        { value: "scheduler", label: "Scheduler" },
        { value: "manager", label: "Manager" },
        { value: "property_admin", label: "Property admin" },
      ]
    : [
        { value: "viewer", label: "Viewer" },
        { value: "scheduler", label: "Scheduler" },
      ];

  const canSubmit =
    formState.firstName.trim().length > 0 &&
    formState.lastName.trim().length > 0 &&
    formState.propertyId.length > 0 &&
    (formState.pinMode !== "manual" || formState.manualPin.trim().length === 6) &&
    (formState.createLoginAccount === "no" ||
      (formState.email.trim().length > 0 && formState.loginPassword.trim().length > 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Add employee</CardTitle>
          <CardDescription>Create an organization employee and assign the record to one property.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="employee-first-name">First name</Label>
            <Input
              id="employee-first-name"
              value={formState.firstName}
              onChange={(event) => onFormStateChange({ firstName: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employee-last-name">Last name</Label>
            <Input
              id="employee-last-name"
              value={formState.lastName}
              onChange={(event) => onFormStateChange({ lastName: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employee-email">Email</Label>
            <Input
              id="employee-email"
              type="email"
              value={formState.email}
              onChange={(event) => onFormStateChange({ email: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employee-phone">Phone</Label>
            <Input
              id="employee-phone"
              value={formState.phone}
              onChange={(event) => onFormStateChange({ phone: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employee-code">Employee code</Label>
            <Input
              id="employee-code"
              value={formState.employeeCode}
              onChange={(event) => onFormStateChange({ employeeCode: event.target.value })}
            />
          </div>
          {canManagePins ? (
            <>
              <div className="space-y-2">
                <Label>PIN mode</Label>
                <Select
                  value={formState.pinMode}
                  onValueChange={(value) =>
                    onFormStateChange({ pinMode: (value as EmployeePinMode | null) ?? "auto", manualPin: "" })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-generate unique PIN</SelectItem>
                    <SelectItem value="manual">Set manual PIN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formState.pinMode === "manual" ? (
                <div className="space-y-2">
                  <Label htmlFor="employee-manual-pin">Manual PIN</Label>
                  <Input
                    id="employee-manual-pin"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6-digit PIN"
                    value={formState.manualPin}
                    onChange={(event) =>
                      onFormStateChange({ manualPin: event.target.value.replace(/\D/g, "").slice(0, 6) })
                    }
                  />
                </div>
              ) : null}
            </>
          ) : null}
          <div className="space-y-2">
            <Label>Assigned property</Label>
            <Select value={formState.propertyId} onValueChange={(value) => onFormStateChange({ propertyId: value ?? "" })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select property">{selectedPropertyName}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Create login account</Label>
            <Select
              value={formState.createLoginAccount}
              onValueChange={(value) =>
                onFormStateChange({ createLoginAccount: (value as "no" | "yes" | null) ?? "no" })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No login</SelectItem>
                <SelectItem value="yes">Create login</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {formState.createLoginAccount === "yes" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="employee-password">Login password</Label>
                <Input
                  id="employee-password"
                  type="password"
                  value={formState.loginPassword}
                  onChange={(event) => onFormStateChange({ loginPassword: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Property role</Label>
                <Select
                  value={formState.propertyRole}
                  onValueChange={(value) =>
                    onFormStateChange({
                      propertyRole: (value as CreateEmployeeFormState["propertyRole"] | null) ?? "viewer",
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {propertyRoleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}
          {errorMessage ? <p className="text-sm text-destructive sm:col-span-2">{errorMessage}</p> : null}
          <div className="sm:col-span-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={onSubmit} disabled={!canSubmit || isPending}>
              {isPending ? "Creating..." : "Create employee"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ManageAssignmentsModal({
  isOpen,
  employee,
  properties,
  roleOptions,
  onOpenChange,
  onAddAssignment,
  onUpdateAssignment,
  onRemoveAssignment,
  isAddingAssignment,
  isUpdatingAssignment,
  isRemovingAssignment,
  errorMessage,
}: {
  isOpen: boolean;
  employee: OrganizationEmployee | null;
  properties: Array<{ id: string; name: string }>;
  roleOptions: PropertyRoleOption[];
  onOpenChange: (open: boolean) => void;
  onAddAssignment: (values: { propertyId: string; roleId: string | null }) => void;
  onUpdateAssignment: (values: { propertyId: string; roleId?: string | null; isPrimary?: boolean }) => void;
  onRemoveAssignment: (propertyId: string) => void;
  isAddingAssignment: boolean;
  isUpdatingAssignment: boolean;
  isRemovingAssignment: boolean;
  errorMessage: string | null;
}) {
  const [nextPropertyId, setNextPropertyId] = useState("");
  const [nextRoleId, setNextRoleId] = useState<string>("");
  const [draftRoleIds, setDraftRoleIds] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!employee) {
      setNextPropertyId("");
      setNextRoleId("");
      setDraftRoleIds({});
      return;
    }

    setNextPropertyId("");
    setDraftRoleIds(
      Object.fromEntries(employee.properties.map((property) => [property.id, property.role?.id ?? ""]))
    );
    setNextRoleId(roleOptions[0]?.id ?? "");
  }, [employee, roleOptions]);

  if (!isOpen || !employee) {
    return null;
  }

  const activeProperties = employee.properties.filter(isActivePropertyAssignment);
  const previousProperties = employee.properties.filter((property) => !isActivePropertyAssignment(property));
  const assignedPropertyIds = new Set(activeProperties.map((property) => property.id));
  const availableProperties = properties.filter((property) => !assignedPropertyIds.has(property.id));
  const canAddAssignment = nextPropertyId.length > 0 && (!employee.hasLogin || nextRoleId.length > 0);
  const isBusy = isAddingAssignment || isUpdatingAssignment || isRemovingAssignment;
  const nextPropertyName = availableProperties.find((property) => property.id === nextPropertyId)?.name;
  const nextRoleLabel = roleOptions.find((role) => role.id === nextRoleId)?.displayName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle>Manage property assignments</CardTitle>
          <CardDescription>
            {employee.fullName} can be assigned to multiple properties without duplicating the employee record.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">{employee.fullName}</p>
              <p className="text-sm text-muted-foreground">
                {employee.hasLogin
                  ? "Property roles control what this employee can access after sign-in."
                  : "This employee has no login account, so property roles are not required."}
              </p>
            </div>

            {activeProperties.length > 0 ? (
              activeProperties.map((property) => {
                const draftRoleId = draftRoleIds[property.id] ?? "";
                const roleChanged = employee.hasLogin && draftRoleId !== (property.role?.id ?? "");

                return (
                  <div
                    key={property.id}
                    className="grid gap-4 rounded-2xl border border-border bg-background px-4 py-4 md:grid-cols-[1fr_220px_auto_auto]"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{property.name}</p>
                        {property.isPrimary ? <Badge variant="secondary">Primary</Badge> : null}
                        {property.role ? <Badge variant="outline">{property.role.displayName}</Badge> : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {property.activeFrom
                          ? `Assigned ${new Date(property.activeFrom).toLocaleDateString()}`
                          : "Assignment active"}
                      </p>
                    </div>
                    {employee.hasLogin ? (
                      <Select
                        value={draftRoleId}
                        onValueChange={(value) =>
                          setDraftRoleIds((currentDraftRoleIds) => ({
                            ...currentDraftRoleIds,
                            [property.id]: value ?? "",
                          }))
                        }
                    >
                      <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select property role">
                            {roleOptions.find((role) => role.id === draftRoleId)?.displayName}
                          </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                          {roleOptions.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex items-center text-sm text-muted-foreground">No login role</div>
                    )}
                    <Button
                      type="button"
                      variant={property.isPrimary ? "secondary" : "outline"}
                      disabled={property.isPrimary || isBusy}
                      onClick={() => onUpdateAssignment({ propertyId: property.id, isPrimary: true })}
                    >
                      {property.isPrimary ? "Primary" : "Make primary"}
                    </Button>
                    <div className="flex gap-2">
                      {employee.hasLogin ? (
                        <Button
                          type="button"
                          variant={roleChanged ? "default" : "outline"}
                          disabled={!roleChanged || isBusy}
                          onClick={() => onUpdateAssignment({ propertyId: property.id, roleId: draftRoleId })}
                        >
                          Save role
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={isBusy}
                        onClick={() => {
                          const confirmed = window.confirm(
                            `End ${employee.fullName}'s assignment at ${property.name}? Historical time and payroll records will be preserved, but future scheduling and clock-in for this property will be blocked.`
                          );

                          if (!confirmed) {
                            return;
                          }

                          onRemoveAssignment(property.id);
                        }}
                      >
                        End assignment
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-10 text-center">
                <p className="font-medium text-foreground">No property assignments yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add the first property below to place this employee into a location.
                </p>
              </div>
            )}
            {previousProperties.length > 0 ? (
              <div className="rounded-2xl border border-border bg-muted/30 px-4 py-4">
                <p className="text-sm font-medium text-foreground">Previous properties</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {previousProperties.map((property) => (
                    <Badge key={property.id} variant="outline">
                      {property.name}
                      {property.activeTo ? ` ended ${new Date(property.activeTo).toLocaleDateString()}` : ""}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border bg-background px-4 py-4">
            <div className="mb-4">
              <p className="text-sm font-medium text-foreground">Add another property</p>
              <p className="text-sm text-muted-foreground">
                Assign this employee to an additional property and set the login role if needed.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_220px_auto]">
              <Select value={nextPropertyId} onValueChange={(value) => setNextPropertyId(value ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select property">{nextPropertyName}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableProperties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {employee.hasLogin ? (
                <Select value={nextRoleId} onValueChange={(value) => setNextRoleId(value ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role">{nextRoleLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center text-sm text-muted-foreground">Role not needed</div>
              )}
              <Button
                type="button"
                disabled={!canAddAssignment || isBusy || availableProperties.length === 0}
                onClick={() =>
                  onAddAssignment({
                    propertyId: nextPropertyId,
                    roleId: employee.hasLogin ? nextRoleId : null,
                  })
                }
              >
                {isAddingAssignment ? "Adding..." : "Add assignment"}
              </Button>
            </div>
            {availableProperties.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">This employee is already assigned to every property.</p>
            ) : null}
          </div>

          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isBusy}>
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmployeesTable({
  employees,
  selectedPropertyId,
  canManageAssignments,
  canManagePins,
  canDeleteEmployees,
  onManageAssignments,
  onArchiveEmployee,
  onDeleteEmployee,
  onRevealPin,
  onResetPin,
  archivePendingEmployeeId,
  deletePendingEmployeeId,
  revealPinPendingEmployeeId,
  resetPinPendingEmployeeId,
}: {
  employees: OrganizationEmployee[];
  selectedPropertyId: string | null;
  canManageAssignments: boolean;
  canManagePins: boolean;
  canDeleteEmployees: boolean;
  onManageAssignments: (employee: OrganizationEmployee) => void;
  onArchiveEmployee: (employee: OrganizationEmployee) => void;
  onDeleteEmployee: (employee: OrganizationEmployee) => void;
  onRevealPin: (employee: OrganizationEmployee) => void;
  onResetPin: (employee: OrganizationEmployee) => void;
  archivePendingEmployeeId: string | null;
  deletePendingEmployeeId: string | null;
  revealPinPendingEmployeeId: string | null;
  resetPinPendingEmployeeId: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee roster</CardTitle>
        <CardDescription>
          {selectedPropertyId
            ? "Employees assigned to the selected property."
            : "Organization employees with their property assignments."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {employees.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Kiosk PIN</TableHead>
                <TableHead>Assigned properties</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{employee.fullName}</p>
                      <p className="text-sm text-muted-foreground">
                        {employee.employeeCode ?? employee.email ?? "No secondary identifier"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{employee.employmentStatus}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={employee.hasLogin ? "secondary" : "outline"}>
                      {employee.hasLogin ? "Enabled" : "No login"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={employee.kioskPinConfigured ? "secondary" : "outline"}>
                        {employee.kioskPinConfigured ? "Configured" : "Missing"}
                      </Badge>
                      {employee.kioskPinLastSetAt ? (
                        <span className="text-xs text-muted-foreground">
                          {new Date(employee.kioskPinLastSetAt).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {employee.properties.filter(isActivePropertyAssignment).map((property) => (
                        <Badge key={property.id} variant={property.isPrimary ? "secondary" : "outline"}>
                          {property.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!canManageAssignments}
                        onClick={() => onManageAssignments(employee)}
                      >
                        Manage assignments
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!canManageAssignments || employee.employmentStatus.toLowerCase() === "archived" || archivePendingEmployeeId === employee.id}
                        onClick={() => onArchiveEmployee(employee)}
                      >
                        {archivePendingEmployeeId === employee.id ? "Archiving..." : "Archive"}
                      </Button>
                      {canDeleteEmployees ? (
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={!canManageAssignments || deletePendingEmployeeId === employee.id}
                          onClick={() => onDeleteEmployee(employee)}
                        >
                          {deletePendingEmployeeId === employee.id ? "Deleting..." : "Delete"}
                        </Button>
                      ) : null}
                      {canManagePins ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={revealPinPendingEmployeeId === employee.id}
                            onClick={() => onRevealPin(employee)}
                          >
                            {revealPinPendingEmployeeId === employee.id ? "Revealing..." : "Reveal PIN"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={resetPinPendingEmployeeId === employee.id}
                            onClick={() => onResetPin(employee)}
                          >
                            {resetPinPendingEmployeeId === employee.id ? "Resetting..." : "Reset PIN"}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-10 text-center">
            <p className="font-medium text-foreground">No employees found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add the first employee for this organization to start assigning staff to properties.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function OrganizationEmployeesPanel({
  organizationId,
  properties,
  selectedPropertyId,
}: OrganizationEmployeesPanelProps) {
  const { data: permissionSnapshot } = useOrganizationPermissions(organizationId);
  const { data: propertyPermissionSnapshot } = usePropertyPermissions(selectedPropertyId ?? undefined);
  const { data: roleOptionsData = [] } = useOrganizationRoles(organizationId);
  const { data: employees = [], isLoading } = useOrganizationEmployees(organizationId, selectedPropertyId);
  const createEmployee = useCreatePropertyEmployee(organizationId, selectedPropertyId);
  const addAssignment = useAddEmployeePropertyAssignment();
  const updateAssignment = useUpdateEmployeePropertyAssignment();
  const removeAssignment = useRemoveEmployeePropertyAssignment();
  const archiveEmployee = useArchiveEmployee();
  const deleteEmployee = useDeleteEmployee();
  const revealPinMutation = useRevealEmployeePin();
  const resetPinMutation = useResetEmployeePin();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assignmentEmployeeId, setAssignmentEmployeeId] = useState<string | null>(null);
  const [resetPinEmployeeId, setResetPinEmployeeId] = useState<string | null>(null);
  const [pinRevealState, setPinRevealState] = useState<{
    assignedAt: string | null;
    employeeName: string;
    pinValue: string;
  } | null>(null);
  const [resetPinMode, setResetPinMode] = useState<EmployeePinMode>("auto");
  const [resetManualPin, setResetManualPin] = useState("");

  const defaultPropertyId = selectedPropertyId ?? properties[0]?.id ?? "";
  const [formState, setFormState] = useState<CreateEmployeeFormState>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    employeeCode: "",
    propertyId: defaultPropertyId,
    createLoginAccount: "no",
    loginPassword: "",
    propertyRole: "viewer",
    pinMode: "auto",
    manualPin: "",
  });

  useEffect(() => {
    setFormState((currentState) => ({
      ...currentState,
      propertyId: currentState.propertyId || defaultPropertyId,
    }));
  }, [defaultPropertyId]);

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((employee) => employee.employmentStatus.toLowerCase() === "active").length;
  const employeesWithLogin = employees.filter((employee) => employee.hasLogin).length;
  const configuredPins = employees.filter((employee) => employee.kioskPinConfigured).length;
  const canCreateEmployee = selectedPropertyId
    ? Boolean(propertyPermissionSnapshot?.canCreateEmployees)
    : canAccess(permissionSnapshot, PERMISSIONS.EMPLOYEE_WRITE);
  const canManageAssignments = canCreateEmployee;
  const canManageEmployeePins = canManageKioskPins(permissionSnapshot?.permissions);
  const canAssignElevatedRoles = selectedPropertyId
    ? Boolean(propertyPermissionSnapshot?.canAssignElevatedRoles)
    : ["Owner", "Admin"].includes(permissionSnapshot?.organizationRole ?? "");
  const canDeleteEmployees = ["Owner", "Admin"].includes(permissionSnapshot?.organizationRole ?? "");

  const currentPropertyName = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId)?.name ?? null,
    [properties, selectedPropertyId]
  );

  const selectedEmployee = employees.find((employee) => employee.id === assignmentEmployeeId) ?? null;
  const resetPinEmployee = employees.find((employee) => employee.id === resetPinEmployeeId) ?? null;

  const propertyRoleOptions = useMemo(() => {
    const normalizedOptions = roleOptionsData
      .map((role) => normalizePropertyRoleOption({ id: role.id, name: role.name }))
      .filter((role): role is PropertyRoleOption => role !== null);

    if (canAssignElevatedRoles) {
      return normalizedOptions;
    }

    return normalizedOptions.filter((role) => role.key === "viewer" || role.key === "scheduler");
  }, [canAssignElevatedRoles, roleOptionsData]);

  const resetForm = () => {
    setFormState({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      employeeCode: "",
      propertyId: defaultPropertyId,
      createLoginAccount: "no",
      loginPassword: "",
      propertyRole: "viewer",
      pinMode: "auto",
      manualPin: "",
    });
  };

  const assignmentErrorMessage =
    addAssignment.error?.message ??
    updateAssignment.error?.message ??
    removeAssignment.error?.message ??
    archiveEmployee.error?.message ??
    deleteEmployee.error?.message ??
    null;

  return (
    <section className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total employees</CardDescription>
            <CardTitle className="text-2xl font-semibold tracking-tight">{formatNumber(totalEmployees)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Active employees</CardDescription>
            <CardTitle className="text-2xl font-semibold tracking-tight">{formatNumber(activeEmployees)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Employee logins</CardDescription>
            <CardTitle className="text-2xl font-semibold tracking-tight">{formatNumber(employeesWithLogin)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Kiosk PINs configured</CardDescription>
            <CardTitle className="text-2xl font-semibold tracking-tight">{formatNumber(configuredPins)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Employee management</CardTitle>
            <CardDescription>
              {currentPropertyName
                ? `Employees are filtered to ${currentPropertyName}. New employees will be assigned there by default.`
                : "Select a property to prefill assignment, or choose one inside the add employee form."}
            </CardDescription>
          </div>
          <Button type="button" onClick={() => setIsModalOpen(true)} disabled={!canCreateEmployee || properties.length === 0}>
            Add employee
          </Button>
        </CardHeader>
        {!canCreateEmployee ? (
          <CardContent>
            <p className="text-sm text-muted-foreground">You do not have the `employee.write` permission.</p>
          </CardContent>
        ) : null}
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : (
        <EmployeesTable
          employees={employees}
          selectedPropertyId={selectedPropertyId}
          canManageAssignments={canManageAssignments}
          canManagePins={canManageEmployeePins}
          canDeleteEmployees={canDeleteEmployees}
          onManageAssignments={(employee) => setAssignmentEmployeeId(employee.id)}
          onArchiveEmployee={(employee) => {
            const confirmed = window.confirm(
              `Archive ${employee.fullName}? This will end active property assignments, disable kiosk PIN login, and preserve historical records.`
            );

            if (!confirmed) {
              return;
            }

            archiveEmployee.mutate(
              {
                organizationId,
                employeeId: employee.id,
              },
              {
                onError: (error) => {
                  window.alert(error instanceof Error ? error.message : "This employee could not be archived.");
                },
              }
            );
          }}
          onDeleteEmployee={(employee) => {
            const confirmed = window.confirm(
              `Delete ${employee.fullName}? This only succeeds if the employee has no time, schedule, payroll, or PIN history.`
            );

            if (!confirmed) {
              return;
            }

            deleteEmployee.mutate(
              {
                organizationId,
                employeeId: employee.id,
              },
              {
                onError: (error) => {
                  window.alert(
                    error instanceof Error
                      ? error.message
                      : "This employee could not be deleted. Archive the employee instead."
                  );
                },
              }
            );
          }}
          onRevealPin={(employee) =>
            revealPinMutation.mutate(
              {
                organizationId,
                employeeId: employee.id,
              },
              {
                onSuccess: (pinReveal) => {
                  setPinRevealState({
                    employeeName: employee.fullName,
                    pinValue: pinReveal.value,
                    assignedAt: pinReveal.assignedAt,
                  });
                },
              }
            )
          }
          onResetPin={(employee) => {
            setResetPinEmployeeId(employee.id);
            setResetPinMode("auto");
            setResetManualPin("");
          }}
          archivePendingEmployeeId={archiveEmployee.isPending ? (archiveEmployee.variables?.employeeId ?? null) : null}
          deletePendingEmployeeId={deleteEmployee.isPending ? (deleteEmployee.variables?.employeeId ?? null) : null}
          revealPinPendingEmployeeId={
            revealPinMutation.isPending ? (revealPinMutation.variables?.employeeId ?? null) : null
          }
          resetPinPendingEmployeeId={
            resetPinMutation.isPending ? (resetPinMutation.variables?.employeeId ?? null) : null
          }
        />
      )}

      <CreateEmployeeModal
        isOpen={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);

          if (!open) {
            resetForm();
          }
        }}
        formState={formState}
        onFormStateChange={(nextState) => setFormState((currentState) => ({ ...currentState, ...nextState }))}
        onSubmit={() =>
          createEmployee.mutate(
            {
              propertyId: formState.propertyId,
              firstName: formState.firstName.trim(),
              lastName: formState.lastName.trim(),
              email: formState.email.trim() || null,
              phone: formState.phone.trim() || null,
              employeeCode: formState.employeeCode.trim() || null,
              createLoginAccount: formState.createLoginAccount === "yes",
              loginPassword: formState.createLoginAccount === "yes" ? formState.loginPassword.trim() : null,
              propertyRole: formState.propertyRole,
              pinMode: canManageEmployeePins ? formState.pinMode : "auto",
              manualPin: canManageEmployeePins && formState.pinMode === "manual" ? formState.manualPin.trim() : null,
            },
            {
              onSuccess: (result) => {
                if (result.pinReveal) {
                  setPinRevealState({
                    employeeName: `${result.employee.firstName} ${result.employee.lastName}`.trim(),
                    pinValue: result.pinReveal.value,
                    assignedAt: result.pinReveal.assignedAt,
                  });
                }
                resetForm();
                setIsModalOpen(false);
              },
            }
          )
        }
        isPending={createEmployee.isPending}
        properties={properties}
        canAssignElevatedRoles={canAssignElevatedRoles}
        canManagePins={canManageEmployeePins}
        errorMessage={createEmployee.error?.message ?? null}
      />

      <ManageAssignmentsModal
        isOpen={Boolean(selectedEmployee)}
        employee={selectedEmployee}
        properties={properties}
        roleOptions={propertyRoleOptions}
        onOpenChange={(open) => {
          if (!open) {
            setAssignmentEmployeeId(null);
          }
        }}
        onAddAssignment={({ propertyId, roleId }) =>
          selectedEmployee
            ? addAssignment.mutate({
                organizationId,
                employeeId: selectedEmployee.id,
                propertyId,
                roleId,
              })
            : undefined
        }
        onUpdateAssignment={({ propertyId, roleId, isPrimary }) =>
          selectedEmployee
            ? updateAssignment.mutate({
                organizationId,
                employeeId: selectedEmployee.id,
                propertyId,
                roleId,
                isPrimary,
              })
            : undefined
        }
        onRemoveAssignment={(propertyId) =>
          selectedEmployee
            ? removeAssignment.mutate({
                organizationId,
                employeeId: selectedEmployee.id,
                propertyId,
              })
            : undefined
        }
        isAddingAssignment={addAssignment.isPending}
        isUpdatingAssignment={updateAssignment.isPending}
        isRemovingAssignment={removeAssignment.isPending}
        errorMessage={assignmentErrorMessage}
      />

      <ResetEmployeePinModal
        isOpen={Boolean(resetPinEmployee)}
        employee={resetPinEmployee}
        pinMode={resetPinMode}
        manualPin={resetManualPin}
        onPinModeChange={setResetPinMode}
        onManualPinChange={setResetManualPin}
        onSubmit={() =>
          resetPinEmployee
            ? resetPinMutation.mutate(
                {
                  organizationId,
                  employeeId: resetPinEmployee.id,
                  pinMode: resetPinMode,
                  manualPin: resetPinMode === "manual" ? resetManualPin.trim() : null,
                },
                {
                  onSuccess: (pinReveal) => {
                    setPinRevealState({
                      employeeName: resetPinEmployee.fullName,
                      pinValue: pinReveal.value,
                      assignedAt: pinReveal.assignedAt,
                    });
                    setResetPinEmployeeId(null);
                    setResetPinMode("auto");
                    setResetManualPin("");
                  },
                }
              )
            : undefined
        }
        onClose={() => {
          setResetPinEmployeeId(null);
          setResetPinMode("auto");
          setResetManualPin("");
        }}
        isPending={resetPinMutation.isPending}
        errorMessage={resetPinMutation.error?.message ?? null}
      />

      <PinRevealModal
        isOpen={Boolean(pinRevealState)}
        employeeName={pinRevealState?.employeeName ?? null}
        pinValue={pinRevealState?.pinValue ?? null}
        assignedAt={pinRevealState?.assignedAt ?? null}
        onClose={() => setPinRevealState(null)}
      />
    </section>
  );
}
