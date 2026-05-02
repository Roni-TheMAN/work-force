import { useEffect, useState } from "react";

import type { PropertyDashboardWorkforceMember } from "@/api/property";
import { formatHours } from "@/components/dashboard/dashboard-formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PropertyWorkforceProps = {
  workforce: PropertyDashboardWorkforceMember[];
};

function getStatusVariant(status: PropertyDashboardWorkforceMember["attendanceStatus"]) {
  if (status === "clocked-in") {
    return "default";
  }

  if (status === "scheduled") {
    return "secondary";
  }

  return "outline";
}

export function PropertyWorkforce({ workforce }: PropertyWorkforceProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(workforce[0]?.id ?? null);

  useEffect(() => {
    setSelectedEmployeeId(workforce[0]?.id ?? null);
  }, [workforce]);

  const selectedEmployee = workforce.find((employee) => employee.id === selectedEmployeeId) ?? null;

  return (
    <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Property workforce</CardTitle>
          <CardDescription>Only employees assigned to this property are listed here.</CardDescription>
        </CardHeader>
        <CardContent>
          {workforce.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Today</TableHead>
                  <TableHead>Current period</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workforce.map((employee) => (
                  <TableRow
                    key={employee.id}
                    data-state={employee.id === selectedEmployeeId ? "selected" : undefined}
                    onClick={() => setSelectedEmployeeId(employee.id)}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{employee.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {employee.employeeCode ?? employee.email ?? "No secondary identifier"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(employee.attendanceStatus)}>{employee.attendanceStatus}</Badge>
                    </TableCell>
                    <TableCell>{employee.shiftLabel}</TableCell>
                    <TableCell>{formatHours(employee.todayHours)}</TableCell>
                    <TableCell>{formatHours(employee.weeklyHours)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setSelectedEmployeeId(employee.id)}>
                          View employee
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-10 text-center">
              <p className="font-medium text-foreground">No property employees yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Employee assignments will appear here once they are scoped to this property.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Selected employee</CardTitle>
          <CardDescription>Quick profile and live shift context for the current selection.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedEmployee ? (
            <>
              <div>
                <p className="text-lg font-semibold text-foreground">{selectedEmployee.name}</p>
                <p className="text-sm text-muted-foreground">{selectedEmployee.email ?? "No email on file"}</p>
              </div>
              <div className="grid gap-3">
                <div className="rounded-2xl border border-border bg-background px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Status</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{selectedEmployee.attendanceStatus}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Current shift</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{selectedEmployee.shiftLabel}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Current period hours</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{formatHours(selectedEmployee.weeklyHours)}</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select an employee from the table to inspect workforce details.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
