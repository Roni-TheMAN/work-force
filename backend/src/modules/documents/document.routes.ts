import { Router } from "express";
import multer from "multer";

import { requireClientAuth } from "../../middleware/authenticate-client";
import {
  createDocumentTemplateController,
  createDocumentTemplateBuilderTokenController,
  createDocumentTemplateFromSystemController,
  createDocumentTemplateFromUploadController,
  deleteDocumentTemplateController,
  getExternalDocumentRecipientController,
  listExternalDocumentsController,
  listDocumentRecipientsController,
  listDocumentTemplatesController,
  listEmployeeDocumentsController,
  openDocumentTemplateBuilderController,
  patchDocumentTemplateController,
  patchExternalDocumentRecipientController,
  sendEmployeeDocumentsController,
  sendExternalDocumentController,
  syncDocumentTemplateFromDocusealController,
} from "./document.controller";

export const clientDocumentRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

clientDocumentRouter.get("/orgs/:orgId/documents/templates", requireClientAuth, listDocumentTemplatesController);
clientDocumentRouter.post(
  "/orgs/:orgId/documents/templates/from-upload",
  requireClientAuth,
  upload.single("file"),
  createDocumentTemplateFromUploadController
);
clientDocumentRouter.post(
  "/orgs/:orgId/documents/templates/from-system/:systemTemplateId",
  requireClientAuth,
  createDocumentTemplateFromSystemController
);
clientDocumentRouter.post("/orgs/:orgId/documents/templates", requireClientAuth, createDocumentTemplateController);
clientDocumentRouter.post(
  "/orgs/:orgId/documents/templates/:templateId/builder-token",
  requireClientAuth,
  createDocumentTemplateBuilderTokenController
);
clientDocumentRouter.post(
  "/orgs/:orgId/documents/templates/:templateId/open-builder",
  requireClientAuth,
  openDocumentTemplateBuilderController
);
clientDocumentRouter.patch(
  "/orgs/:orgId/documents/templates/:templateId/docuseal-sync",
  requireClientAuth,
  syncDocumentTemplateFromDocusealController
);
clientDocumentRouter.patch(
  "/orgs/:orgId/documents/templates/:templateId",
  requireClientAuth,
  patchDocumentTemplateController
);
clientDocumentRouter.delete(
  "/orgs/:orgId/documents/templates/:templateId",
  requireClientAuth,
  deleteDocumentTemplateController
);
clientDocumentRouter.post("/orgs/:orgId/documents/send/employee", requireClientAuth, sendEmployeeDocumentsController);
clientDocumentRouter.post("/orgs/:orgId/documents/send/external", requireClientAuth, sendExternalDocumentController);
clientDocumentRouter.get(
  "/orgs/:orgId/documents/employees/:employeeId",
  requireClientAuth,
  listEmployeeDocumentsController
);
clientDocumentRouter.get("/orgs/:orgId/documents/external", requireClientAuth, listExternalDocumentsController);
clientDocumentRouter.get(
  "/orgs/:orgId/documents/external/:recipientId",
  requireClientAuth,
  getExternalDocumentRecipientController
);
clientDocumentRouter.patch(
  "/orgs/:orgId/documents/external/:recipientId",
  requireClientAuth,
  patchExternalDocumentRecipientController
);
clientDocumentRouter.get("/orgs/:orgId/documents/recipients", requireClientAuth, listDocumentRecipientsController);
