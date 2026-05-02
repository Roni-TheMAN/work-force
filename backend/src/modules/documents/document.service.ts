import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import jwt from "jsonwebtoken";
import type { Prisma, PrismaClient } from "../../../generated/prisma-rbac";
import { env } from "../../lib/env";
import { HttpError } from "../../lib/http-error";
import { PERMISSIONS } from "../../lib/permissions";
import { prisma } from "../../lib/prisma";
import { getOrganizationMembership, hasPropertyScopeBypassPermission } from "../../lib/rbac";

type DocumentsDb = PrismaClient | Prisma.TransactionClient;
type DocumentPurpose = "employee_general" | "employee_onboarding" | "external_signature";
type DocumentRecipientStatus = "completed" | "declined" | "expired" | "failed" | "opened" | "pending" | "sent";
type DocumentTemplateStatus = "active" | "archived" | "inactive";
type DocumentTemplateSourceType = "cloned_system" | "docuseal_created" | "system_seeded" | "uploaded";
type DocumentTemplateBuilderStatus = "archived" | "needs_setup" | "ready";

type ActorContext = {
  userId: string;
  organizationId: string;
  permissions: Set<string>;
  roleName: string;
  canBypassEmployeeScope: boolean;
  scopedPropertyIds: string[] | null;
};

type DocusealSubmissionResponse = {
  id?: number | string;
  slug?: string | null;
  status?: string | null;
  audit_log_url?: string | null;
  combined_document_url?: string | null;
  completed_at?: string | null;
  submitters?: DocusealSubmitterResponse[];
  documents?: DocusealDocumentResponse[];
};

type DocusealSubmitterResponse = {
  id?: number | string;
  submission_id?: number | string;
  slug?: string | null;
  email?: string | null;
  name?: string | null;
  status?: string | null;
  sent_at?: string | null;
  opened_at?: string | null;
  completed_at?: string | null;
  declined_at?: string | null;
  external_id?: string | null;
  url?: string | null;
  submission_url?: string | null;
  documents?: DocusealDocumentResponse[];
};

type DocusealDocumentResponse = {
  name?: string | null;
  url?: string | null;
};

type DocusealTemplateResponse = {
  id?: number | string;
  slug?: string | null;
  name?: string | null;
  documents?: DocusealDocumentResponse[];
};

type DocusealWebhookPayload = {
  event_type?: string;
  timestamp?: string;
  data?: DocusealSubmissionResponse & {
    template?: {
      id?: number | string;
      name?: string | null;
    } | null;
  };
};

export type CreateDocumentTemplateInput = {
  docusealTemplateId?: unknown;
  title?: unknown;
  description?: unknown;
  category?: unknown;
  sourceType?: unknown;
  status?: unknown;
};

export type PatchDocumentTemplateInput = Partial<CreateDocumentTemplateInput>;

export type CreateTemplateFromUploadInput = {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  file?: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  } | null;
};

export type SyncDocusealTemplateInput = {
  docusealTemplateId?: unknown;
  title?: unknown;
  name?: unknown;
  template?: unknown;
  docusealData?: unknown;
};

export type SendEmployeeDocumentsInput = {
  employeeId?: unknown;
  templateIds?: unknown;
  purpose?: unknown;
  messageSubject?: unknown;
  messageBody?: unknown;
};

export type SendExternalDocumentInput = {
  templateId?: unknown;
  externalName?: unknown;
  externalEmail?: unknown;
  externalCompany?: unknown;
  externalGroup?: unknown;
  externalPhone?: unknown;
  propertyId?: unknown;
  isGeneral?: unknown;
  notes?: unknown;
  messageSubject?: unknown;
  messageBody?: unknown;
};

export type ListExternalDocumentsInput = {
  name?: unknown;
  email?: unknown;
  company?: unknown;
  group?: unknown;
  propertyId?: unknown;
  isGeneral?: unknown;
  status?: unknown;
  sentFrom?: unknown;
  sentTo?: unknown;
  signedFrom?: unknown;
  signedTo?: unknown;
  templateId?: unknown;
};

export type PatchExternalRecipientInput = {
  externalCompany?: unknown;
  externalGroup?: unknown;
  externalPhone?: unknown;
  propertyId?: unknown;
  isGeneral?: unknown;
  notes?: unknown;
  externalName?: unknown;
  externalEmail?: unknown;
};

function readTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }
  }

  return null;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function serializeDate(value: Date | null | undefined): string | null {
  return value?.toISOString() ?? null;
}

function requirePermission(context: ActorContext, permissionKey: string) {
  if (!context.permissions.has(permissionKey)) {
    throw new HttpError(403, "You do not have permission to perform this document action.");
  }
}

function isOwnerOrAdmin(context: ActorContext): boolean {
  return context.roleName === "Owner" || context.roleName === "Admin";
}

function canManageAllDocuments(context: ActorContext): boolean {
  return (
    isOwnerOrAdmin(context) ||
    context.permissions.has(PERMISSIONS.DOCUMENTS_ADMIN_MANAGE) ||
    hasPropertyScopeBypassPermission(context.permissions)
  );
}

function canManageExternalDocuments(context: ActorContext): boolean {
  return canManageAllDocuments(context) || context.permissions.has(PERMISSIONS.DOCUMENTS_EXTERNAL_MANAGE);
}

export function getTemplateDeleteMode(sentCount: number): "archive" | "delete" {
  return sentCount > 0 ? "archive" : "delete";
}

export function normalizeDocusealRecipientStatus(status: string | null | undefined): DocumentRecipientStatus {
  switch (status) {
    case "completed":
      return "completed";
    case "declined":
      return "declined";
    case "expired":
      return "expired";
    case "opened":
      return "opened";
    case "sent":
    case "awaiting":
      return "sent";
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}

function normalizeTemplateStatus(value: unknown): DocumentTemplateStatus {
  const status = readTrimmedString(value) ?? "active";

  if (status === "active" || status === "inactive" || status === "archived") {
    return status;
  }

  throw new HttpError(400, "status must be active, inactive, or archived.");
}

function normalizePurpose(value: unknown): DocumentPurpose {
  const purpose = readTrimmedString(value) ?? "employee_onboarding";

  if (purpose === "employee_onboarding" || purpose === "employee_general" || purpose === "external_signature") {
    return purpose;
  }

  throw new HttpError(400, "purpose must be employee_onboarding, employee_general, or external_signature.");
}

function normalizeSourceType(value: unknown): DocumentTemplateSourceType {
  const sourceType = readTrimmedString(value) ?? "docuseal_created";

  if (sourceType === "docuseal") {
    return "docuseal_created";
  }

  if (
    sourceType === "uploaded" ||
    sourceType === "docuseal_created" ||
    sourceType === "system_seeded" ||
    sourceType === "cloned_system"
  ) {
    return sourceType;
  }

  throw new HttpError(400, "sourceType must be uploaded, docuseal_created, system_seeded, or cloned_system.");
}

function normalizeBuilderStatus(value: unknown): DocumentTemplateBuilderStatus {
  const builderStatus = readTrimmedString(value) ?? "ready";

  if (builderStatus === "needs_setup" || builderStatus === "ready" || builderStatus === "archived") {
    return builderStatus;
  }

  throw new HttpError(400, "builderStatus must be needs_setup, ready, or archived.");
}

function normalizeTemplateIdForDocuseal(docusealTemplateId: string): number {
  const numericTemplateId = Number(docusealTemplateId);

  if (!Number.isInteger(numericTemplateId) || numericTemplateId <= 0) {
    throw new HttpError(400, "docusealTemplateId must be a positive numeric DocuSeal template id.");
  }

  return numericTemplateId;
}

function requireReadyDocusealTemplateId(template: {
  docusealTemplateId: string | null;
  builderStatus: string;
  status: string;
  archivedAt: Date | null;
}): string {
  if (template.status !== "active" || template.archivedAt || template.builderStatus !== "ready" || !template.docusealTemplateId) {
    throw new HttpError(400, "Template must be active, ready, and linked to a DocuSeal template before it can be sent.");
  }

  normalizeTemplateIdForDocuseal(template.docusealTemplateId);
  return template.docusealTemplateId;
}

function dedupeIds(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, `${fieldName} must be an array.`);
  }

  const ids = Array.from(
    new Set(value.map((item) => readTrimmedString(item)).filter((item): item is string => Boolean(item)))
  );

  if (ids.length === 0) {
    throw new HttpError(400, `${fieldName} must include at least one id.`);
  }

  return ids;
}

function serializeTemplate(template: {
  id: string;
  organizationId: string;
  systemTemplateId?: string | null;
  docusealTemplateId: string | null;
  externalId?: string | null;
  title: string;
  description: string | null;
  category: string;
  sourceType: string;
  builderStatus: string;
  status: string;
  fileUrl?: string | null;
  fileHash?: string | null;
  sourceFileUrl?: string | null;
  sourceFileName?: string | null;
  sourceFileMimeType?: string | null;
  sourceFileSizeBytes?: number | null;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: template.id,
    organizationId: template.organizationId,
    systemTemplateId: template.systemTemplateId ?? null,
    docusealTemplateId: template.docusealTemplateId,
    externalId: template.externalId ?? template.id,
    title: template.title,
    description: template.description,
    category: template.category,
    sourceType: template.sourceType,
    builderStatus: template.builderStatus,
    status: template.status,
    fileUrl: template.fileUrl ?? template.sourceFileUrl ?? null,
    fileHash: template.fileHash ?? null,
    sourceFileUrl: template.sourceFileUrl ?? null,
    sourceFileName: template.sourceFileName ?? null,
    sourceFileMimeType: template.sourceFileMimeType ?? null,
    sourceFileSizeBytes: template.sourceFileSizeBytes ?? null,
    createdByUserId: template.createdByUserId ?? null,
    updatedByUserId: template.updatedByUserId ?? null,
    archivedAt: serializeDate(template.archivedAt),
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

function serializeSystemTemplate(template: {
  id: string;
  docusealTemplateId: string;
  title: string;
  description: string | null;
  category: string;
  sourceType: string;
  status: string;
  sourceFileUrl: string | null;
  sourceFileName: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: template.id,
    docusealTemplateId: template.docusealTemplateId,
    title: template.title,
    description: template.description,
    category: template.category,
    sourceType: template.sourceType,
    status: template.status,
    sourceFileUrl: template.sourceFileUrl,
    sourceFileName: template.sourceFileName,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

function serializeRecipient(recipient: any) {
  return {
    id: recipient.id,
    organizationId: recipient.organizationId,
    envelopeId: recipient.envelopeId,
    envelopeItemId: recipient.envelopeItemId,
    recipientType: recipient.recipientType,
    employeeId: recipient.employeeId,
    propertyId: recipient.propertyId,
    externalName: recipient.externalName,
    externalEmail: recipient.externalEmail,
    externalCompany: recipient.externalCompany,
    externalGroup: recipient.externalGroup,
    externalPhone: recipient.externalPhone,
    isGeneral: recipient.isGeneral,
    notes: recipient.notes,
    signerName: recipient.signerName,
    signerEmail: recipient.signerEmail,
    status: recipient.status,
    docusealStatus: recipient.docusealStatus,
    docusealSubmissionId: recipient.docusealSubmissionId,
    docusealSubmissionSlug: recipient.docusealSubmissionSlug,
    docusealSubmitterId: recipient.docusealSubmitterId,
    docusealSubmitterSlug: recipient.docusealSubmitterSlug,
    docusealSigningUrl: recipient.docusealSigningUrl,
    sentAt: serializeDate(recipient.sentAt),
    openedAt: serializeDate(recipient.openedAt),
    completedAt: serializeDate(recipient.completedAt),
    declinedAt: serializeDate(recipient.declinedAt),
    expiredAt: serializeDate(recipient.expiredAt),
    createdAt: recipient.createdAt.toISOString(),
    updatedAt: recipient.updatedAt.toISOString(),
    purpose: recipient.envelope.purpose,
    template: serializeTemplate(recipient.envelopeItem.template),
    employee: recipient.employee
      ? {
          id: recipient.employee.id,
          fullName: `${recipient.employee.firstName} ${recipient.employee.lastName}`.trim(),
          email: recipient.employee.email,
        }
      : null,
    property: recipient.property
      ? {
          id: recipient.property.id,
          name: recipient.property.name,
          organizationId: recipient.property.organizationId,
        }
      : null,
    signedDocuments: recipient.signedDocuments.map((document: any) => ({
      id: document.id,
      documentName: document.documentName,
      documentUrl: document.documentUrl,
      auditLogUrl: document.auditLogUrl,
      combinedDocumentUrl: document.combinedDocumentUrl,
      completedAt: serializeDate(document.completedAt),
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    })),
    events: (recipient.events ?? []).map((event: any) => ({
      id: event.id,
      source: event.source,
      eventType: event.eventType,
      processingStatus: event.processingStatus,
      errorMessage: event.errorMessage,
      occurredAt: event.occurredAt.toISOString(),
      processedAt: serializeDate(event.processedAt),
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

async function getActorContext(userId: string, organizationId: string, db: DocumentsDb = prisma): Promise<ActorContext> {
  const membership = await getOrganizationMembership(userId, organizationId);

  if (!membership || membership.status !== "active") {
    throw new HttpError(403, "You do not have access to that organization.");
  }

  const permissions = new Set(membership.role.permissions.map((permission) => permission.key));
  const canBypassEmployeeScope = canManageAllDocuments({
    userId,
    organizationId,
    permissions,
    roleName: membership.role.name,
    canBypassEmployeeScope: false,
    scopedPropertyIds: null,
  });
  let scopedPropertyIds: string[] | null = null;

  if (!canBypassEmployeeScope) {
    const propertyRoles = await db.propertyUserRole.findMany({
      where: {
        userId,
        property: {
          organizationId,
        },
      },
      select: {
        propertyId: true,
      },
    });

    scopedPropertyIds = propertyRoles.map((role) => role.propertyId);
  }

  return {
    userId,
    organizationId,
    permissions,
    roleName: membership.role.name,
    canBypassEmployeeScope,
    scopedPropertyIds,
  };
}

export function canAccessEmployeeDocuments(input: {
  actorUserId: string;
  canBypassEmployeeScope: boolean;
  employeeUserId: string | null;
  employeePropertyIds: string[];
  scopedPropertyIds: string[] | null;
}): boolean {
  if (input.canBypassEmployeeScope) {
    return true;
  }

  if (input.employeeUserId && input.employeeUserId === input.actorUserId) {
    return true;
  }

  if (!input.scopedPropertyIds || input.scopedPropertyIds.length === 0) {
    return false;
  }

  return input.employeePropertyIds.some((propertyId) => input.scopedPropertyIds?.includes(propertyId));
}

export function canAccessExternalSignature(input: {
  canManageAllExternal: boolean;
  isGeneral: boolean;
  propertyId: string | null;
  scopedPropertyIds: string[] | null;
}): boolean {
  if (input.canManageAllExternal) {
    return true;
  }

  if (input.isGeneral || !input.propertyId || !input.scopedPropertyIds || input.scopedPropertyIds.length === 0) {
    return false;
  }

  return input.scopedPropertyIds.includes(input.propertyId);
}

async function getAccessibleEmployee(employeeId: string, context: ActorContext, db: DocumentsDb = prisma) {
  const now = new Date();
  const employee = await db.employee.findFirst({
    where: {
      id: employeeId,
      organizationId: context.organizationId,
    },
    include: {
      propertyAssignments: {
        where: {
          OR: [{ activeFrom: null }, { activeFrom: { lte: now } }],
          AND: [{ OR: [{ activeTo: null }, { activeTo: { gte: now } }] }],
        },
        select: {
          propertyId: true,
        },
      },
    },
  });

  if (!employee) {
    throw new HttpError(404, "Employee not found in this organization.");
  }

  const allowed = canAccessEmployeeDocuments({
    actorUserId: context.userId,
    canBypassEmployeeScope: context.canBypassEmployeeScope,
    employeeUserId: employee.userId,
    employeePropertyIds: employee.propertyAssignments.map((assignment) => assignment.propertyId),
    scopedPropertyIds: context.scopedPropertyIds,
  });

  if (!allowed) {
    throw new HttpError(403, "You do not have access to documents for that employee.");
  }

  return employee;
}

async function getAccessibleExternalProperty(propertyId: string, context: ActorContext, db: DocumentsDb = prisma) {
  const property = await db.property.findFirst({
    where: {
      id: propertyId,
      organizationId: context.organizationId,
    },
    select: {
      id: true,
      name: true,
      organizationId: true,
    },
  });

  if (!property) {
    throw new HttpError(404, "Property not found in this organization.");
  }

  if (
    !canAccessExternalSignature({
      canManageAllExternal: canManageExternalDocuments(context),
      isGeneral: false,
      propertyId,
      scopedPropertyIds: context.scopedPropertyIds,
    })
  ) {
    throw new HttpError(403, "You do not have access to external signatures for that property.");
  }

  return property;
}

async function resolveExternalScope(input: { isGeneral?: unknown; propertyId?: unknown }, context: ActorContext, db: DocumentsDb = prisma) {
  const isGeneral = readBoolean(input.isGeneral) ?? false;
  const propertyId = readTrimmedString(input.propertyId);

  if (isGeneral) {
    if (!canManageExternalDocuments(context)) {
      throw new HttpError(403, "General external signatures require document external management permission.");
    }

    return {
      isGeneral: true,
      propertyId: null,
      property: null,
    };
  }

  if (!propertyId) {
    throw new HttpError(400, "propertyId is required unless isGeneral is true.");
  }

  const property = await getAccessibleExternalProperty(propertyId, context, db);

  return {
    isGeneral: false,
    propertyId: property.id,
    property,
  };
}

function buildEmployeeRecipientWhere(context: ActorContext, employeeId?: string) {
  if (context.canBypassEmployeeScope) {
    return employeeId ? { employeeId } : {};
  }

  return {
    ...(employeeId ? { employeeId } : {}),
    employee: {
      OR: [
        { userId: context.userId },
        ...(context.scopedPropertyIds && context.scopedPropertyIds.length > 0
          ? [
              {
                propertyAssignments: {
                  some: {
                    propertyId: {
                      in: context.scopedPropertyIds,
                    },
                  },
                },
              },
            ]
          : []),
      ],
    },
  };
}

function buildExternalRecipientWhere(context: ActorContext): Prisma.DocumentRecipientWhereInput {
  if (canManageExternalDocuments(context)) {
    return {};
  }

  if (!context.scopedPropertyIds || context.scopedPropertyIds.length === 0) {
    return {
      propertyId: {
        in: [],
      },
    };
  }

  return {
    isGeneral: false,
    propertyId: {
      in: context.scopedPropertyIds,
    },
  };
}

async function recordAppEvent(input: {
  organizationId: string;
  actorUserId?: string;
  envelopeId?: string;
  recipientId?: string;
  templateId?: string;
  employeeId?: string | null;
  eventType: string;
  payload?: Prisma.InputJsonValue;
}, db: DocumentsDb = prisma) {
  await db.documentEvent.create({
    data: {
      id: randomUUID(),
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      envelopeId: input.envelopeId,
      recipientId: input.recipientId,
      templateId: input.templateId,
      employeeId: input.employeeId ?? undefined,
      source: "app",
      eventType: input.eventType,
      payload: input.payload ?? {},
      occurredAt: new Date(),
      processedAt: new Date(),
      processingStatus: "processed",
    },
  });
}

export async function listDocumentTemplates(userId: string, organizationId: string, db: DocumentsDb = prisma) {
  const context = await getActorContext(userId, organizationId, db);
  requirePermission(context, PERMISSIONS.DOCUMENTS_TEMPLATE_READ);

  const [templates, systemTemplates] = await Promise.all([
    db.documentTemplate.findMany({
      where: {
        organizationId,
      },
      orderBy: [{ status: "asc" }, { title: "asc" }],
    }),
    db.systemDocumentTemplate.findMany({
      where: {
        status: "active",
      },
      orderBy: [{ category: "asc" }, { title: "asc" }],
    }),
  ]);

  return {
    templates: templates.map(serializeTemplate),
    systemTemplates: systemTemplates.map(serializeSystemTemplate),
  };
}

function getUploadPublicBaseUrl() {
  if (!env.documentUploadPublicBaseUrl) {
    throw new HttpError(500, "DOCUMENT_UPLOAD_PUBLIC_BASE_URL is required to expose uploads to DocuSeal.");
  }

  return env.documentUploadPublicBaseUrl;
}

function getDocumentUploadRoot() {
  return path.join(process.cwd(), "uploads", "documents");
}

function sanitizeFileName(value: string) {
  const ext = path.extname(value).toLowerCase();
  const base = path
    .basename(value, ext)
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${base || "document"}${ext}`;
}

function validateUploadFile(file: CreateTemplateFromUploadInput["file"]): NonNullable<CreateTemplateFromUploadInput["file"]> {
  if (!file) {
    throw new HttpError(400, "A PDF file is required.");
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const allowed = ext === ".pdf" && file.mimetype === "application/pdf";

  if (!allowed) {
    throw new HttpError(400, "Only PDF uploads are supported.");
  }

  return file;
}

function getDocusealApiKey() {
  if (!env.docusealApiKey) {
    throw new HttpError(500, "DOCUSEAL_API_KEY is not configured.");
  }

  return env.docusealApiKey;
}

function getDocusealAdminEmail() {
  if (!env.docusealAdminEmail) {
    throw new HttpError(500, "DOCUSEAL_ADMIN_EMAIL is not configured.");
  }

  return env.docusealAdminEmail;
}

function createBuilderToken(input: {
  integrationEmail: string;
  externalId: string;
  templateTitle: string;
  organizationName: string;
  organizationId: string;
  docusealTemplateId: string | null;
  documentUrls: string[];
}) {
  const payload: Record<string, unknown> = {
    user_email: getDocusealAdminEmail(),
    integration_email: input.integrationEmail,
    external_id: input.externalId,
    folder_name: `${input.organizationName} / ${input.organizationId}`,
    name: input.templateTitle,
    extract_fields: true,
    withSendButton: false,
    withSignYourselfButton: false,
    withUploadButton: true,
    withAddPageButton: false,
    withDocumentsList: true,
    withFieldsList: true,
    withFieldsDetection: false,
    autosave: true,
  };

  if (input.docusealTemplateId) {
    payload.template_id = normalizeTemplateIdForDocuseal(input.docusealTemplateId);
  } else {
    payload.document_urls = input.documentUrls;
  }

  return jwt.sign(payload, getDocusealApiKey(), { algorithm: "HS256", expiresIn: "2h" });
}

async function getBuilderOpenData(input: {
  userId: string;
  organizationId: string;
  template: {
    id: string;
    title: string;
    externalId: string | null;
    docusealTemplateId: string | null;
    fileUrl: string | null;
    sourceFileUrl: string | null;
  };
  db: DocumentsDb;
}) {
  const [user, organization] = await Promise.all([
    input.db.user.findUnique({
      where: { id: input.userId },
      select: { email: true },
    }),
    input.db.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true, name: true },
    }),
  ]);

  if (!user?.email) {
    throw new HttpError(400, "A user email is required to open the DocuSeal builder.");
  }

  if (!organization) {
    throw new HttpError(404, "Organization not found.");
  }

  const documentUrl = input.template.fileUrl ?? input.template.sourceFileUrl;
  const documentUrls = documentUrl ? [documentUrl] : [];

  if (!input.template.docusealTemplateId && documentUrls.length === 0) {
    throw new HttpError(400, "Template needs an uploaded source file or a DocuSeal template before opening the builder.");
  }

  const token = createBuilderToken({
    integrationEmail: user.email,
    externalId: input.template.externalId ?? input.template.id,
    templateTitle: input.template.title,
    organizationName: organization.name,
    organizationId: organization.id,
    docusealTemplateId: input.template.docusealTemplateId,
    documentUrls,
  });

  await recordAppEvent(
    {
      organizationId: input.organizationId,
      actorUserId: input.userId,
      templateId: input.template.id,
      eventType: "document_template.builder_token_created",
      payload: { templateId: input.template.id, mode: input.template.docusealTemplateId ? "edit" : "create" },
    },
    input.db
  );

  return { token };
}

async function cloneDocusealTemplate(input: { docusealTemplateId: string; name: string; externalId: string }) {
  const response = await fetch(`${env.docusealApiUrl}/templates/${encodeURIComponent(input.docusealTemplateId)}/clone`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": getDocusealApiKey(),
    },
    body: JSON.stringify({
      name: input.name,
      external_id: input.externalId,
    }),
  });

  const payload = (await response.json().catch(() => null)) as DocusealTemplateResponse | { error?: string } | null;

  if (!response.ok) {
    throw new HttpError(
      response.status,
      payload && "error" in payload && typeof payload.error === "string" ? payload.error : "DocuSeal template could not be cloned."
    );
  }

  return (payload ?? {}) as DocusealTemplateResponse;
}

export async function createDocumentTemplate(
  userId: string,
  organizationId: string,
  input: CreateDocumentTemplateInput,
  db: DocumentsDb = prisma
) {
  const context = await getActorContext(userId, organizationId, db);
  requirePermission(context, PERMISSIONS.DOCUMENTS_TEMPLATE_WRITE);

  const docusealTemplateId = readTrimmedString(input.docusealTemplateId);
  const title = readTrimmedString(input.title);
  const category = readTrimmedString(input.category) ?? "Onboarding";
  const status = normalizeTemplateStatus(input.status);

  if (!docusealTemplateId) {
    throw new HttpError(400, "docusealTemplateId is required.");
  }

  normalizeTemplateIdForDocuseal(docusealTemplateId);

  if (!title) {
    throw new HttpError(400, "title is required.");
  }

  const templateId = randomUUID();
  const template = await db.documentTemplate.create({
    data: {
      id: templateId,
      organizationId,
      docusealTemplateId,
      externalId: templateId,
      title,
      description: readOptionalString(input.description),
      category,
      sourceType: normalizeSourceType(input.sourceType),
      builderStatus: status === "archived" ? "archived" : "ready",
      status,
      createdByUserId: userId,
      archivedAt: status === "archived" ? new Date() : null,
    },
  });

  await recordAppEvent(
    {
      organizationId,
      actorUserId: userId,
      templateId: template.id,
      eventType: "document_template.created",
      payload: { templateId: template.id },
    },
    db
  );

  return {
    template: serializeTemplate(template),
  };
}

export async function createDocumentTemplateFromUpload(
  userId: string,
  organizationId: string,
  input: CreateTemplateFromUploadInput,
  db: DocumentsDb = prisma
) {
  const context = await getActorContext(userId, organizationId, db);
  requirePermission(context, PERMISSIONS.DOCUMENTS_TEMPLATE_WRITE);

  const title = readTrimmedString(input.title);
  const category = readTrimmedString(input.category) ?? "Onboarding";
  const file = validateUploadFile(input.file);

  if (!title) {
    throw new HttpError(400, "title is required.");
  }

  const uploadBaseUrl = getUploadPublicBaseUrl();
  const fileName = `${randomUUID()}-${sanitizeFileName(file.originalname)}`;
  const uploadDir = path.join(getDocumentUploadRoot(), organizationId);
  const uploadPath = path.join(uploadDir, fileName);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(uploadPath, file.buffer);

  const sourceFileUrl = `${uploadBaseUrl}/uploads/documents/${encodeURIComponent(organizationId)}/${encodeURIComponent(fileName)}`;
  const fileHash = createHash("sha256").update(file.buffer).digest("hex");
  const templateId = randomUUID();
  const template = await db.documentTemplate.create({
    data: {
      id: templateId,
      organizationId,
      externalId: templateId,
      title,
      description: readOptionalString(input.description),
      category,
      sourceType: "uploaded",
      builderStatus: "needs_setup",
      status: "active",
      fileUrl: sourceFileUrl,
      fileHash,
      sourceFileUrl,
      sourceFileName: file.originalname,
      sourceFileMimeType: file.mimetype,
      sourceFileSizeBytes: file.size,
      createdByUserId: userId,
    },
  });

  await recordAppEvent(
    {
      organizationId,
      actorUserId: userId,
      templateId: template.id,
      eventType: "document_template.uploaded",
      payload: { templateId: template.id, sourceFileName: file.originalname },
    },
    db
  );

  return {
    template: serializeTemplate(template),
  };
}

export async function createDocumentTemplateFromSystem(
  userId: string,
  organizationId: string,
  systemTemplateId: string,
  db: DocumentsDb = prisma
) {
  const context = await getActorContext(userId, organizationId, db);
  requirePermission(context, PERMISSIONS.DOCUMENTS_TEMPLATE_WRITE);

  const systemTemplate = await db.systemDocumentTemplate.findFirst({
    where: {
      id: systemTemplateId,
      status: "active",
    },
  });

  if (!systemTemplate) {
    throw new HttpError(404, "System template not found.");
  }

  const templateId = randomUUID();
  const clone = await cloneDocusealTemplate({
    docusealTemplateId: systemTemplate.docusealTemplateId,
    name: systemTemplate.title,
    externalId: templateId,
  });
  const clonedDocusealTemplateId = clone.id === undefined ? null : String(clone.id);

  if (!clonedDocusealTemplateId) {
    throw new HttpError(502, "DocuSeal clone response did not include a template id.");
  }

  const template = await db.documentTemplate.create({
    data: {
      id: templateId,
      organizationId,
      systemTemplateId: systemTemplate.id,
      docusealTemplateId: clonedDocusealTemplateId,
      externalId: templateId,
      title: systemTemplate.title,
      description: systemTemplate.description,
      category: systemTemplate.category,
      sourceType: "cloned_system",
      builderStatus: "ready",
      status: "active",
      fileUrl: systemTemplate.sourceFileUrl,
      sourceFileUrl: systemTemplate.sourceFileUrl,
      sourceFileName: systemTemplate.sourceFileName,
      createdByUserId: userId,
    },
  });

  await recordAppEvent(
    {
      organizationId,
      actorUserId: userId,
      templateId: template.id,
      eventType: "document_template.system_cloned",
      payload: { templateId: template.id, systemTemplateId: systemTemplate.id, docusealTemplateId: clonedDocusealTemplateId },
    },
    db
  );

  return {
    template: serializeTemplate(template),
  };
}

export async function openDocumentTemplateBuilder(
  userId: string,
  organizationId: string,
  templateId: string,
  db: DocumentsDb = prisma
) {
  const context = await getActorContext(userId, organizationId, db);
  requirePermission(context, PERMISSIONS.DOCUMENTS_TEMPLATE_WRITE);

  const template = await db.documentTemplate.findFirst({
    where: {
      id: templateId,
      organizationId,
      status: {
        not: "archived",
      },
    },
  });

  if (!template) {
    throw new HttpError(404, "Document template not found.");
  }

  return {
    template: serializeTemplate(template),
    builder: await getBuilderOpenData({ userId, organizationId, template, db }),
  };
}

function readDocusealTemplateIdFromSync(input: SyncDocusealTemplateInput): string | null {
  const direct = readTrimmedString(input.docusealTemplateId);

  if (direct) {
    return direct;
  }

  const candidates = [
    input.template,
    input.docusealData,
    input.docusealData && typeof input.docusealData === "object" && "template" in input.docusealData
      ? (input.docusealData as { template?: unknown }).template
      : null,
    input.docusealData && typeof input.docusealData === "object" && "data" in input.docusealData
      ? (input.docusealData as { data?: { template?: unknown } }).data?.template
      : null,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object" || !("id" in candidate)) {
      continue;
    }

    const id = (candidate as { id?: unknown }).id;
    if (typeof id === "number" || typeof id === "string") {
      return String(id);
    }
  }

  return null;
}

export async function syncDocumentTemplateFromDocuseal(
  userId: string,
  organizationId: string,
  templateId: string,
  input: SyncDocusealTemplateInput,
  db: DocumentsDb = prisma
) {
  const context = await getActorContext(userId, organizationId, db);
  requirePermission(context, PERMISSIONS.DOCUMENTS_TEMPLATE_WRITE);

  const existingTemplate = await db.documentTemplate.findFirst({
    where: {
      id: templateId,
      organizationId,
    },
  });

  if (!existingTemplate) {
    throw new HttpError(404, "Document template not found.");
  }

  const docusealTemplateId = readDocusealTemplateIdFromSync(input);

  if (!docusealTemplateId) {
    throw new HttpError(400, "DocuSeal template id is required from the builder save event.");
  }

  normalizeTemplateIdForDocuseal(docusealTemplateId);

  const title = readTrimmedString(input.title) ?? readTrimmedString(input.name);
  const template = await db.documentTemplate.update({
    where: { id: templateId },
    data: {
      docusealTemplateId,
      builderStatus: "ready",
      status: existingTemplate.status === "archived" ? "archived" : existingTemplate.status,
      updatedByUserId: userId,
      ...(title ? { title } : {}),
    },
  });

  await recordAppEvent(
    {
      organizationId,
      actorUserId: userId,
      templateId: template.id,
      eventType: "template_builder_saved",
      payload: { templateId: template.id, docusealTemplateId, docusealData: input.docusealData ?? null },
    },
    db
  );

  return {
    template: serializeTemplate(template),
  };
}

export async function patchDocumentTemplate(
  userId: string,
  organizationId: string,
  templateId: string,
  input: PatchDocumentTemplateInput,
  db: DocumentsDb = prisma
) {
  const context = await getActorContext(userId, organizationId, db);
  requirePermission(context, PERMISSIONS.DOCUMENTS_TEMPLATE_WRITE);

  const existingTemplate = await db.documentTemplate.findFirst({
    where: {
      id: templateId,
      organizationId,
    },
  });

  if (!existingTemplate) {
    throw new HttpError(404, "Document template not found.");
  }

  const nextStatus = input.status === undefined ? existingTemplate.status : normalizeTemplateStatus(input.status);
  const docusealTemplateId =
    input.docusealTemplateId === undefined ? existingTemplate.docusealTemplateId : readTrimmedString(input.docusealTemplateId);

  if (docusealTemplateId) {
    normalizeTemplateIdForDocuseal(docusealTemplateId);
  }

  const nextBuilderStatus =
    nextStatus === "archived"
      ? "archived"
      : docusealTemplateId
        ? "ready"
        : normalizeBuilderStatus(existingTemplate.builderStatus);

  const template = await db.documentTemplate.update({
    where: {
      id: templateId,
    },
    data: {
      docusealTemplateId,
      builderStatus: nextBuilderStatus,
      title: input.title === undefined ? undefined : readTrimmedString(input.title) ?? existingTemplate.title,
      description: input.description === undefined ? undefined : readOptionalString(input.description),
      category: input.category === undefined ? undefined : readTrimmedString(input.category) ?? existingTemplate.category,
      sourceType: input.sourceType === undefined ? undefined : normalizeSourceType(input.sourceType),
      status: nextStatus,
      updatedByUserId: userId,
      archivedAt: nextStatus === "archived" ? existingTemplate.archivedAt ?? new Date() : null,
    },
  });

  await recordAppEvent(
    {
      organizationId,
      actorUserId: userId,
      templateId: template.id,
      eventType: "document_template.updated",
      payload: { templateId: template.id },
    },
    db
  );

  return {
    template: serializeTemplate(template),
  };
}

export async function deleteDocumentTemplate(
  userId: string,
  organizationId: string,
  templateId: string,
  db: DocumentsDb = prisma
) {
  const context = await getActorContext(userId, organizationId, db);
  requirePermission(context, PERMISSIONS.DOCUMENTS_TEMPLATE_DELETE);

  const template = await db.documentTemplate.findFirst({
    where: {
      id: templateId,
      organizationId,
    },
    select: {
      id: true,
      status: true,
      _count: {
        select: {
          envelopeItems: true,
        },
      },
    },
  });

  if (!template) {
    throw new HttpError(404, "Document template not found.");
  }

  const mode = getTemplateDeleteMode(template._count.envelopeItems);

  if (mode === "delete") {
    await db.documentTemplate.delete({
      where: {
        id: template.id,
      },
    });
  } else {
    await db.documentTemplate.update({
      where: {
        id: template.id,
      },
      data: {
        status: "archived",
        builderStatus: "archived",
        archivedAt: new Date(),
      },
    });
  }

  await recordAppEvent(
    {
      organizationId,
      actorUserId: userId,
      templateId: template.id,
      eventType: mode === "delete" ? "document_template.deleted" : "document_template.archived",
      payload: { templateId: template.id, mode },
    },
    db
  );

  return { mode };
}

async function createDocusealSubmission(input: {
  templateId: number;
  recipientId: string;
  signerName: string;
  signerEmail: string;
  messageSubject: string | null;
  messageBody: string | null;
}): Promise<DocusealSubmissionResponse> {
  if (!env.docusealApiKey) {
    throw new HttpError(500, "DOCUSEAL_API_KEY is not configured.");
  }

  const response = await fetch(`${env.docusealApiUrl}/submissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": env.docusealApiKey,
    },
    body: JSON.stringify({
      template_id: input.templateId,
      send_email: true,
      submitters: [
        {
          name: input.signerName,
          email: input.signerEmail,
          external_id: input.recipientId,
          metadata: {
            recipientId: input.recipientId,
          },
        },
      ],
      ...(input.messageSubject || input.messageBody
        ? {
            message: {
              ...(input.messageSubject ? { subject: input.messageSubject } : {}),
              ...(input.messageBody ? { body: input.messageBody } : {}),
            },
          }
        : {}),
    }),
  });

  const payload = (await response.json().catch(() => null)) as DocusealSubmissionResponse | { error?: string } | null;

  if (!response.ok) {
    throw new HttpError(
      response.status,
      payload && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "DocuSeal submission could not be created."
    );
  }

  return (payload ?? {}) as DocusealSubmissionResponse;
}

function getFirstSubmitter(submission: DocusealSubmissionResponse): DocusealSubmitterResponse | null {
  return submission.submitters?.[0] ?? null;
}

function getSigningUrl(submitter: DocusealSubmitterResponse | null): string | null {
  return submitter?.url ?? submitter?.submission_url ?? null;
}

function getRecipientUpdateFromDocuseal(submission: DocusealSubmissionResponse) {
  const submitter = getFirstSubmitter(submission);
  const status = normalizeDocusealRecipientStatus(submitter?.status ?? submission.status);

  return {
    docusealSubmissionId: submission.id === undefined ? null : String(submission.id),
    docusealSubmissionSlug: submission.slug ?? null,
    docusealSubmitterId: submitter?.id === undefined ? null : String(submitter.id),
    docusealSubmitterSlug: submitter?.slug ?? null,
    docusealSigningUrl: getSigningUrl(submitter),
    docusealStatus: submitter?.status ?? submission.status ?? null,
    status,
    sentAt: parseDate(submitter?.sent_at) ?? new Date(),
    openedAt: parseDate(submitter?.opened_at),
    completedAt: parseDate(submitter?.completed_at ?? submission.completed_at),
    declinedAt: parseDate(submitter?.declined_at),
  };
}

async function refreshEnvelopeStatus(envelopeId: string, db: DocumentsDb = prisma) {
  const recipients = await db.documentRecipient.findMany({
    where: { envelopeId },
    select: { status: true },
  });

  if (recipients.length === 0) {
    return;
  }

  const statuses = recipients.map((recipient) => recipient.status);
  const status =
    statuses.every((value) => value === "completed")
      ? "completed"
      : statuses.some((value) => value === "failed")
        ? "failed"
        : statuses.some((value) => value === "declined")
          ? "declined"
          : statuses.some((value) => value === "expired")
            ? "expired"
            : statuses.some((value) => value === "sent" || value === "opened" || value === "completed")
              ? "sent"
              : "pending";

  await db.documentEnvelope.update({
    where: { id: envelopeId },
    data: { status },
  });
}

export async function sendEmployeeDocuments(
  userId: string,
  organizationId: string,
  input: SendEmployeeDocumentsInput,
  db: DocumentsDb = prisma
) {
  const context = await getActorContext(userId, organizationId, db);
  requirePermission(context, PERMISSIONS.DOCUMENTS_EMPLOYEE_SEND);

  const employeeId = readTrimmedString(input.employeeId);
  const templateIds = dedupeIds(input.templateIds, "templateIds");
  const purpose = normalizePurpose(input.purpose);

  if (!employeeId) {
    throw new HttpError(400, "employeeId is required.");
  }

  if (purpose === "external_signature") {
    throw new HttpError(400, "external_signature is reserved for a later phase.");
  }

  const employee = await getAccessibleEmployee(employeeId, context, db);
  const signerName = `${employee.firstName} ${employee.lastName}`.trim();

  if (!employee.email) {
    throw new HttpError(400, "Employee email is required to send a DocuSeal signature request.");
  }

  const templates = await db.documentTemplate.findMany({
    where: {
      id: {
        in: templateIds,
      },
      organizationId,
      status: "active",
      builderStatus: "ready",
      docusealTemplateId: {
        not: null,
      },
      archivedAt: null,
    },
  });

  if (templates.length !== templateIds.length) {
    throw new HttpError(400, "One or more templates are not active and ready in this organization.");
  }

  const messageSubject = readOptionalString(input.messageSubject);
  const messageBody = readOptionalString(input.messageBody);

  const envelope = await db.documentEnvelope.create({
    data: {
      id: randomUUID(),
      organizationId,
      purpose,
      status: "pending",
      requestedByUserId: userId,
      messageSubject,
      messageBody,
      items: {
        create: templates.map((template) => ({
          id: randomUUID(),
          templateId: template.id,
          docusealTemplateIdSnapshot: requireReadyDocusealTemplateId(template),
          titleSnapshot: template.title,
          categorySnapshot: template.category,
        })),
      },
    },
    include: {
      items: true,
    },
  });

  const recipients = [];

  for (const item of envelope.items) {
    const template = templates.find((candidate) => candidate.id === item.templateId);

    if (!template) {
      continue;
    }

    const recipient = await db.documentRecipient.create({
      data: {
        id: randomUUID(),
        organizationId,
        envelopeId: envelope.id,
        envelopeItemId: item.id,
        recipientType: "employee",
        employeeId: employee.id,
        signerName,
        signerEmail: employee.email,
        status: "pending",
      },
      include: {
        envelope: true,
        envelopeItem: {
          include: {
            template: true,
          },
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        signedDocuments: true,
      },
    });

    try {
      const submission = await createDocusealSubmission({
        templateId: normalizeTemplateIdForDocuseal(requireReadyDocusealTemplateId(template)),
        recipientId: recipient.id,
        signerName,
        signerEmail: employee.email,
        messageSubject,
        messageBody,
      });
      const update = getRecipientUpdateFromDocuseal(submission);
      const updatedRecipient = await db.documentRecipient.update({
        where: { id: recipient.id },
        data: update,
        include: {
          envelope: true,
          envelopeItem: {
            include: {
              template: true,
            },
          },
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          signedDocuments: true,
        },
      });

      await recordAppEvent(
        {
          organizationId,
          actorUserId: userId,
          envelopeId: envelope.id,
          recipientId: recipient.id,
          templateId: template.id,
          employeeId: employee.id,
          eventType: "document_recipient.sent",
          payload: { docusealSubmissionId: update.docusealSubmissionId },
        },
        db
      );
      recipients.push(updatedRecipient);
    } catch (error) {
      await db.documentRecipient.update({
        where: { id: recipient.id },
        data: {
          status: "failed",
          docusealStatus: "failed",
        },
      });
      await recordAppEvent(
        {
          organizationId,
          actorUserId: userId,
          envelopeId: envelope.id,
          recipientId: recipient.id,
          templateId: template.id,
          employeeId: employee.id,
          eventType: "document_recipient.failed",
          payload: { error: error instanceof Error ? error.message : "Unknown send failure" },
        },
        db
      );
      await refreshEnvelopeStatus(envelope.id, db);
      throw error;
    }
  }

  await refreshEnvelopeStatus(envelope.id, db);

  return {
    envelopeId: envelope.id,
    recipients: recipients.map(serializeRecipient),
  };
}

export async function listEmployeeDocuments(
  userId: string,
  organizationId: string,
  employeeId: string,
  db: DocumentsDb = prisma
) {
  const context = await getActorContext(userId, organizationId, db);
  requirePermission(context, PERMISSIONS.DOCUMENTS_EMPLOYEE_READ);
  await getAccessibleEmployee(employeeId, context, db);

  const recipients = await db.documentRecipient.findMany({
    where: {
      organizationId,
      recipientType: "employee",
      employeeId,
    },
    include: {
      envelope: true,
      envelopeItem: {
        include: {
          template: true,
        },
      },
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      signedDocuments: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    recipients: recipients.map(serializeRecipient),
  };
}

export async function listDocumentRecipients(userId: string, organizationId: string, db: DocumentsDb = prisma) {
  const context = await getActorContext(userId, organizationId, db);
  requirePermission(context, PERMISSIONS.DOCUMENTS_EMPLOYEE_READ);

  const recipients = await db.documentRecipient.findMany({
    where: {
      organizationId,
      recipientType: "employee",
      ...buildEmployeeRecipientWhere(context),
    },
    include: {
      envelope: true,
      envelopeItem: {
        include: {
          template: true,
        },
      },
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      signedDocuments: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    recipients: recipients.map(serializeRecipient),
  };
}

function readFilterDate(value: unknown, fieldName: string): Date | null {
  const raw = readTrimmedString(value);

  if (!raw) {
    return null;
  }

  const parsed = parseDate(raw);

  if (!parsed) {
    throw new HttpError(400, `${fieldName} must be a valid date.`);
  }

  return parsed;
}

function buildExternalFilters(input: ListExternalDocumentsInput): Prisma.DocumentRecipientWhereInput {
  const name = readTrimmedString(input.name);
  const email = readTrimmedString(input.email);
  const company = readTrimmedString(input.company);
  const group = readTrimmedString(input.group);
  const propertyId = readTrimmedString(input.propertyId);
  const isGeneral = readBoolean(input.isGeneral);
  const status = readTrimmedString(input.status);
  const templateId = readTrimmedString(input.templateId);
  const sentFrom = readFilterDate(input.sentFrom, "sentFrom");
  const sentTo = readFilterDate(input.sentTo, "sentTo");
  const signedFrom = readFilterDate(input.signedFrom, "signedFrom");
  const signedTo = readFilterDate(input.signedTo, "signedTo");

  return {
    ...(name
      ? {
          externalName: {
            contains: name,
            mode: "insensitive",
          },
        }
      : {}),
    ...(email
      ? {
          externalEmail: {
            contains: email,
            mode: "insensitive",
          },
        }
      : {}),
    ...(company
      ? {
          externalCompany: {
            contains: company,
            mode: "insensitive",
          },
        }
      : {}),
    ...(group
      ? {
          externalGroup: {
            contains: group,
            mode: "insensitive",
          },
        }
      : {}),
    ...(propertyId ? { propertyId } : {}),
    ...(isGeneral === null ? {} : { isGeneral }),
    ...(status ? { status } : {}),
    ...(templateId
      ? {
          envelopeItem: {
            templateId,
          },
        }
      : {}),
    ...(sentFrom || sentTo
      ? {
          sentAt: {
            ...(sentFrom ? { gte: sentFrom } : {}),
            ...(sentTo ? { lte: sentTo } : {}),
          },
        }
      : {}),
    ...(signedFrom || signedTo
      ? {
          completedAt: {
            ...(signedFrom ? { gte: signedFrom } : {}),
            ...(signedTo ? { lte: signedTo } : {}),
          },
        }
      : {}),
  };
}

const recipientInclude = {
  envelope: true,
  envelopeItem: {
    include: {
      template: true,
    },
  },
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  property: {
    select: {
      id: true,
      name: true,
      organizationId: true,
    },
  },
  signedDocuments: true,
} satisfies Prisma.DocumentRecipientInclude;

const recipientDetailInclude = {
  ...recipientInclude,
  events: {
    orderBy: {
      occurredAt: "desc",
    },
    take: 25,
  },
} satisfies Prisma.DocumentRecipientInclude;

export async function sendExternalDocument(
  userId: string,
  organizationId: string,
  input: SendExternalDocumentInput,
  db: DocumentsDb = prisma
) {
  const context = await getActorContext(userId, organizationId, db);
  requirePermission(context, PERMISSIONS.DOCUMENTS_EXTERNAL_SEND);

  const templateId = readTrimmedString(input.templateId);
  const externalName = readTrimmedString(input.externalName);
  const externalEmail = readTrimmedString(input.externalEmail);

  if (!templateId) {
    throw new HttpError(400, "templateId is required.");
  }

  if (!externalName) {
    throw new HttpError(400, "externalName is required.");
  }

  if (!externalEmail) {
    throw new HttpError(400, "externalEmail is required.");
  }

  const scope = await resolveExternalScope(input, context, db);
  const template = await db.documentTemplate.findFirst({
    where: {
      id: templateId,
      organizationId,
      status: "active",
      builderStatus: "ready",
      docusealTemplateId: {
        not: null,
      },
      archivedAt: null,
    },
  });

  if (!template) {
    throw new HttpError(400, "Template is not active and ready in this organization.");
  }

  const messageSubject = readOptionalString(input.messageSubject);
  const messageBody = readOptionalString(input.messageBody);

  const envelope = await db.documentEnvelope.create({
    data: {
      id: randomUUID(),
      organizationId,
      purpose: "external_signature",
      status: "pending",
      requestedByUserId: userId,
      messageSubject,
      messageBody,
      items: {
        create: [
          {
            id: randomUUID(),
            templateId: template.id,
            docusealTemplateIdSnapshot: requireReadyDocusealTemplateId(template),
            titleSnapshot: template.title,
            categorySnapshot: template.category,
          },
        ],
      },
    },
    include: {
      items: true,
    },
  });
  const envelopeItem = envelope.items[0];

  const recipient = await db.documentRecipient.create({
    data: {
      id: randomUUID(),
      organizationId,
      envelopeId: envelope.id,
      envelopeItemId: envelopeItem.id,
      recipientType: "external",
      propertyId: scope.propertyId,
      externalName,
      externalEmail,
      externalCompany: readOptionalString(input.externalCompany),
      externalGroup: readOptionalString(input.externalGroup),
      externalPhone: readOptionalString(input.externalPhone),
      isGeneral: scope.isGeneral,
      notes: readOptionalString(input.notes),
      signerName: externalName,
      signerEmail: externalEmail,
      status: "pending",
    },
    include: recipientInclude,
  });

  try {
    const submission = await createDocusealSubmission({
      templateId: normalizeTemplateIdForDocuseal(requireReadyDocusealTemplateId(template)),
      recipientId: recipient.id,
      signerName: externalName,
      signerEmail: externalEmail,
      messageSubject,
      messageBody,
    });
    const update = getRecipientUpdateFromDocuseal(submission);
    const updatedRecipient = await db.documentRecipient.update({
      where: { id: recipient.id },
      data: update,
      include: recipientInclude,
    });

    await recordAppEvent(
      {
        organizationId,
        actorUserId: userId,
        envelopeId: envelope.id,
        recipientId: recipient.id,
        templateId: template.id,
        eventType: "document_recipient.sent",
        payload: { docusealSubmissionId: update.docusealSubmissionId },
      },
      db
    );
    await refreshEnvelopeStatus(envelope.id, db);

    return {
      envelopeId: envelope.id,
      recipients: [serializeRecipient(updatedRecipient)],
    };
  } catch (error) {
    await db.documentRecipient.update({
      where: { id: recipient.id },
      data: {
        status: "failed",
        docusealStatus: "failed",
      },
    });
    await recordAppEvent(
      {
        organizationId,
        actorUserId: userId,
        envelopeId: envelope.id,
        recipientId: recipient.id,
        templateId: template.id,
        eventType: "document_recipient.failed",
        payload: { error: error instanceof Error ? error.message : "Unknown send failure" },
      },
      db
    );
    await refreshEnvelopeStatus(envelope.id, db);
    throw error;
  }
}

export async function listExternalDocuments(
  userId: string,
  organizationId: string,
  input: ListExternalDocumentsInput,
  db: DocumentsDb = prisma
) {
  const context = await getActorContext(userId, organizationId, db);
  requirePermission(context, PERMISSIONS.DOCUMENTS_EXTERNAL_READ);

  const recipients = await db.documentRecipient.findMany({
    where: {
      organizationId,
      recipientType: "external",
      AND: [buildExternalRecipientWhere(context), buildExternalFilters(input)],
    },
    include: recipientInclude,
    orderBy: { createdAt: "desc" },
  });

  return {
    recipients: recipients.map(serializeRecipient),
  };
}

export async function getExternalDocumentRecipient(
  userId: string,
  organizationId: string,
  recipientId: string,
  db: DocumentsDb = prisma
) {
  const context = await getActorContext(userId, organizationId, db);
  requirePermission(context, PERMISSIONS.DOCUMENTS_EXTERNAL_READ);

  const recipient = await db.documentRecipient.findFirst({
    where: {
      id: recipientId,
      organizationId,
      recipientType: "external",
      ...buildExternalRecipientWhere(context),
    },
    include: recipientDetailInclude,
  });

  if (!recipient) {
    throw new HttpError(404, "External signature not found.");
  }

  return {
    recipient: serializeRecipient(recipient),
  };
}

export async function patchExternalDocumentRecipient(
  userId: string,
  organizationId: string,
  recipientId: string,
  input: PatchExternalRecipientInput,
  db: DocumentsDb = prisma
) {
  const context = await getActorContext(userId, organizationId, db);
  requirePermission(context, PERMISSIONS.DOCUMENTS_EXTERNAL_MANAGE);

  if (input.externalName !== undefined || input.externalEmail !== undefined) {
    throw new HttpError(400, "Signer name and email cannot be changed after sending.");
  }

  const existing = await db.documentRecipient.findFirst({
    where: {
      id: recipientId,
      organizationId,
      recipientType: "external",
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    throw new HttpError(404, "External signature not found.");
  }

  const hasScopePatch = input.isGeneral !== undefined || input.propertyId !== undefined;
  const scope = hasScopePatch ? await resolveExternalScope(input, context, db) : null;

  const recipient = await db.documentRecipient.update({
    where: { id: recipientId },
    data: {
      ...(input.externalCompany !== undefined ? { externalCompany: readOptionalString(input.externalCompany) } : {}),
      ...(input.externalGroup !== undefined ? { externalGroup: readOptionalString(input.externalGroup) } : {}),
      ...(input.externalPhone !== undefined ? { externalPhone: readOptionalString(input.externalPhone) } : {}),
      ...(input.notes !== undefined ? { notes: readOptionalString(input.notes) } : {}),
      ...(scope ? { isGeneral: scope.isGeneral, propertyId: scope.propertyId } : {}),
    },
    include: recipientDetailInclude,
  });

  await recordAppEvent(
    {
      organizationId,
      actorUserId: userId,
      envelopeId: recipient.envelopeId,
      recipientId: recipient.id,
      templateId: recipient.envelopeItem.templateId,
      eventType: "document_recipient.external_metadata_updated",
      payload: {
        updatedFields: Object.keys(input),
      },
    },
    db
  );

  return {
    recipient: serializeRecipient(recipient),
  };
}

function getWebhookSubmitters(payload: DocusealWebhookPayload): DocusealSubmitterResponse[] {
  return payload.data?.submitters?.length ? payload.data.submitters : [];
}

export function buildDocusealWebhookIdempotencyKey(input: {
  eventType: string;
  submissionId: string | number | null | undefined;
  submitterId?: string | number | null;
  timestamp: string;
}): string {
  return [
    "docuseal",
    input.eventType,
    input.submissionId === undefined || input.submissionId === null ? "submission" : String(input.submissionId),
    input.submitterId === undefined || input.submitterId === null ? "all" : String(input.submitterId),
    input.timestamp,
  ].join(":");
}

export function extractSignedDocumentMetadata(input: {
  submission: DocusealSubmissionResponse;
  submitter: DocusealSubmitterResponse | null;
}) {
  const firstDocument = input.submitter?.documents?.[0] ?? input.submission.documents?.[0] ?? null;

  return {
    documentName: firstDocument?.name ?? null,
    documentUrl: firstDocument?.url ?? null,
    auditLogUrl: input.submission.audit_log_url ?? null,
    combinedDocumentUrl: input.submission.combined_document_url ?? null,
    completedAt: parseDate(input.submitter?.completed_at ?? input.submission.completed_at),
  };
}

function findStatusDate(status: DocumentRecipientStatus, submitter: DocusealSubmitterResponse | null, submission: DocusealSubmissionResponse) {
  if (status === "opened") {
    return { openedAt: parseDate(submitter?.opened_at) ?? new Date() };
  }

  if (status === "completed") {
    return { completedAt: parseDate(submitter?.completed_at ?? submission.completed_at) ?? new Date() };
  }

  if (status === "declined") {
    return { declinedAt: parseDate(submitter?.declined_at) ?? new Date() };
  }

  if (status === "expired") {
    return { expiredAt: new Date() };
  }

  return {};
}

function safeSecretEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyDocusealWebhookSecret(headers: Record<string, string | string[] | undefined>) {
  if (!env.docusealWebhookSecret) {
    return;
  }

  const rawAuthorization = headers.authorization;
  const authorization = Array.isArray(rawAuthorization) ? rawAuthorization[0] : rawAuthorization;
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
  const headerSecret = headers["x-docuseal-secret"] ?? headers["x-webhook-secret"];
  const secret = Array.isArray(headerSecret) ? headerSecret[0] : headerSecret;
  const suppliedSecret = secret ?? bearerToken;

  if (!suppliedSecret || !safeSecretEquals(suppliedSecret, env.docusealWebhookSecret)) {
    throw new HttpError(401, "Invalid DocuSeal webhook secret.");
  }
}

export async function processDocusealWebhook(payload: DocusealWebhookPayload, db: DocumentsDb = prisma) {
  const eventType = readTrimmedString(payload.event_type) ?? "docuseal.unknown";
  const timestamp = readTrimmedString(payload.timestamp) ?? new Date().toISOString();
  const occurredAt = parseDate(timestamp) ?? new Date();
  const submission = payload.data ?? {};
  const submitters = getWebhookSubmitters(payload);
  const targets = submitters.length > 0 ? submitters : [null];
  const processedRecipients: string[] = [];

  for (const submitter of targets) {
    const idempotencyKey = buildDocusealWebhookIdempotencyKey({
      eventType,
      submissionId: submission.id,
      submitterId: submitter?.id ?? null,
      timestamp,
    });

    const existingEvent = await db.documentEvent.findUnique({
      where: { idempotencyKey },
      select: { id: true },
    });

    if (existingEvent) {
      continue;
    }

    const recipient = await db.documentRecipient.findFirst({
      where: {
        OR: [
          ...(submitter?.external_id ? [{ id: submitter.external_id }] : []),
          ...(submitter?.id !== undefined ? [{ docusealSubmitterId: String(submitter.id) }] : []),
          ...(submission.id !== undefined ? [{ docusealSubmissionId: String(submission.id) }] : []),
          ...(submitter?.slug ? [{ docusealSubmitterSlug: submitter.slug }] : []),
          ...(submission.slug ? [{ docusealSubmissionSlug: submission.slug }] : []),
        ],
      },
      include: {
        envelopeItem: true,
      },
    });

    if (!recipient) {
      await db.documentEvent.create({
        data: {
          id: randomUUID(),
          source: "docuseal",
          eventType,
          idempotencyKey,
          processingStatus: "ignored",
          payload: payload as Prisma.InputJsonValue,
          occurredAt,
          processedAt: new Date(),
        },
      });
      continue;
    }

    const status = normalizeDocusealRecipientStatus(submitter?.status ?? submission.status);
    await db.documentEvent.create({
      data: {
        id: randomUUID(),
        organizationId: recipient.organizationId,
        envelopeId: recipient.envelopeId,
        recipientId: recipient.id,
        templateId: recipient.envelopeItem.templateId,
        employeeId: recipient.employeeId,
        source: "docuseal",
        eventType,
        idempotencyKey,
        processingStatus: "processed",
        payload: payload as Prisma.InputJsonValue,
        occurredAt,
        processedAt: new Date(),
      },
    });

    await db.documentRecipient.update({
      where: { id: recipient.id },
      data: {
        docusealStatus: submitter?.status ?? submission.status ?? null,
        status,
        ...(submitter?.id !== undefined ? { docusealSubmitterId: String(submitter.id) } : {}),
        ...(submitter?.slug ? { docusealSubmitterSlug: submitter.slug } : {}),
        ...(submission.id !== undefined ? { docusealSubmissionId: String(submission.id) } : {}),
        ...(submission.slug ? { docusealSubmissionSlug: submission.slug } : {}),
        ...findStatusDate(status, submitter, submission),
      },
    });

    if (status === "completed" || submission.status === "completed") {
      const signedDocument = extractSignedDocumentMetadata({ submission, submitter });

      await db.signedDocument.upsert({
        where: {
          recipientId_templateId: {
            recipientId: recipient.id,
            templateId: recipient.envelopeItem.templateId,
          },
        },
        update: {
          documentName: signedDocument.documentName,
          documentUrl: signedDocument.documentUrl,
          auditLogUrl: signedDocument.auditLogUrl,
          combinedDocumentUrl: signedDocument.combinedDocumentUrl,
          completedAt: signedDocument.completedAt ?? new Date(),
          metadata: payload as Prisma.InputJsonValue,
        },
        create: {
          id: randomUUID(),
          organizationId: recipient.organizationId,
          recipientId: recipient.id,
          templateId: recipient.envelopeItem.templateId,
          employeeId: recipient.employeeId,
          documentName: signedDocument.documentName,
          documentUrl: signedDocument.documentUrl,
          auditLogUrl: signedDocument.auditLogUrl,
          combinedDocumentUrl: signedDocument.combinedDocumentUrl,
          completedAt: signedDocument.completedAt ?? new Date(),
          metadata: payload as Prisma.InputJsonValue,
        },
      });
    }

    await refreshEnvelopeStatus(recipient.envelopeId, db);
    processedRecipients.push(recipient.id);
  }

  return {
    received: true,
    processedRecipients,
  };
}
