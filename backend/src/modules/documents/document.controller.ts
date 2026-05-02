import type { RequestHandler } from "express";

import { HttpError } from "../../lib/http-error";
import { getAuthenticatedUser } from "../../middleware/authenticate-client";
import { syncAuthenticatedUser } from "../../services/user-sync.service";
import {
  createDocumentTemplate,
  createDocumentTemplateFromSystem,
  createDocumentTemplateFromUpload,
  deleteDocumentTemplate,
  getExternalDocumentRecipient,
  listExternalDocuments,
  listDocumentRecipients,
  listDocumentTemplates,
  listEmployeeDocuments,
  openDocumentTemplateBuilder,
  patchDocumentTemplate,
  patchExternalDocumentRecipient,
  processDocusealWebhook,
  sendEmployeeDocuments,
  sendExternalDocument,
  syncDocumentTemplateFromDocuseal,
  verifyDocusealWebhookSecret,
} from "./document.service";

function readRequiredParam(value: unknown, fieldName: string): string {
  const normalized = typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

  if (!normalized) {
    throw new HttpError(400, `${fieldName} is required.`);
  }

  return normalized;
}

async function readLocalUser(req: Parameters<RequestHandler>[0]) {
  const authUser = getAuthenticatedUser(req);
  return syncAuthenticatedUser(authUser);
}

export const listDocumentTemplatesController: RequestHandler = async (req, res, next) => {
  try {
    const orgId = readRequiredParam(req.params.orgId, "orgId");
    const localUser = await readLocalUser(req);
    res.json(await listDocumentTemplates(localUser.id, orgId));
  } catch (error) {
    next(error);
  }
};

export const createDocumentTemplateController: RequestHandler = async (req, res, next) => {
  try {
    const orgId = readRequiredParam(req.params.orgId, "orgId");
    const localUser = await readLocalUser(req);
    const result = await createDocumentTemplate(localUser.id, orgId, req.body ?? {});
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const createDocumentTemplateFromUploadController: RequestHandler = async (req, res, next) => {
  try {
    const orgId = readRequiredParam(req.params.orgId, "orgId");
    const localUser = await readLocalUser(req);
    const result = await createDocumentTemplateFromUpload(localUser.id, orgId, {
      ...(req.body ?? {}),
      file: req.file
        ? {
            buffer: req.file.buffer,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
          }
        : null,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const createDocumentTemplateFromSystemController: RequestHandler = async (req, res, next) => {
  try {
    const orgId = readRequiredParam(req.params.orgId, "orgId");
    const systemTemplateId = readRequiredParam(req.params.systemTemplateId, "systemTemplateId");
    const localUser = await readLocalUser(req);
    const result = await createDocumentTemplateFromSystem(localUser.id, orgId, systemTemplateId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const openDocumentTemplateBuilderController: RequestHandler = async (req, res, next) => {
  try {
    const orgId = readRequiredParam(req.params.orgId, "orgId");
    const templateId = readRequiredParam(req.params.templateId, "templateId");
    const localUser = await readLocalUser(req);
    res.json(await openDocumentTemplateBuilder(localUser.id, orgId, templateId));
  } catch (error) {
    next(error);
  }
};

export const createDocumentTemplateBuilderTokenController: RequestHandler = async (req, res, next) => {
  try {
    const orgId = readRequiredParam(req.params.orgId, "orgId");
    const templateId = readRequiredParam(req.params.templateId, "templateId");
    const localUser = await readLocalUser(req);
    const result = await openDocumentTemplateBuilder(localUser.id, orgId, templateId);
    res.json(result.builder);
  } catch (error) {
    next(error);
  }
};

export const syncDocumentTemplateFromDocusealController: RequestHandler = async (req, res, next) => {
  try {
    const orgId = readRequiredParam(req.params.orgId, "orgId");
    const templateId = readRequiredParam(req.params.templateId, "templateId");
    const localUser = await readLocalUser(req);
    res.json(await syncDocumentTemplateFromDocuseal(localUser.id, orgId, templateId, req.body ?? {}));
  } catch (error) {
    next(error);
  }
};

export const patchDocumentTemplateController: RequestHandler = async (req, res, next) => {
  try {
    const orgId = readRequiredParam(req.params.orgId, "orgId");
    const templateId = readRequiredParam(req.params.templateId, "templateId");
    const localUser = await readLocalUser(req);
    res.json(await patchDocumentTemplate(localUser.id, orgId, templateId, req.body ?? {}));
  } catch (error) {
    next(error);
  }
};

export const deleteDocumentTemplateController: RequestHandler = async (req, res, next) => {
  try {
    const orgId = readRequiredParam(req.params.orgId, "orgId");
    const templateId = readRequiredParam(req.params.templateId, "templateId");
    const localUser = await readLocalUser(req);
    res.json(await deleteDocumentTemplate(localUser.id, orgId, templateId));
  } catch (error) {
    next(error);
  }
};

export const sendEmployeeDocumentsController: RequestHandler = async (req, res, next) => {
  try {
    const orgId = readRequiredParam(req.params.orgId, "orgId");
    const localUser = await readLocalUser(req);
    const result = await sendEmployeeDocuments(localUser.id, orgId, req.body ?? {});
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const sendExternalDocumentController: RequestHandler = async (req, res, next) => {
  try {
    const orgId = readRequiredParam(req.params.orgId, "orgId");
    const localUser = await readLocalUser(req);
    const result = await sendExternalDocument(localUser.id, orgId, req.body ?? {});
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const listEmployeeDocumentsController: RequestHandler = async (req, res, next) => {
  try {
    const orgId = readRequiredParam(req.params.orgId, "orgId");
    const employeeId = readRequiredParam(req.params.employeeId, "employeeId");
    const localUser = await readLocalUser(req);
    res.json(await listEmployeeDocuments(localUser.id, orgId, employeeId));
  } catch (error) {
    next(error);
  }
};

export const listExternalDocumentsController: RequestHandler = async (req, res, next) => {
  try {
    const orgId = readRequiredParam(req.params.orgId, "orgId");
    const localUser = await readLocalUser(req);
    res.json(await listExternalDocuments(localUser.id, orgId, req.query ?? {}));
  } catch (error) {
    next(error);
  }
};

export const getExternalDocumentRecipientController: RequestHandler = async (req, res, next) => {
  try {
    const orgId = readRequiredParam(req.params.orgId, "orgId");
    const recipientId = readRequiredParam(req.params.recipientId, "recipientId");
    const localUser = await readLocalUser(req);
    res.json(await getExternalDocumentRecipient(localUser.id, orgId, recipientId));
  } catch (error) {
    next(error);
  }
};

export const patchExternalDocumentRecipientController: RequestHandler = async (req, res, next) => {
  try {
    const orgId = readRequiredParam(req.params.orgId, "orgId");
    const recipientId = readRequiredParam(req.params.recipientId, "recipientId");
    const localUser = await readLocalUser(req);
    res.json(await patchExternalDocumentRecipient(localUser.id, orgId, recipientId, req.body ?? {}));
  } catch (error) {
    next(error);
  }
};

export const listDocumentRecipientsController: RequestHandler = async (req, res, next) => {
  try {
    const orgId = readRequiredParam(req.params.orgId, "orgId");
    const localUser = await readLocalUser(req);
    res.json(await listDocumentRecipients(localUser.id, orgId));
  } catch (error) {
    next(error);
  }
};

export const handleDocusealWebhookController: RequestHandler = async (req, res, next) => {
  try {
    verifyDocusealWebhookSecret(req.headers);
    res.status(200).json(await processDocusealWebhook(req.body ?? {}));
  } catch (error) {
    next(error);
  }
};
