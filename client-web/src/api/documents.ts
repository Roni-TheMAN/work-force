import { apiRequest } from "@/lib/api";

export type DocumentTemplateStatus = "active" | "archived" | "inactive";
export type DocumentPurpose = "employee_general" | "employee_onboarding";
export type DocumentRecipientStatus = "completed" | "declined" | "expired" | "failed" | "opened" | "pending" | "sent";

export type DocumentTemplate = {
  id: string;
  organizationId: string;
  systemTemplateId: string | null;
  docusealTemplateId: string | null;
  externalId: string;
  title: string;
  description: string | null;
  category: string;
  sourceType: "cloned_system" | "docuseal_created" | "system_seeded" | "uploaded";
  builderStatus: "archived" | "needs_setup" | "ready";
  status: DocumentTemplateStatus;
  fileUrl: string | null;
  fileHash: string | null;
  sourceFileUrl: string | null;
  sourceFileName: string | null;
  sourceFileMimeType: string | null;
  sourceFileSizeBytes: number | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentRecipient = {
  id: string;
  organizationId: string;
  envelopeId: string;
  envelopeItemId: string;
  recipientType: "employee" | "external";
  employeeId: string | null;
  propertyId: string | null;
  externalName: string | null;
  externalEmail: string | null;
  externalCompany: string | null;
  externalGroup: string | null;
  externalPhone: string | null;
  isGeneral: boolean;
  notes: string | null;
  signerName: string;
  signerEmail: string | null;
  status: DocumentRecipientStatus;
  docusealStatus: string | null;
  docusealSubmissionId: string | null;
  docusealSubmissionSlug: string | null;
  docusealSubmitterId: string | null;
  docusealSubmitterSlug: string | null;
  docusealSigningUrl: string | null;
  sentAt: string | null;
  openedAt: string | null;
  completedAt: string | null;
  declinedAt: string | null;
  expiredAt: string | null;
  createdAt: string;
  updatedAt: string;
  purpose: "employee_general" | "employee_onboarding" | "external_signature";
  template: DocumentTemplate;
  employee: {
    id: string;
    fullName: string;
    email: string | null;
  } | null;
  property: {
    id: string;
    name: string;
    organizationId: string;
  } | null;
  signedDocuments: Array<{
    id: string;
    documentName: string | null;
    documentUrl: string | null;
    auditLogUrl: string | null;
    combinedDocumentUrl: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  events: Array<{
    id: string;
    source: string;
    eventType: string;
    processingStatus: string;
    errorMessage: string | null;
    occurredAt: string;
    processedAt: string | null;
    createdAt: string;
  }>;
};

export type UpsertDocumentTemplatePayload = {
  organizationId: string;
  templateId?: string;
  docusealTemplateId: string;
  title: string;
  description: string | null;
  category: string;
  sourceType: "docuseal_created";
  status: DocumentTemplateStatus;
};

export type UploadDocumentTemplatePayload = {
  organizationId: string;
  title: string;
  description: string | null;
  category: string;
  file: File;
};

export type DocumentBuilderTokenResponse = {
  token: string;
};

type LegacyDocumentBuilderTokenResponse = {
  builder?: DocumentBuilderTokenResponse;
};

export type SyncDocumentTemplatePayload = {
  organizationId: string;
  templateId: string;
  docusealData: unknown;
};

type SystemDocumentTemplateResponse = {
  id: string;
  docusealTemplateId: string;
  title: string;
  description: string | null;
  category: string;
  sourceType: "system_seeded";
  status: DocumentTemplateStatus;
  sourceFileUrl: string | null;
  sourceFileName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SendEmployeeDocumentsPayload = {
  organizationId: string;
  employeeId: string;
  templateIds: string[];
  purpose: DocumentPurpose;
  messageSubject: string | null;
  messageBody: string | null;
};

export type SendExternalDocumentPayload = {
  organizationId: string;
  templateId: string;
  externalName: string;
  externalEmail: string;
  externalCompany: string | null;
  externalGroup: string | null;
  externalPhone: string | null;
  propertyId: string | null;
  isGeneral: boolean;
  notes: string | null;
  messageSubject: string | null;
  messageBody: string | null;
};

export type ExternalDocumentFilters = {
  name?: string | null;
  email?: string | null;
  company?: string | null;
  group?: string | null;
  propertyId?: string | null;
  isGeneral?: boolean | null;
  status?: DocumentRecipientStatus | "all" | null;
  sentFrom?: string | null;
  sentTo?: string | null;
  signedFrom?: string | null;
  signedTo?: string | null;
  templateId?: string | null;
};

export type PatchExternalDocumentRecipientPayload = {
  organizationId: string;
  recipientId: string;
  externalCompany?: string | null;
  externalGroup?: string | null;
  externalPhone?: string | null;
  propertyId?: string | null;
  isGeneral?: boolean;
  notes?: string | null;
};

export async function fetchDocumentTemplates(organizationId: string, signal?: AbortSignal): Promise<DocumentTemplate[]> {
  const response = await apiRequest<{ templates: DocumentTemplate[]; systemTemplates?: SystemDocumentTemplateResponse[] }>(
    `/api/client/orgs/${encodeURIComponent(organizationId)}/documents/templates`,
    {
      auth: true,
      signal,
    }
  );

  const systemTemplates =
    response.systemTemplates?.map((template) => ({
      id: template.id,
      organizationId: "",
      systemTemplateId: null,
      docusealTemplateId: template.docusealTemplateId,
      externalId: template.id,
      title: template.title,
      description: template.description,
      category: template.category,
      sourceType: "system_seeded" as const,
      builderStatus: "ready" as const,
      status: template.status,
      fileUrl: template.sourceFileUrl,
      fileHash: null,
      sourceFileUrl: template.sourceFileUrl,
      sourceFileName: template.sourceFileName,
      sourceFileMimeType: null,
      sourceFileSizeBytes: null,
      createdByUserId: null,
      updatedByUserId: null,
      archivedAt: null,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    })) ?? [];

  return [...response.templates, ...systemTemplates];
}

export async function createDocumentTemplate(payload: UpsertDocumentTemplatePayload): Promise<DocumentTemplate> {
  const response = await apiRequest<{ template: DocumentTemplate }>(
    `/api/client/orgs/${encodeURIComponent(payload.organizationId)}/documents/templates`,
    {
      auth: true,
      method: "POST",
      body: {
        docusealTemplateId: payload.docusealTemplateId,
        title: payload.title,
        description: payload.description,
        category: payload.category,
        sourceType: payload.sourceType,
        status: payload.status,
      },
    }
  );

  return response.template;
}

export async function patchDocumentTemplate(payload: UpsertDocumentTemplatePayload): Promise<DocumentTemplate> {
  if (!payload.templateId) {
    throw new Error("templateId is required.");
  }

  const response = await apiRequest<{ template: DocumentTemplate }>(
    `/api/client/orgs/${encodeURIComponent(payload.organizationId)}/documents/templates/${encodeURIComponent(payload.templateId)}`,
    {
      auth: true,
      method: "PATCH",
      body: {
        docusealTemplateId: payload.docusealTemplateId,
        title: payload.title,
        description: payload.description,
        category: payload.category,
        sourceType: payload.sourceType,
        status: payload.status,
      },
    }
  );

  return response.template;
}

export async function uploadDocumentTemplate(payload: UploadDocumentTemplatePayload): Promise<DocumentTemplate> {
  const form = new FormData();
  form.set("title", payload.title);
  form.set("category", payload.category);
  if (payload.description) {
    form.set("description", payload.description);
  }
  form.set("file", payload.file);

  const response = await apiRequest<{ template: DocumentTemplate }>(
    `/api/orgs/${encodeURIComponent(payload.organizationId)}/documents/templates/from-upload`,
    {
      auth: true,
      method: "POST",
      body: form,
    }
  );

  return response.template;
}

export async function fetchDocumentTemplateBuilderToken(payload: {
  organizationId: string;
  templateId: string;
}): Promise<DocumentBuilderTokenResponse> {
  const response = await apiRequest<DocumentBuilderTokenResponse & LegacyDocumentBuilderTokenResponse>(
    `/api/orgs/${encodeURIComponent(payload.organizationId)}/documents/templates/${encodeURIComponent(payload.templateId)}/builder-token`,
    {
      auth: true,
      method: "POST",
    }
  );

  if (response.token) {
    return { token: response.token };
  }

  if (response.builder?.token) {
    return { token: response.builder.token };
  }

  throw new Error("DocuSeal builder token was not returned by the server.");
}

export async function syncDocumentTemplateFromDocuseal(payload: SyncDocumentTemplatePayload): Promise<DocumentTemplate> {
  const response = await apiRequest<{ template: DocumentTemplate }>(
    `/api/orgs/${encodeURIComponent(payload.organizationId)}/documents/templates/${encodeURIComponent(payload.templateId)}/docuseal-sync`,
    {
      auth: true,
      method: "PATCH",
      body: { docusealData: payload.docusealData },
    }
  );

  return response.template;
}

export async function cloneSystemDocumentTemplate(payload: {
  organizationId: string;
  systemTemplateId: string;
}): Promise<DocumentTemplate> {
  const response = await apiRequest<{ template: DocumentTemplate }>(
    `/api/orgs/${encodeURIComponent(payload.organizationId)}/documents/templates/from-system/${encodeURIComponent(payload.systemTemplateId)}`,
    {
      auth: true,
      method: "POST",
    }
  );

  return response.template;
}

export async function deleteDocumentTemplate(payload: {
  organizationId: string;
  templateId: string;
}): Promise<{ mode: "archive" | "delete" }> {
  return apiRequest<{ mode: "archive" | "delete" }>(
    `/api/client/orgs/${encodeURIComponent(payload.organizationId)}/documents/templates/${encodeURIComponent(payload.templateId)}`,
    {
      auth: true,
      method: "DELETE",
    }
  );
}

export async function sendEmployeeDocuments(payload: SendEmployeeDocumentsPayload): Promise<DocumentRecipient[]> {
  const response = await apiRequest<{ envelopeId: string; recipients: DocumentRecipient[] }>(
    `/api/client/orgs/${encodeURIComponent(payload.organizationId)}/documents/send/employee`,
    {
      auth: true,
      method: "POST",
      body: {
        employeeId: payload.employeeId,
        templateIds: payload.templateIds,
        purpose: payload.purpose,
        messageSubject: payload.messageSubject,
        messageBody: payload.messageBody,
      },
    }
  );

  return response.recipients;
}

export async function sendExternalDocument(payload: SendExternalDocumentPayload): Promise<DocumentRecipient[]> {
  const response = await apiRequest<{ envelopeId: string; recipients: DocumentRecipient[] }>(
    `/api/client/orgs/${encodeURIComponent(payload.organizationId)}/documents/send/external`,
    {
      auth: true,
      method: "POST",
      body: {
        templateId: payload.templateId,
        externalName: payload.externalName,
        externalEmail: payload.externalEmail,
        externalCompany: payload.externalCompany,
        externalGroup: payload.externalGroup,
        externalPhone: payload.externalPhone,
        propertyId: payload.propertyId,
        isGeneral: payload.isGeneral,
        notes: payload.notes,
        messageSubject: payload.messageSubject,
        messageBody: payload.messageBody,
      },
    }
  );

  return response.recipients;
}

function buildExternalDocumentSearchParams(filters?: ExternalDocumentFilters) {
  const params = new URLSearchParams();

  if (!filters) {
    return params;
  }

  Object.entries(filters).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "" || value === "all") {
      return;
    }

    params.set(key, String(value));
  });

  return params;
}

export async function fetchExternalDocuments(
  organizationId: string,
  filters?: ExternalDocumentFilters,
  signal?: AbortSignal
): Promise<DocumentRecipient[]> {
  const params = buildExternalDocumentSearchParams(filters);
  const query = params.toString();
  const response = await apiRequest<{ recipients: DocumentRecipient[] }>(
    `/api/client/orgs/${encodeURIComponent(organizationId)}/documents/external${query ? `?${query}` : ""}`,
    {
      auth: true,
      signal,
    }
  );

  return response.recipients;
}

export async function fetchExternalDocumentRecipient(
  organizationId: string,
  recipientId: string,
  signal?: AbortSignal
): Promise<DocumentRecipient> {
  const response = await apiRequest<{ recipient: DocumentRecipient }>(
    `/api/client/orgs/${encodeURIComponent(organizationId)}/documents/external/${encodeURIComponent(recipientId)}`,
    {
      auth: true,
      signal,
    }
  );

  return response.recipient;
}

export async function patchExternalDocumentRecipient(
  payload: PatchExternalDocumentRecipientPayload
): Promise<DocumentRecipient> {
  const response = await apiRequest<{ recipient: DocumentRecipient }>(
    `/api/client/orgs/${encodeURIComponent(payload.organizationId)}/documents/external/${encodeURIComponent(payload.recipientId)}`,
    {
      auth: true,
      method: "PATCH",
      body: {
        externalCompany: payload.externalCompany,
        externalGroup: payload.externalGroup,
        externalPhone: payload.externalPhone,
        propertyId: payload.propertyId,
        isGeneral: payload.isGeneral,
        notes: payload.notes,
      },
    }
  );

  return response.recipient;
}

export async function fetchDocumentRecipients(
  organizationId: string,
  signal?: AbortSignal
): Promise<DocumentRecipient[]> {
  const response = await apiRequest<{ recipients: DocumentRecipient[] }>(
    `/api/client/orgs/${encodeURIComponent(organizationId)}/documents/recipients`,
    {
      auth: true,
      signal,
    }
  );

  return response.recipients;
}

export async function fetchEmployeeDocuments(
  organizationId: string,
  employeeId: string,
  signal?: AbortSignal
): Promise<DocumentRecipient[]> {
  const response = await apiRequest<{ recipients: DocumentRecipient[] }>(
    `/api/client/orgs/${encodeURIComponent(organizationId)}/documents/employees/${encodeURIComponent(employeeId)}`,
    {
      auth: true,
      signal,
    }
  );

  return response.recipients;
}
