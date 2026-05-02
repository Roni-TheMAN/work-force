import { PERMISSIONS } from "../lib/permissions";

export function hasTimeManagementPermission(permissionKeys: Iterable<string>): boolean {
  const normalizedKeys = permissionKeys instanceof Set ? permissionKeys : new Set(permissionKeys);

  return normalizedKeys.has(PERMISSIONS.EMPLOYEE_WRITE) || normalizedKeys.has(PERMISSIONS.SCHEDULE_WRITE);
}

export function hasTimeReadPermission(permissionKeys: Iterable<string>): boolean {
  const normalizedKeys = permissionKeys instanceof Set ? permissionKeys : new Set(permissionKeys);

  return (
    normalizedKeys.has(PERMISSIONS.EMPLOYEE_READ) ||
    normalizedKeys.has(PERMISSIONS.SCHEDULE_READ) ||
    normalizedKeys.has(PERMISSIONS.PAYROLL_READ)
  );
}
