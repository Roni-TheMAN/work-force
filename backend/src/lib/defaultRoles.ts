import { ALL_PERMISSIONS, PERMISSIONS, type PermissionKey } from "./permissions";

export type DefaultRoleDefinition = {
  name: string;
  description: string;
  isDefault?: boolean;
  permissions: PermissionKey[] | "ALL";
};

export const DEFAULT_ROLES: DefaultRoleDefinition[] = [
  {
    name: "Owner",
    description: "Full access to workforce, payroll, scheduling, properties, billing, and organization settings.",
    permissions: "ALL",
  },
  {
    name: "Admin",
    description: "Operational access to manage employees, schedules, properties, and payroll.",
    permissions: [
      PERMISSIONS.EMPLOYEE_READ,
      PERMISSIONS.EMPLOYEE_WRITE,
      PERMISSIONS.SCHEDULE_READ,
      PERMISSIONS.SCHEDULE_WRITE,
      PERMISSIONS.PROPERTY_READ,
      PERMISSIONS.PROPERTY_WRITE,
      PERMISSIONS.PROPERTY_SCOPE_BYPASS,
      PERMISSIONS.PAYROLL_READ,
      PERMISSIONS.PAYROLL_WRITE,
      PERMISSIONS.USER_INVITE,
      PERMISSIONS.USER_MANAGE,
      PERMISSIONS.DOCUMENTS_TEMPLATE_READ,
      PERMISSIONS.DOCUMENTS_TEMPLATE_WRITE,
      PERMISSIONS.DOCUMENTS_TEMPLATE_DELETE,
      PERMISSIONS.DOCUMENTS_EMPLOYEE_READ,
      PERMISSIONS.DOCUMENTS_EMPLOYEE_SEND,
      PERMISSIONS.DOCUMENTS_EXTERNAL_READ,
      PERMISSIONS.DOCUMENTS_EXTERNAL_SEND,
      PERMISSIONS.DOCUMENTS_EXTERNAL_MANAGE,
      PERMISSIONS.DOCUMENTS_AUDIT_READ,
      PERMISSIONS.DOCUMENTS_ADMIN_MANAGE,
    ],
  },
  {
    name: "Manager",
    description: "Day-to-day staffing and property management access without payroll or organization administration.",
    permissions: [
      PERMISSIONS.EMPLOYEE_READ,
      PERMISSIONS.EMPLOYEE_WRITE,
      PERMISSIONS.PAYROLL_READ,
      PERMISSIONS.PAYROLL_WRITE,
      PERMISSIONS.SCHEDULE_READ,
      PERMISSIONS.SCHEDULE_WRITE,
      PERMISSIONS.PROPERTY_READ,
      PERMISSIONS.DOCUMENTS_TEMPLATE_READ,
      PERMISSIONS.DOCUMENTS_EMPLOYEE_READ,
      PERMISSIONS.DOCUMENTS_EMPLOYEE_SEND,
      PERMISSIONS.DOCUMENTS_EXTERNAL_READ,
      PERMISSIONS.DOCUMENTS_EXTERNAL_SEND,
    ],
  },
  {
    name: "Scheduler",
    description: "Property scheduling access for shift planning and coverage management.",
    permissions: [
      PERMISSIONS.EMPLOYEE_READ,
      PERMISSIONS.SCHEDULE_READ,
      PERMISSIONS.SCHEDULE_WRITE,
      PERMISSIONS.PROPERTY_READ,
    ],
  },
  {
    name: "HR",
    description: "Employee and payroll access for HR workflows.",
    permissions: [
      PERMISSIONS.EMPLOYEE_READ,
      PERMISSIONS.PAYROLL_READ,
      PERMISSIONS.PAYROLL_WRITE,
      PERMISSIONS.DOCUMENTS_TEMPLATE_READ,
      PERMISSIONS.DOCUMENTS_EMPLOYEE_READ,
      PERMISSIONS.DOCUMENTS_EMPLOYEE_SEND,
    ],
  },
  {
    name: "Viewer",
    description: "Read-only access to workforce, scheduling, and property context.",
    isDefault: true,
    permissions: [PERMISSIONS.EMPLOYEE_READ, PERMISSIONS.SCHEDULE_READ, PERMISSIONS.PROPERTY_READ],
  },
];

export function resolveRolePermissions(permissions: DefaultRoleDefinition["permissions"]): PermissionKey[] {
  return permissions === "ALL" ? ALL_PERMISSIONS : permissions;
}
