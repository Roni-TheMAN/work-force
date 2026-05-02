export const currentUserQueryKeyBase = ["current-user"] as const;
export const clientOrganizationsQueryKeyBase = ["client-organizations"] as const;
export const organizationPermissionsQueryKeyBase = ["organization-permissions"] as const;
export const organizationRolesQueryKeyBase = ["organization-roles"] as const;
export const organizationUsersQueryKeyBase = ["organization-users"] as const;
export const organizationEmployeesQueryKeyBase = ["organization-employees"] as const;
export const organizationBillingSummaryQueryKeyBase = ["organization-billing-summary"] as const;
export const documentTemplatesQueryKeyBase = ["document-templates"] as const;
export const documentRecipientsQueryKeyBase = ["document-recipients"] as const;
export const employeeDocumentsQueryKeyBase = ["employee-documents"] as const;
export const externalDocumentsQueryKeyBase = ["external-documents"] as const;
export const externalDocumentRecipientQueryKeyBase = ["external-document-recipient"] as const;
export const userAccessQueryKeyBase = ["user-access"] as const;
export const propertyDashboardQueryKeyBase = ["property-dashboard"] as const;
export const propertyPermissionsQueryKeyBase = ["property-permissions"] as const;
export const propertyScheduleWeekQueryKeyBase = ["property-schedule-week"] as const;
export const propertyScheduleTemplatesQueryKeyBase = ["property-schedule-templates"] as const;
export const propertyPayrollPeriodsQueryKeyBase = ["property-payroll-periods"] as const;
export const propertyPayrollPeriodDetailQueryKeyBase = ["property-payroll-period-detail"] as const;
export const propertyTimeDevicesQueryKeyBase = ["property-time-devices"] as const;
export const propertyTimeLogsQueryKeyBase = ["property-time-logs"] as const;
export const propertyTimeShiftsQueryKeyBase = ["property-time-shifts"] as const;
export const organizationSchedulingSummaryQueryKeyBase = ["organization-scheduling-summary"] as const;

export function getCurrentUserQueryKey(userId: string | undefined) {
  return [...currentUserQueryKeyBase, userId ?? "anonymous"] as const;
}

export function getClientOrganizationsQueryKey(userId: string | undefined) {
  return [...clientOrganizationsQueryKeyBase, userId ?? "anonymous"] as const;
}

export function getOrganizationPermissionsQueryKey(organizationId: string | undefined) {
  return [...organizationPermissionsQueryKeyBase, organizationId ?? "none"] as const;
}

export function getOrganizationRolesQueryKey(organizationId: string | undefined) {
  return [...organizationRolesQueryKeyBase, organizationId ?? "none"] as const;
}

export function getOrganizationUsersQueryKey(organizationId: string | undefined) {
  return [...organizationUsersQueryKeyBase, organizationId ?? "none"] as const;
}

export function getOrganizationEmployeesQueryKey(
  organizationId: string | undefined,
  propertyId: string | null | undefined
) {
  return [...organizationEmployeesQueryKeyBase, organizationId ?? "none", propertyId ?? "all"] as const;
}

export function getOrganizationBillingSummaryQueryKey(organizationId: string | undefined) {
  return [...organizationBillingSummaryQueryKeyBase, organizationId ?? "none"] as const;
}

export function getDocumentTemplatesQueryKey(organizationId: string | undefined) {
  return [...documentTemplatesQueryKeyBase, organizationId ?? "none"] as const;
}

export function getDocumentRecipientsQueryKey(organizationId: string | undefined) {
  return [...documentRecipientsQueryKeyBase, organizationId ?? "none"] as const;
}

export function getEmployeeDocumentsQueryKey(organizationId: string | undefined, employeeId: string | undefined | null) {
  return [...employeeDocumentsQueryKeyBase, organizationId ?? "none", employeeId ?? "none"] as const;
}

export function getExternalDocumentsQueryKey(organizationId: string | undefined, filtersKey: string | undefined) {
  return [...externalDocumentsQueryKeyBase, organizationId ?? "none", filtersKey ?? "all"] as const;
}

export function getExternalDocumentRecipientQueryKey(organizationId: string | undefined, recipientId: string | undefined | null) {
  return [...externalDocumentRecipientQueryKeyBase, organizationId ?? "none", recipientId ?? "none"] as const;
}

export function getOrganizationSchedulingSummaryQueryKey(organizationId: string | undefined) {
  return [...organizationSchedulingSummaryQueryKeyBase, organizationId ?? "none"] as const;
}

export function getUserAccessQueryKey(organizationId: string | undefined, userId: string | undefined) {
  return [...userAccessQueryKeyBase, organizationId ?? "none", userId ?? "none"] as const;
}

export function getPropertyDashboardQueryKey(propertyId: string | undefined) {
  return [...propertyDashboardQueryKeyBase, propertyId ?? "none"] as const;
}

export function getPropertyPermissionsQueryKey(propertyId: string | undefined) {
  return [...propertyPermissionsQueryKeyBase, propertyId ?? "none"] as const;
}

export function getPropertyScheduleWeekQueryKey(propertyId: string | undefined, weekStartDate: string | null | undefined) {
  return [...propertyScheduleWeekQueryKeyBase, propertyId ?? "none", weekStartDate ?? "current"] as const;
}

export function getPropertyScheduleTemplatesQueryKey(propertyId: string | undefined) {
  return [...propertyScheduleTemplatesQueryKeyBase, propertyId ?? "none"] as const;
}

export function getPropertyPayrollPeriodsQueryKey(propertyId: string | undefined) {
  return [...propertyPayrollPeriodsQueryKeyBase, propertyId ?? "none"] as const;
}

export function getPropertyPayrollPeriodDetailQueryKey(
  propertyId: string | undefined,
  periodId: string | undefined | null
) {
  return [...propertyPayrollPeriodDetailQueryKeyBase, propertyId ?? "none", periodId ?? "none"] as const;
}

export function getPropertyTimeDevicesQueryKey(propertyId: string | undefined) {
  return [...propertyTimeDevicesQueryKeyBase, propertyId ?? "none"] as const;
}

export function getPropertyTimeLogsQueryKey(
  propertyId: string | undefined,
  businessDateFrom: string | null | undefined,
  businessDateTo: string | null | undefined,
  employeeId: string | null | undefined,
  status: string | null | undefined,
  flags: string[] | null | undefined
) {
  return [
    ...propertyTimeLogsQueryKeyBase,
    propertyId ?? "none",
    businessDateFrom ?? "none",
    businessDateTo ?? "none",
    employeeId ?? "none",
    status ?? "none",
    ...(flags?.length ? [...flags].sort() : ["all"]),
  ] as const;
}

export function getPropertyTimeShiftsQueryKey(
  organizationId: string | undefined,
  propertyId: string | undefined,
  businessDateFrom: string | null | undefined,
  businessDateTo: string | null | undefined,
  employeeId?: string | null | undefined,
  status?: string | null | undefined
) {
  return [
    ...propertyTimeShiftsQueryKeyBase,
    organizationId ?? "none",
    propertyId ?? "none",
    businessDateFrom ?? "none",
    businessDateTo ?? "none",
    employeeId ?? "none",
    status ?? "none",
  ] as const;
}
