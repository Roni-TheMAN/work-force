import { useEffect, useState } from "react";

import type { PropertyDashboardProperty, PropertyDashboardWorkforceMember } from "@/api/property";
import type { TimePunchType } from "@/api/time-tracking";
import { PropertyQrCode } from "@/components/property-dashboard/PropertyQrCode";
import { ShiftFlagBadges, buildPayrollImpactLabel } from "@/components/property-dashboard/property-shift-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCreatePropertyPairingToken,
  useDeletePropertyDeviceRecord,
  usePropertyDevices,
  usePropertyTimeShifts,
  useRecordClientPunch,
  useRegisterPropertyDevice,
  useRetirePropertyDevice,
} from "@/hooks/useTimeTracking";
import { PERMISSIONS } from "@/lib/permissions";

type PropertyClockProps = {
  currentUserId: string | null;
  effectivePermissions: string[];
  property: PropertyDashboardProperty;
  workforce: PropertyDashboardWorkforceMember[];
};

type DeviceType = "desktop" | "kiosk" | "mobile" | "other" | "tablet";
type DeviceListTab = "active" | "retired";

const defaultDeviceType: DeviceType = "kiosk";

function formatMinutes(minutes: number | null): string {
  if (minutes === null) {
    return "Open";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Open";
  }

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getShiftBadgeVariant(status: string) {
  if (status === "open") {
    return "default";
  }

  if (status === "edited" || status === "auto_closed") {
    return "secondary";
  }

  return "outline";
}

function getPunchActionLabel(punchType: TimePunchType) {
  switch (punchType) {
    case "clock_in":
      return "Clock in";
    case "clock_out":
      return "Clock out";
    case "break_start":
      return "Start break";
    case "break_end":
      return "End break";
  }
}

export function PropertyClock({ currentUserId, effectivePermissions, property, workforce }: PropertyClockProps) {
  const today = new Date();
  const businessDateTo = formatDateOnly(today);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 13);
  const businessDateFrom = formatDateOnly(startDate);

  const canManageAllEmployees =
    effectivePermissions.includes(PERMISSIONS.EMPLOYEE_WRITE) ||
    effectivePermissions.includes(PERMISSIONS.SCHEDULE_WRITE);
  const canRegisterDevices = effectivePermissions.includes(PERMISSIONS.PROPERTY_WRITE);
  const selfEmployee = workforce.find((employee) => employee.userId === currentUserId) ?? null;
  const selectableEmployees = canManageAllEmployees ? workforce : selfEmployee ? [selfEmployee] : [];
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(selfEmployee?.id ?? workforce[0]?.id ?? null);
  const [note, setNote] = useState("");
  const [breakType, setBreakType] = useState<"meal" | "other" | "rest">("meal");
  const [deviceName, setDeviceName] = useState("");
  const [deviceType, setDeviceType] = useState<DeviceType>(defaultDeviceType);
  const [latestDeviceToken, setLatestDeviceToken] = useState<string | null>(null);
  const [latestPairingToken, setLatestPairingToken] = useState<{
    expiresAt: string;
    qrValue: string;
    token: string;
  } | null>(null);
  const [isDeviceTokenVisible, setIsDeviceTokenVisible] = useState(false);
  const [isPairingSecretVisible, setIsPairingSecretVisible] = useState(false);
  const shiftsQuery = usePropertyTimeShifts(property.organizationId, property.id, {
    businessDateFrom,
    businessDateTo,
  });
  const devicesQuery = usePropertyDevices(property.id);
  const punchMutation = useRecordClientPunch(property.organizationId, property.id);
  const deviceMutation = useRegisterPropertyDevice(property.id);
  const pairingTokenMutation = useCreatePropertyPairingToken(property.id);
  const deleteDeviceRecordMutation = useDeletePropertyDeviceRecord(property.id);
  const retireDeviceMutation = useRetirePropertyDevice(property.id);
  const [deviceListTab, setDeviceListTab] = useState<DeviceListTab>("active");
  const [deviceAction, setDeviceAction] = useState<{
    deviceId: string;
    kind: "delete" | "retire";
  } | null>(null);

  useEffect(() => {
    const preferredEmployeeId =
      selectableEmployees.find((employee) => employee.id === selectedEmployeeId)?.id ??
      selfEmployee?.id ??
      selectableEmployees[0]?.id ??
      null;

    setSelectedEmployeeId(preferredEmployeeId);
  }, [selectedEmployeeId, selectableEmployees, selfEmployee]);

  const selectedEmployee = workforce.find((employee) => employee.id === selectedEmployeeId) ?? null;
  const shifts = shiftsQuery.data?.shifts ?? [];
  const devices = devicesQuery.data ?? [];
  const propertyEmployeeNames = new Map(workforce.map((employee) => [employee.id, employee.name]));
  const openShifts = shifts.filter((shift) => shift.status === "open" || shift.endedAt === null);
  const selectedEmployeeOpenShift = selectedEmployee
    ? openShifts.find((shift) => shift.employeeId === selectedEmployee.id) ?? null
    : null;
  const selectedEmployeeOpenBreak =
    selectedEmployeeOpenShift?.breaks.find((segment) => segment.endedAt === null) ?? null;
  const canSubmitForSelectedEmployee =
    Boolean(selectedEmployee) && (canManageAllEmployees || selectedEmployee?.userId === currentUserId);
  const sevenDayPayableMinutes = shifts.reduce((sum, shift) => sum + (shift.payableMinutes ?? 0), 0);
  const employeesWorkedCount = new Set(shifts.map((shift) => shift.employeeId)).size;
  const activeDevices = devices.filter((device) => device.status === "active");
  const retiredDevices = devices.filter((device) => device.status === "retired");
  const activeDevicesCount = activeDevices.length;
  const selectedEmployeeShiftFlags = selectedEmployeeOpenShift
    ? {
        autoClosed: selectedEmployeeOpenShift.status === "auto_closed",
        edited: selectedEmployeeOpenShift.status === "edited" || selectedEmployeeOpenShift.hasAdjustments,
        locked: selectedEmployeeOpenShift.payrollImpact.locked,
        manual: selectedEmployeeOpenShift.entryMode === "manual",
      }
    : null;

  const handlePunch = (punchType: TimePunchType) => {
    if (!selectedEmployee) {
      return;
    }

    punchMutation.mutate(
      {
        punchType,
        employeeId: selectedEmployee.id,
        note: note.trim() || null,
        breakType: punchType === "break_start" ? breakType : null,
      },
      {
        onSuccess: () => {
          setNote("");
        },
      }
    );
  };

  const registerDevice = () => {
    deviceMutation.mutate(
      {
        propertyId: property.id,
        deviceName: deviceName.trim(),
        deviceType,
      },
        {
          onSuccess: (result) => {
            setLatestDeviceToken(result.authToken);
            setIsDeviceTokenVisible(false);
            setDeviceName("");
            setDeviceType(defaultDeviceType);
          },
      }
    );
  };

  const createPairingToken = () => {
    pairingTokenMutation.mutate(undefined, {
      onSuccess: (pairingToken) => {
        setLatestPairingToken(pairingToken);
        setIsPairingSecretVisible(false);
      },
    });
  };

  const unpairDevice = (deviceId: string, deviceName: string) => {
    if (
      !window.confirm(
        `Unpair ${deviceName}? This device will lose access to kiosk punches until it is paired again.`
      )
    ) {
      return;
    }

    setDeviceAction({
      deviceId,
      kind: "retire",
    });
    retireDeviceMutation.mutate(
      {
        propertyId: property.id,
        deviceId,
      },
      {
        onSettled: () => {
          setDeviceAction((currentAction) =>
            currentAction?.deviceId === deviceId && currentAction.kind === "retire" ? null : currentAction
          );
        },
      }
    );
  };

  const deleteDeviceRecord = (deviceId: string, deviceName: string) => {
    if (
      !window.confirm(
        `Delete the ${deviceName} device record? This permanently removes the row. Devices with recorded punches cannot be deleted.`
      )
    ) {
      return;
    }

    setDeviceAction({
      deviceId,
      kind: "delete",
    });
    deleteDeviceRecordMutation.mutate(
      {
        propertyId: property.id,
        deviceId,
      },
      {
        onSettled: () => {
          setDeviceAction((currentAction) =>
            currentAction?.deviceId === deviceId && currentAction.kind === "delete" ? null : currentAction
          );
        },
      }
    );
  };

  const renderDeviceList = (
    deviceCollection: typeof devices,
    emptyMessage: string
  ) => {
    if (deviceCollection.length === 0) {
      return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
    }

    return (
      <div className="space-y-3">
        {deviceCollection.map((device) => (
          <div
            key={device.id}
            className="rounded-2xl border border-border bg-background px-4 py-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{device.deviceName}</p>
                <p className="text-sm text-muted-foreground">
                  {device.deviceType} · Pairing code {device.pairingCode}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={device.status === "active" ? "default" : "outline"}>{device.status}</Badge>
                {canRegisterDevices ? (
                  device.status === "retired" ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={deleteDeviceRecordMutation.isPending}
                      onClick={() => deleteDeviceRecord(device.id, device.deviceName)}
                    >
                      {deleteDeviceRecordMutation.isPending &&
                      deviceAction?.deviceId === device.id &&
                      deviceAction.kind === "delete"
                        ? "Deleting..."
                        : "Delete record"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={retireDeviceMutation.isPending}
                      onClick={() => unpairDevice(device.id, device.deviceName)}
                    >
                      {retireDeviceMutation.isPending &&
                      deviceAction?.deviceId === device.id &&
                      deviceAction.kind === "retire"
                        ? "Unpairing..."
                        : "Unpair"}
                    </Button>
                  )
                ) : null}
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Last seen {device.lastSeenAt ? formatDateTime(device.lastSeenAt) : "never"}
            </p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Open shifts</CardDescription>
            <CardTitle className="text-2xl">{openShifts.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Employees currently clocked into this property.</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Employees worked</CardDescription>
            <CardTitle className="text-2xl">{employeesWorkedCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Distinct employees with recorded shifts in this range.</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Payable hours</CardDescription>
            <CardTitle className="text-2xl">{formatMinutes(sevenDayPayableMinutes)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Property-scoped payable time over the last 14 days.</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active devices</CardDescription>
            <CardTitle className="text-2xl">{activeDevicesCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Registered property devices available for kiosk or mobile punches.</CardContent>
        </Card>
      </div>

      {(shiftsQuery.error ||
        devicesQuery.error ||
        punchMutation.error ||
        deviceMutation.error ||
        pairingTokenMutation.error ||
        deleteDeviceRecordMutation.error ||
        retireDeviceMutation.error) ? (
        <Card className="border-destructive/40">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">
              {shiftsQuery.error?.message ??
                devicesQuery.error?.message ??
                punchMutation.error?.message ??
                deviceMutation.error?.message ??
                pairingTokenMutation.error?.message ??
                deleteDeviceRecordMutation.error?.message ??
                retireDeviceMutation.error?.message}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {latestDeviceToken ? (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>New device token</CardTitle>
            <CardDescription>
              Reveal this once on a trusted screen and copy it directly into the device. It is only returned during registration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isDeviceTokenVisible ? (
              <Input value={latestDeviceToken} readOnly />
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-4 text-sm text-muted-foreground">
                Token hidden until you explicitly reveal it.
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => setIsDeviceTokenVisible((current) => !current)}>
                {isDeviceTokenVisible ? "Hide token" : "Reveal token"}
              </Button>
              {isDeviceTokenVisible ? (
                <Button type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(latestDeviceToken)}>
                  Copy token
                </Button>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              Anyone with this token can act as the registered device for this property until it is retired.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {latestPairingToken ? (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Kiosk pairing QR</CardTitle>
            <CardDescription>
              Reveal the single-use QR only when the kiosk pairing screen is ready. It expires at {new Date(latestPairingToken.expiresAt).toLocaleString()}.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[240px_1fr]">
            <div className="flex items-center justify-center rounded-2xl border border-border bg-white p-4">
              {isPairingSecretVisible ? (
                <PropertyQrCode
                  value={latestPairingToken.qrValue}
                  alt="Property kiosk pairing QR code"
                  className="h-56 w-56 rounded-xl"
                />
              ) : (
                <div className="px-4 text-center text-sm text-muted-foreground">QR hidden until you reveal it.</div>
              )}
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Pairing token</Label>
                {isPairingSecretVisible ? (
                  <Input value={latestPairingToken.token} readOnly />
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-4 text-sm text-muted-foreground">
                    Pairing token hidden until revealed.
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={() => setIsPairingSecretVisible((current) => !current)}>
                  {isPairingSecretVisible ? "Hide QR and token" : "Reveal QR and token"}
                </Button>
                {isPairingSecretVisible ? (
                  <Button type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(latestPairingToken.token)}>
                    Copy token
                  </Button>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                The QR is rendered locally in this client rather than sending the pairing payload to an external image service.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Clock controls</CardTitle>
            <CardDescription>Record punches against the selected employee at this property only.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectableEmployees.length > 0 ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="clock-employee">Employee</Label>
                    <Select value={selectedEmployeeId ?? undefined} onValueChange={setSelectedEmployeeId}>
                      <SelectTrigger id="clock-employee" className="bg-card">
                        <SelectValue placeholder="Select employee">{selectedEmployee?.name}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {selectableEmployees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clock-break-type">Break type</Label>
                    <Select value={breakType} onValueChange={(value) => setBreakType(value as "meal" | "other" | "rest")}>
                      <SelectTrigger id="clock-break-type" className="bg-card">
                        <SelectValue placeholder="Select break type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="meal">Meal</SelectItem>
                        <SelectItem value="rest">Rest</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clock-note">Note</Label>
                  <Input
                    id="clock-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Optional admin note for this punch"
                  />
                </div>

                <div className="rounded-2xl border border-border bg-background px-4 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-medium text-foreground">{selectedEmployee?.name ?? "No employee selected"}</p>
                    {selectedEmployeeOpenShift ? (
                      <Badge variant="default">
                        Open since {formatDateTime(selectedEmployeeOpenShift.startedAt)}
                      </Badge>
                    ) : (
                      <Badge variant="outline">No open shift</Badge>
                    )}
                    {selectedEmployeeOpenBreak ? (
                      <Badge variant="secondary">On {selectedEmployeeOpenBreak.breakType} break</Badge>
                    ) : null}
                  </div>
                  {selectedEmployeeShiftFlags ? (
                    <div className="mt-3">
                      <ShiftFlagBadges flags={selectedEmployeeShiftFlags} />
                    </div>
                  ) : null}
                  <p className="mt-2 text-sm text-muted-foreground">
                    {canManageAllEmployees
                      ? "You can record punches for employees assigned to this property."
                      : "You can record punches only for your own employee record at this property."}
                  </p>
                  {selectedEmployeeOpenShift ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {buildPayrollImpactLabel(selectedEmployeeOpenShift.payrollImpact)}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Button
                    type="button"
                    disabled={!canSubmitForSelectedEmployee || Boolean(selectedEmployeeOpenShift) || punchMutation.isPending}
                    onClick={() => handlePunch("clock_in")}
                  >
                    {punchMutation.isPending ? "Saving..." : getPunchActionLabel("clock_in")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canSubmitForSelectedEmployee || !selectedEmployeeOpenShift || punchMutation.isPending}
                    onClick={() => handlePunch("clock_out")}
                  >
                    {getPunchActionLabel("clock_out")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      !canSubmitForSelectedEmployee ||
                      !selectedEmployeeOpenShift ||
                      Boolean(selectedEmployeeOpenBreak) ||
                      punchMutation.isPending
                    }
                    onClick={() => handlePunch("break_start")}
                  >
                    {getPunchActionLabel("break_start")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canSubmitForSelectedEmployee || !selectedEmployeeOpenBreak || punchMutation.isPending}
                    onClick={() => handlePunch("break_end")}
                  >
                    {getPunchActionLabel("break_end")}
                  </Button>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-10 text-center">
                <p className="font-medium text-foreground">No clockable employee record found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  This property dashboard can view time data, but your signed-in user is not linked to an employee row here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Device registration</CardTitle>
            <CardDescription>Register kiosk or app devices that should be bound to this property.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canRegisterDevices ? (
              <>
                <div className="grid gap-4 md:grid-cols-[1fr_180px_auto]">
                  <div className="space-y-2">
                    <Label htmlFor="device-name">Device name</Label>
                    <Input
                      id="device-name"
                      value={deviceName}
                      onChange={(event) => setDeviceName(event.target.value)}
                      placeholder="Front desk kiosk"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="device-type">Device type</Label>
                    <Select value={deviceType} onValueChange={(value) => setDeviceType(value as DeviceType)}>
                      <SelectTrigger id="device-type" className="bg-card">
                        <SelectValue placeholder="Device type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kiosk">Kiosk</SelectItem>
                        <SelectItem value="tablet">Tablet</SelectItem>
                        <SelectItem value="mobile">Mobile</SelectItem>
                        <SelectItem value="desktop">Desktop</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      disabled={!deviceName.trim() || deviceMutation.isPending}
                      onClick={registerDevice}
                    >
                      {deviceMutation.isPending ? "Registering..." : "Register"}
                    </Button>
                  </div>
                </div>
                <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Pair a kiosk with QR</p>
                      <p className="text-sm text-muted-foreground">
                        Generate a short-lived property-scoped QR token for the kiosk app pairing screen.
                      </p>
                    </div>
                    <Button type="button" variant="outline" disabled={pairingTokenMutation.isPending} onClick={createPairingToken}>
                      {pairingTokenMutation.isPending ? "Generating..." : "Generate QR"}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Device registration requires property management permission for this location.
              </p>
            )}

            <Tabs value={deviceListTab} onValueChange={(value) => setDeviceListTab(value as DeviceListTab)}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Property devices</p>
                  <p className="text-sm text-muted-foreground">Active devices stay front-and-center; retired ones move into cleanup.</p>
                </div>
                <TabsList>
                  <TabsTrigger value="active">Active ({activeDevices.length})</TabsTrigger>
                  <TabsTrigger value="retired">Retired ({retiredDevices.length})</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="active" className="mt-4">
                {renderDeviceList(
                  activeDevices,
                  "No active property devices have been registered yet."
                )}
              </TabsContent>
              <TabsContent value="retired" className="mt-4">
                {renderDeviceList(
                  retiredDevices,
                  "No retired devices yet. Unpaired devices will show up here for cleanup."
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent property shifts</CardTitle>
          <CardDescription>Real shift sessions from the Phase 2 time-tracking tables for this property.</CardDescription>
        </CardHeader>
        <CardContent>
          {shifts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Ended</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Breaks</TableHead>
                  <TableHead>Payable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.slice(0, 12).map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell className="font-medium text-foreground">
                      {propertyEmployeeNames.get(shift.employeeId) ?? "Unknown employee"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getShiftBadgeVariant(shift.status)}>{shift.status}</Badge>
                    </TableCell>
                    <TableCell className="space-y-2">
                      <ShiftFlagBadges
                        flags={{
                          autoClosed: shift.status === "auto_closed",
                          edited: shift.status === "edited" || shift.hasAdjustments,
                          locked: shift.payrollImpact.locked,
                          manual: shift.entryMode === "manual",
                        }}
                      />
                      <p className="text-xs text-muted-foreground">{buildPayrollImpactLabel(shift.payrollImpact)}</p>
                    </TableCell>
                    <TableCell>{formatDateTime(shift.startedAt)}</TableCell>
                    <TableCell>{formatDateTime(shift.endedAt)}</TableCell>
                    <TableCell>{formatMinutes(shift.totalMinutes)}</TableCell>
                    <TableCell>{formatMinutes(shift.breakMinutes)}</TableCell>
                    <TableCell>{formatMinutes(shift.payableMinutes)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-10 text-center">
              <p className="font-medium text-foreground">No real shift sessions yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Punches recorded from this tab or registered property devices will populate this table.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
