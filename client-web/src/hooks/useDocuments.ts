import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createDocumentTemplate,
  cloneSystemDocumentTemplate,
  deleteDocumentTemplate,
  fetchDocumentRecipients,
  fetchDocumentTemplateBuilderToken,
  fetchExternalDocumentRecipient,
  fetchExternalDocuments,
  fetchDocumentTemplates,
  fetchEmployeeDocuments,
  patchExternalDocumentRecipient,
  patchDocumentTemplate,
  sendEmployeeDocuments,
  sendExternalDocument,
  syncDocumentTemplateFromDocuseal,
  uploadDocumentTemplate,
  type ExternalDocumentFilters,
} from "@/api/documents";
import {
  documentRecipientsQueryKeyBase,
  documentTemplatesQueryKeyBase,
  employeeDocumentsQueryKeyBase,
  externalDocumentRecipientQueryKeyBase,
  externalDocumentsQueryKeyBase,
  getDocumentRecipientsQueryKey,
  getDocumentTemplatesQueryKey,
  getEmployeeDocumentsQueryKey,
  getExternalDocumentRecipientQueryKey,
  getExternalDocumentsQueryKey,
} from "@/lib/query-keys";
import { useAuth } from "@/providers/auth-provider";

export function useDocumentTemplates(organizationId: string | undefined) {
  const { session } = useAuth();

  return useQuery({
    queryKey: getDocumentTemplatesQueryKey(organizationId),
    queryFn: ({ signal }) => fetchDocumentTemplates(organizationId!, signal),
    enabled: Boolean(session?.access_token && organizationId),
  });
}

export function useDocumentRecipients(organizationId: string | undefined) {
  const { session } = useAuth();

  return useQuery({
    queryKey: getDocumentRecipientsQueryKey(organizationId),
    queryFn: ({ signal }) => fetchDocumentRecipients(organizationId!, signal),
    enabled: Boolean(session?.access_token && organizationId),
  });
}

export function useEmployeeDocuments(
  organizationId: string | undefined,
  employeeId: string | undefined | null,
  enabled = true
) {
  const { session } = useAuth();

  return useQuery({
    queryKey: getEmployeeDocumentsQueryKey(organizationId, employeeId),
    queryFn: ({ signal }) => fetchEmployeeDocuments(organizationId!, employeeId!, signal),
    enabled: Boolean(session?.access_token && organizationId && employeeId && enabled),
  });
}

function stableFiltersKey(filters: ExternalDocumentFilters | undefined) {
  return JSON.stringify(filters ?? {});
}

export function useExternalDocuments(organizationId: string | undefined, filters?: ExternalDocumentFilters, enabled = true) {
  const { session } = useAuth();
  const filtersKey = stableFiltersKey(filters);

  return useQuery({
    queryKey: getExternalDocumentsQueryKey(organizationId, filtersKey),
    queryFn: ({ signal }) => fetchExternalDocuments(organizationId!, filters, signal),
    enabled: Boolean(session?.access_token && organizationId && enabled),
  });
}

export function useExternalDocumentRecipient(
  organizationId: string | undefined,
  recipientId: string | undefined | null,
  enabled = true
) {
  const { session } = useAuth();

  return useQuery({
    queryKey: getExternalDocumentRecipientQueryKey(organizationId, recipientId),
    queryFn: ({ signal }) => fetchExternalDocumentRecipient(organizationId!, recipientId!, signal),
    enabled: Boolean(session?.access_token && organizationId && recipientId && enabled),
  });
}

export function useCreateDocumentTemplate(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDocumentTemplate,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getDocumentTemplatesQueryKey(organizationId) });
    },
  });
}

export function usePatchDocumentTemplate(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: patchDocumentTemplate,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getDocumentTemplatesQueryKey(organizationId) }),
        queryClient.invalidateQueries({ queryKey: documentRecipientsQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: employeeDocumentsQueryKeyBase }),
      ]);
    },
  });
}

export function useDeleteDocumentTemplate(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDocumentTemplate,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getDocumentTemplatesQueryKey(organizationId) });
    },
  });
}

export function useUploadDocumentTemplate(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadDocumentTemplate,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getDocumentTemplatesQueryKey(organizationId) });
    },
  });
}

export function useCloneSystemDocumentTemplate(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cloneSystemDocumentTemplate,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getDocumentTemplatesQueryKey(organizationId) });
    },
  });
}

export function useDocumentTemplateBuilderToken() {
  return useMutation({
    mutationFn: fetchDocumentTemplateBuilderToken,
  });
}

export function useSyncDocumentTemplateFromDocuseal(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: syncDocumentTemplateFromDocuseal,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getDocumentTemplatesQueryKey(organizationId) });
    },
  });
}

export function useSendEmployeeDocuments(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendEmployeeDocuments,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: documentRecipientsQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: employeeDocumentsQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: documentTemplatesQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: getDocumentRecipientsQueryKey(organizationId) }),
      ]);
    },
  });
}

export function useSendExternalDocument(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendExternalDocument,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: externalDocumentsQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: documentTemplatesQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: getExternalDocumentsQueryKey(organizationId, undefined) }),
      ]);
    },
  });
}

export function usePatchExternalDocumentRecipient(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: patchExternalDocumentRecipient,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: externalDocumentsQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: externalDocumentRecipientQueryKeyBase }),
        queryClient.invalidateQueries({ queryKey: getExternalDocumentsQueryKey(organizationId, undefined) }),
      ]);
    },
  });
}
