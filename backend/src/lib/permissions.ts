export const PERMISSIONS = {
  EMPLOYEE_READ: "employee.read",
  EMPLOYEE_WRITE: "employee.write",
  EMPLOYEE_DELETE: "employee.delete",
  PAYROLL_READ: "payroll.read",
  PAYROLL_WRITE: "payroll.write",
  SCHEDULE_READ: "schedule.read",
  SCHEDULE_WRITE: "schedule.write",
  PROPERTY_READ: "property.read",
  PROPERTY_WRITE: "property.write",
  PROPERTY_SCOPE_BYPASS: "property.scope.bypass",
  USER_INVITE: "user.invite",
  USER_MANAGE: "user.manage",
  ORG_MANAGE: "org.manage",
  BILLING_MANAGE: "billing.manage",
  DOCUMENTS_TEMPLATE_READ: "documents.template.read",
  DOCUMENTS_TEMPLATE_WRITE: "documents.template.write",
  DOCUMENTS_TEMPLATE_DELETE: "documents.template.delete",
  DOCUMENTS_EMPLOYEE_READ: "documents.employee.read",
  DOCUMENTS_EMPLOYEE_SEND: "documents.employee.send",
  DOCUMENTS_EXTERNAL_READ: "documents.external.read",
  DOCUMENTS_EXTERNAL_SEND: "documents.external.send",
  DOCUMENTS_EXTERNAL_MANAGE: "documents.external.manage",
  DOCUMENTS_AUDIT_READ: "documents.audit.read",
  DOCUMENTS_ADMIN_MANAGE: "documents.admin.manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);
