import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

import {
  adjustShift,
  createManualShift,
  deletePropertyDeviceRecord,
  createPropertyPairingToken,
  fetchPropertyDevices,
  fetchPropertyTimeShifts,
  recordClientPunch,
  registerPropertyDevice,
  retirePropertyDevice,
  type AdjustShiftPayload,
  type CreateManualShiftPayload,
  type TimePunchType,
} from "@/api/time-tracking";
import {
  getPropertyDashboardQueryKey,
  getPropertyPayrollPeriodsQueryKey,
  getPropertyTimeDevicesQueryKey,
  getPropertyTimeShiftsQueryKey,
  propertyPayrollPeriodDetailQueryKeyBase,
  propertyTimeLogsQueryKeyBase,
  propertyTimeShiftsQueryKeyBase,
} from "@/lib/query-keys";
import { useAuth } from "@/providers/auth-provider";

export function usePropertyTimeShifts(
  organizationId: string | undefined,
  propertyId: string | undefined,
  options?: {
    businessDateFrom?: string | null;
    businessDateTo?: string | null;
    employeeId?: string | null;
    status?: string | null;
    enabled?: boolean;
  }
) {
  const { session } = useAuth();

  return useQuery({
    queryKey: getPropertyTimeShiftsQueryKey(
      organizationId,
      propertyId,
      options?.businessDateFrom,
      options?.businessDateTo,
      options?.employeeId,
      options?.status
    ),
    queryFn: ({ signal }) =>
      fetchPropertyTimeShifts(organizationId!, propertyId!, {
        businessDateFrom: options?.businessDateFrom,
        businessDateTo: options?.businessDateTo,
        employeeId: options?.employeeId,
        status: options?.status,
        signal,
      }),
    enabled: Boolean(session?.access_token && organizationId && propertyId && options?.enabled !== false),
    refetchInterval: 15000,
  });
}

export function usePropertyDevices(propertyId: string | undefined, enabled = true) {
  const { session } = useAuth();

  return useQuery({
    queryKey: getPropertyTimeDevicesQueryKey(propertyId),
    queryFn: ({ signal }) => fetchPropertyDevices(propertyId!, signal),
    enabled: Boolean(session?.access_token && propertyId && enabled),
    refetchInterval: 30000,
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

export function useRecordClientPunch(organizationId: string | undefined, propertyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      punchType,
      employeeId,
      note,
      breakType,
    }: {
      punchType: TimePunchType;
      employeeId: string;
      note?: string | null;
      breakType?: "meal" | "other" | "rest" | null;
    }) =>
      recordClientPunch(punchType, {
        organizationId: organizationId!,
        propertyId: propertyId!,
        employeeId,
        note,
        breakType,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getPropertyDashboardQueryKey(propertyId) }),
        invalidateMatchingPropertyQueries(queryClient, propertyTimeLogsQueryKeyBase, propertyId, 1),
        invalidateMatchingPropertyQueries(queryClient, propertyTimeShiftsQueryKeyBase, propertyId, 2),
      ]);
    },
  });
}

export function useRegisterPropertyDevice(propertyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: registerPropertyDevice,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getPropertyTimeDevicesQueryKey(propertyId) }),
        queryClient.invalidateQueries({ queryKey: getPropertyDashboardQueryKey(propertyId) }),
      ]);
    },
  });
}

export function useCreatePropertyPairingToken(propertyId: string | undefined) {
  return useMutation({
    mutationFn: () => createPropertyPairingToken(propertyId!),
  });
}

export function useRetirePropertyDevice(propertyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: retirePropertyDevice,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getPropertyTimeDevicesQueryKey(propertyId) }),
        queryClient.invalidateQueries({ queryKey: getPropertyDashboardQueryKey(propertyId) }),
      ]);
    },
  });
}

export function useDeletePropertyDeviceRecord(propertyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePropertyDeviceRecord,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getPropertyTimeDevicesQueryKey(propertyId) }),
        queryClient.invalidateQueries({ queryKey: getPropertyDashboardQueryKey(propertyId) }),
      ]);
    },
  });
}

export function useCreateManualShift(propertyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateManualShiftPayload) => createManualShift(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getPropertyDashboardQueryKey(propertyId) }),
        queryClient.invalidateQueries({ queryKey: getPropertyPayrollPeriodsQueryKey(propertyId) }),
        invalidateMatchingPropertyQueries(queryClient, propertyPayrollPeriodDetailQueryKeyBase, propertyId, 1),
        invalidateMatchingPropertyQueries(queryClient, propertyTimeLogsQueryKeyBase, propertyId, 1),
        invalidateMatchingPropertyQueries(queryClient, propertyTimeShiftsQueryKeyBase, propertyId, 2),
      ]);
    },
  });
}

export function useAdjustShift(propertyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AdjustShiftPayload) => adjustShift(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getPropertyDashboardQueryKey(propertyId) }),
        queryClient.invalidateQueries({ queryKey: getPropertyPayrollPeriodsQueryKey(propertyId) }),
        invalidateMatchingPropertyQueries(queryClient, propertyPayrollPeriodDetailQueryKeyBase, propertyId, 1),
        invalidateMatchingPropertyQueries(queryClient, propertyTimeLogsQueryKeyBase, propertyId, 1),
        invalidateMatchingPropertyQueries(queryClient, propertyTimeShiftsQueryKeyBase, propertyId, 2),
      ]);
    },
  });
}
