import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addEmployeePropertyAssignment,
  archiveEmployee,
  createPropertyEmployee,
  deleteEmployee,
  fetchOrganizationEmployees,
  removeEmployeePropertyAssignment,
  resetEmployeePin,
  revealEmployeePin,
  updateEmployeePropertyAssignment,
} from "@/api/employee";
import {
  getOrganizationEmployeesQueryKey,
  getPropertyDashboardQueryKey,
  organizationEmployeesQueryKeyBase,
  organizationSchedulingSummaryQueryKeyBase,
  propertyDashboardQueryKeyBase,
  propertyPayrollPeriodDetailQueryKeyBase,
  propertyPayrollPeriodsQueryKeyBase,
  propertyScheduleWeekQueryKeyBase,
  propertyTimeLogsQueryKeyBase,
  propertyTimeShiftsQueryKeyBase,
} from "@/lib/query-keys";
import { useAuth } from "@/providers/auth-provider";

export function useOrganizationEmployees(
  organizationId: string | undefined,
  propertyId: string | null | undefined,
  enabled = true
) {
  const { session } = useAuth();

  return useQuery({
    queryKey: getOrganizationEmployeesQueryKey(organizationId, propertyId),
    queryFn: ({ signal }) => fetchOrganizationEmployees(organizationId!, propertyId, signal),
    enabled: Boolean(session?.access_token && organizationId && enabled),
  });
}

export function useCreatePropertyEmployee(
  organizationId: string | undefined,
  propertyId: string | null | undefined
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPropertyEmployee,
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getOrganizationEmployeesQueryKey(organizationId, propertyId),
        }),
        queryClient.invalidateQueries({
          queryKey: getOrganizationEmployeesQueryKey(organizationId, null),
        }),
        queryClient.invalidateQueries({
          queryKey: getPropertyDashboardQueryKey(result.employee.propertyId),
        }),
      ]);
    },
  });
}

export function useAddEmployeePropertyAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addEmployeePropertyAssignment,
    onSuccess: async (assignment) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: organizationEmployeesQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: getPropertyDashboardQueryKey(assignment.property.id) }),
      ]);
    },
  });
}

export function useUpdateEmployeePropertyAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateEmployeePropertyAssignment,
    onSuccess: async (assignment) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: organizationEmployeesQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: getPropertyDashboardQueryKey(assignment.property.id) }),
      ]);
    },
  });
}

export function useRemoveEmployeePropertyAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeEmployeePropertyAssignment,
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: organizationEmployeesQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: getPropertyDashboardQueryKey(variables.propertyId) }),
        queryClient.invalidateQueries({ queryKey: propertyScheduleWeekQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: propertyTimeLogsQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: propertyTimeShiftsQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: organizationSchedulingSummaryQueryKeyBase }),
      ]);
    },
  });
}

export function useArchiveEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveEmployee,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: organizationEmployeesQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: propertyDashboardQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: propertyScheduleWeekQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: propertyTimeLogsQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: propertyTimeShiftsQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: propertyPayrollPeriodsQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: propertyPayrollPeriodDetailQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: organizationSchedulingSummaryQueryKeyBase }),
      ]);
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteEmployee,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: organizationEmployeesQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: propertyDashboardQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: propertyScheduleWeekQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: propertyTimeLogsQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: propertyTimeShiftsQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: propertyPayrollPeriodsQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: propertyPayrollPeriodDetailQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: organizationSchedulingSummaryQueryKeyBase }),
      ]);
    },
  });
}

export function useRevealEmployeePin() {
  return useMutation({
    mutationFn: revealEmployeePin,
  });
}

export function useResetEmployeePin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resetEmployeePin,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: organizationEmployeesQueryKeyBase });
    },
  });
}
