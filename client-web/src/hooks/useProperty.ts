import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

import {
  advancePropertyPayrollPeriod,
  applyPropertyScheduleTemplate,
  approvePropertyPayrollEmployee,
  assignUserToProperties,
  createPropertyScheduleTemplate,
  createPropertyScheduleShift,
  createPropertyPayrollRun,
  deletePropertyScheduleTemplate,
  deletePropertyScheduleShift,
  downloadPropertyPayrollExport,
  finalizePropertyPayrollRun,
  getPropertyDashboard,
  getPropertyPayrollPeriodDetail,
  getPropertyPayrollPeriods,
  getPropertyPermissions,
  getPropertyScheduleWeek,
  getPropertyScheduleTemplates,
  getPropertyTimeLogs,
  getUserAccess,
  publishPropertySchedule,
  reopenPropertyPayrollRun,
  resetPropertyPayrollEmployeeApproval,
  updatePropertyScheduleTemplate,
  updatePropertyScheduleShift,
  updatePropertyAccess,
  updatePropertySettings,
} from "@/api/property";
import {
  getOrganizationUsersQueryKey,
  getOrganizationSchedulingSummaryQueryKey,
  getPropertyDashboardQueryKey,
  getPropertyPayrollPeriodDetailQueryKey,
  getPropertyPayrollPeriodsQueryKey,
  getPropertyPermissionsQueryKey,
  getPropertyScheduleWeekQueryKey,
  getPropertyScheduleTemplatesQueryKey,
  getPropertyTimeLogsQueryKey,
  getUserAccessQueryKey,
  propertyPayrollPeriodDetailQueryKeyBase,
  propertyScheduleWeekQueryKeyBase,
  propertyScheduleTemplatesQueryKeyBase,
  propertyTimeLogsQueryKeyBase,
  propertyTimeShiftsQueryKeyBase,
} from "@/lib/query-keys";
import { useAuth } from "@/providers/auth-provider";

export function useAssignUserToProperties(organizationId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: assignUserToProperties,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getOrganizationUsersQueryKey(organizationId) }),
        queryClient.invalidateQueries({ queryKey: getUserAccessQueryKey(organizationId, userId) }),
      ]);
    },
  });
}

export function useUserAccess(organizationId: string | undefined, userId: string | undefined) {
  const { session } = useAuth();

  return useQuery({
    queryKey: getUserAccessQueryKey(organizationId, userId),
    queryFn: ({ signal }) => getUserAccess(userId!, organizationId!, signal),
    enabled: Boolean(session?.access_token && organizationId && userId),
  });
}

export function usePropertyDashboard(propertyId: string | undefined) {
  const { session } = useAuth();

  return useQuery({
    queryKey: getPropertyDashboardQueryKey(propertyId),
    queryFn: ({ signal }) => getPropertyDashboard(propertyId!, signal),
    enabled: Boolean(session?.access_token && propertyId),
  });
}

export function usePropertyPermissions(propertyId: string | undefined) {
  const { session } = useAuth();

  return useQuery({
    queryKey: getPropertyPermissionsQueryKey(propertyId),
    queryFn: ({ signal }) => getPropertyPermissions(propertyId!, signal),
    enabled: Boolean(session?.access_token && propertyId),
  });
}

export function useUpdatePropertyAccess(propertyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePropertyAccess,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getPropertyDashboardQueryKey(propertyId) }),
        queryClient.invalidateQueries({ queryKey: getPropertyPermissionsQueryKey(propertyId) }),
      ]);
    },
  });
}

export function useUpdatePropertySettings(propertyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePropertySettings,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getPropertyDashboardQueryKey(propertyId) }),
        queryClient.invalidateQueries({ queryKey: getPropertyPermissionsQueryKey(propertyId) }),
      ]);
    },
  });
}

export function useAdvancePropertyPayrollPeriod(propertyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => advancePropertyPayrollPeriod(propertyId!),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getPropertyDashboardQueryKey(propertyId) }),
        queryClient.invalidateQueries({ queryKey: getPropertyPermissionsQueryKey(propertyId) }),
      ]);
    },
  });
}

export function usePropertyPayrollPeriods(propertyId: string | undefined) {
  const { session } = useAuth();

  return useQuery({
    queryKey: getPropertyPayrollPeriodsQueryKey(propertyId),
    queryFn: ({ signal }) => getPropertyPayrollPeriods(propertyId!, signal),
    enabled: Boolean(session?.access_token && propertyId),
  });
}

export function usePropertyPayrollPeriodDetail(propertyId: string | undefined, periodId: string | undefined | null) {
  const { session } = useAuth();

  return useQuery({
    queryKey: getPropertyPayrollPeriodDetailQueryKey(propertyId, periodId),
    queryFn: ({ signal }) => getPropertyPayrollPeriodDetail(propertyId!, periodId!, signal),
    enabled: Boolean(session?.access_token && propertyId && periodId),
  });
}

export function usePropertyTimeLogs(
  propertyId: string | undefined,
  options?: {
    businessDateFrom?: string | null;
    businessDateTo?: string | null;
    employeeId?: string | null;
    status?: string | null;
    flags?: Array<"auto_closed" | "edited" | "locked" | "manual">;
    enabled?: boolean;
  }
) {
  const { session } = useAuth();

  return useQuery({
    queryKey: getPropertyTimeLogsQueryKey(
      propertyId,
      options?.businessDateFrom,
      options?.businessDateTo,
      options?.employeeId,
      options?.status,
      options?.flags
    ),
    queryFn: ({ signal }) =>
      getPropertyTimeLogs(propertyId!, {
        businessDateFrom: options?.businessDateFrom,
        businessDateTo: options?.businessDateTo,
        employeeId: options?.employeeId,
        status: options?.status,
        flags: options?.flags,
        signal,
      }),
    enabled: Boolean(session?.access_token && propertyId && options?.enabled !== false),
    refetchInterval: (query) => (query.state.data?.summary.openShifts ? 15000 : false),
  });
}

function matchesScopedQuery(queryKey: QueryKey, baseKey: readonly string[], propertyId: string | undefined, propertyIndex: number) {
  return queryKey[0] === baseKey[0] && queryKey[propertyIndex] === (propertyId ?? "none");
}

async function invalidateMatchingPropertyQueries(
  queryClient: QueryClient,
  baseKey: readonly string[],
  propertyId: string | undefined,
  propertyIndex: number
) {
  await queryClient.invalidateQueries({
    predicate: ({ queryKey }) => matchesScopedQuery(queryKey, baseKey, propertyId, propertyIndex),
  });
}

async function invalidatePropertyPayrollQueries(queryClient: ReturnType<typeof useQueryClient>, propertyId: string | undefined) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: getPropertyDashboardQueryKey(propertyId) }),
    queryClient.invalidateQueries({ queryKey: getPropertyPayrollPeriodsQueryKey(propertyId) }),
    invalidateMatchingPropertyQueries(queryClient, propertyPayrollPeriodDetailQueryKeyBase, propertyId, 1),
    invalidateMatchingPropertyQueries(queryClient, propertyTimeLogsQueryKeyBase, propertyId, 1),
    invalidateMatchingPropertyQueries(queryClient, propertyTimeShiftsQueryKeyBase, propertyId, 2),
  ]);
}

async function invalidatePropertyScheduleQueries(
  queryClient: QueryClient,
  propertyId: string | undefined,
  organizationId?: string | undefined
) {
  await Promise.all([
    invalidateMatchingPropertyQueries(queryClient, propertyScheduleWeekQueryKeyBase, propertyId, 1),
    organizationId
      ? queryClient.invalidateQueries({ queryKey: getOrganizationSchedulingSummaryQueryKey(organizationId) })
      : Promise.resolve(),
  ]);
}

async function invalidatePropertyScheduleTemplateQueries(queryClient: QueryClient, propertyId: string | undefined) {
  await invalidateMatchingPropertyQueries(queryClient, propertyScheduleTemplatesQueryKeyBase, propertyId, 1);
}

export function usePropertyScheduleWeek(propertyId: string | undefined, weekStartDate: string | null | undefined) {
  const { session } = useAuth();

  return useQuery({
    queryKey: getPropertyScheduleWeekQueryKey(propertyId, weekStartDate),
    queryFn: ({ signal }) =>
      getPropertyScheduleWeek(propertyId!, {
        signal,
        weekStartDate,
      }),
    enabled: Boolean(session?.access_token && propertyId),
    placeholderData: (previousData) => previousData,
  });
}

export function usePropertyScheduleTemplates(propertyId: string | undefined) {
  const { session } = useAuth();

  return useQuery({
    queryKey: getPropertyScheduleTemplatesQueryKey(propertyId),
    queryFn: ({ signal }) => getPropertyScheduleTemplates(propertyId!, signal),
    enabled: Boolean(session?.access_token && propertyId),
  });
}

export function useCreatePropertyPayrollRun(propertyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ periodId }: { periodId: string }) => createPropertyPayrollRun({ propertyId: propertyId!, periodId }),
    onSuccess: async () => {
      await invalidatePropertyPayrollQueries(queryClient, propertyId);
    },
  });
}

export function useApprovePropertyPayrollEmployee(propertyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      runId,
      employeeId,
      note,
    }: {
      runId: string;
      employeeId: string;
      note?: string | null;
    }) => approvePropertyPayrollEmployee({ propertyId: propertyId!, runId, employeeId, note }),
    onSuccess: async () => {
      await invalidatePropertyPayrollQueries(queryClient, propertyId);
    },
  });
}

export function useResetPropertyPayrollEmployeeApproval(propertyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      runId,
      employeeId,
      note,
    }: {
      runId: string;
      employeeId: string;
      note?: string | null;
    }) => resetPropertyPayrollEmployeeApproval({ propertyId: propertyId!, runId, employeeId, note }),
    onSuccess: async () => {
      await invalidatePropertyPayrollQueries(queryClient, propertyId);
    },
  });
}

export function useFinalizePropertyPayrollRun(propertyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: string) => finalizePropertyPayrollRun(propertyId!, runId),
    onSuccess: async () => {
      await invalidatePropertyPayrollQueries(queryClient, propertyId);
    },
  });
}

export function useReopenPropertyPayrollRun(propertyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: string) => reopenPropertyPayrollRun(propertyId!, runId),
    onSuccess: async () => {
      await invalidatePropertyPayrollQueries(queryClient, propertyId);
    },
  });
}

export function useDownloadPropertyPayrollExport(propertyId: string | undefined) {
  return useMutation({
    mutationFn: ({ runId, kind }: { runId: string; kind: "detail" | "shifts" | "summary" }) =>
      downloadPropertyPayrollExport({ propertyId: propertyId!, runId, kind }),
  });
}

export function useCreatePropertyScheduleShift(propertyId: string | undefined, organizationId?: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPropertyScheduleShift,
    onSuccess: async () => {
      await invalidatePropertyScheduleQueries(queryClient, propertyId, organizationId);
    },
  });
}

export function useCreatePropertyScheduleTemplate(propertyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPropertyScheduleTemplate,
    onSuccess: async (data) => {
      queryClient.setQueryData(getPropertyScheduleTemplatesQueryKey(propertyId), data);
      await invalidatePropertyScheduleTemplateQueries(queryClient, propertyId);
    },
  });
}

export function useUpdatePropertyScheduleShift(propertyId: string | undefined, organizationId?: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePropertyScheduleShift,
    onSuccess: async () => {
      await invalidatePropertyScheduleQueries(queryClient, propertyId, organizationId);
    },
  });
}

export function useUpdatePropertyScheduleTemplate(propertyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePropertyScheduleTemplate,
    onSuccess: async (data) => {
      queryClient.setQueryData(getPropertyScheduleTemplatesQueryKey(propertyId), data);
      await invalidatePropertyScheduleTemplateQueries(queryClient, propertyId);
    },
  });
}

export function useDeletePropertyScheduleShift(propertyId: string | undefined, organizationId?: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePropertyScheduleShift,
    onSuccess: async () => {
      await invalidatePropertyScheduleQueries(queryClient, propertyId, organizationId);
    },
  });
}

export function useDeletePropertyScheduleTemplate(propertyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePropertyScheduleTemplate,
    onSuccess: async (data) => {
      queryClient.setQueryData(getPropertyScheduleTemplatesQueryKey(propertyId), data);
      await invalidatePropertyScheduleTemplateQueries(queryClient, propertyId);
    },
  });
}

export function usePublishPropertySchedule(propertyId: string | undefined, organizationId?: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ weekStartDate }: { weekStartDate?: string | null }) =>
      publishPropertySchedule({
        propertyId: propertyId!,
        weekStartDate,
      }),
    onSuccess: async () => {
      await invalidatePropertyScheduleQueries(queryClient, propertyId, organizationId);
    },
  });
}

export function useApplyPropertyScheduleTemplate(propertyId: string | undefined, organizationId?: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, weekStartDate }: { templateId: string; weekStartDate?: string | null }) =>
      applyPropertyScheduleTemplate({
        propertyId: propertyId!,
        templateId,
        weekStartDate,
      }),
    onSuccess: async () => {
      await invalidatePropertyScheduleQueries(queryClient, propertyId, organizationId);
    },
  });
}
