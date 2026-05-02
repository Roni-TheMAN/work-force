import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDocusealWebhookIdempotencyKey,
  canAccessEmployeeDocuments,
  canAccessExternalSignature,
  extractSignedDocumentMetadata,
  getTemplateDeleteMode,
  normalizeDocusealRecipientStatus,
} from "./document.service";

test("template delete mode archives templates that have been sent", () => {
  assert.equal(getTemplateDeleteMode(0), "delete");
  assert.equal(getTemplateDeleteMode(1), "archive");
  assert.equal(getTemplateDeleteMode(7), "archive");
});

test("employee document access supports own employee and property-scoped managers", () => {
  assert.equal(
    canAccessEmployeeDocuments({
      actorUserId: "user-1",
      canBypassEmployeeScope: false,
      employeeUserId: "user-1",
      employeePropertyIds: [],
      scopedPropertyIds: null,
    }),
    true
  );

  assert.equal(
    canAccessEmployeeDocuments({
      actorUserId: "manager-1",
      canBypassEmployeeScope: false,
      employeeUserId: null,
      employeePropertyIds: ["property-2"],
      scopedPropertyIds: ["property-1", "property-2"],
    }),
    true
  );

  assert.equal(
    canAccessEmployeeDocuments({
      actorUserId: "manager-1",
      canBypassEmployeeScope: false,
      employeeUserId: null,
      employeePropertyIds: ["property-3"],
      scopedPropertyIds: ["property-1", "property-2"],
    }),
    false
  );
});

test("external signature access separates property-scoped and general documents", () => {
  assert.equal(
    canAccessExternalSignature({
      canManageAllExternal: true,
      isGeneral: true,
      propertyId: null,
      scopedPropertyIds: null,
    }),
    true
  );

  assert.equal(
    canAccessExternalSignature({
      canManageAllExternal: false,
      isGeneral: false,
      propertyId: "property-1",
      scopedPropertyIds: ["property-1"],
    }),
    true
  );

  assert.equal(
    canAccessExternalSignature({
      canManageAllExternal: false,
      isGeneral: true,
      propertyId: null,
      scopedPropertyIds: ["property-1"],
    }),
    false
  );

  assert.equal(
    canAccessExternalSignature({
      canManageAllExternal: false,
      isGeneral: false,
      propertyId: "property-2",
      scopedPropertyIds: ["property-1"],
    }),
    false
  );
});

test("DocuSeal statuses normalize to recipient statuses", () => {
  assert.equal(normalizeDocusealRecipientStatus("awaiting"), "sent");
  assert.equal(normalizeDocusealRecipientStatus("opened"), "opened");
  assert.equal(normalizeDocusealRecipientStatus("completed"), "completed");
  assert.equal(normalizeDocusealRecipientStatus("declined"), "declined");
  assert.equal(normalizeDocusealRecipientStatus("expired"), "expired");
  assert.equal(normalizeDocusealRecipientStatus("unexpected"), "pending");
});

test("DocuSeal webhook idempotency keys are stable for retries", () => {
  const input = {
    eventType: "submission.completed",
    submissionId: 123,
    submitterId: 456,
    timestamp: "2026-04-30T12:00:00.000Z",
  };

  assert.equal(buildDocusealWebhookIdempotencyKey(input), buildDocusealWebhookIdempotencyKey(input));
});

test("signed document metadata prefers submitter documents and preserves audit URLs", () => {
  const metadata = extractSignedDocumentMetadata({
    submission: {
      id: 1,
      audit_log_url: "https://example.com/audit.pdf",
      combined_document_url: "https://example.com/combined.pdf",
      completed_at: "2026-04-30T12:00:00.000Z",
      documents: [{ name: "submission.pdf", url: "https://example.com/submission.pdf" }],
    },
    submitter: {
      id: 2,
      completed_at: "2026-04-30T12:01:00.000Z",
      documents: [{ name: "signed.pdf", url: "https://example.com/signed.pdf" }],
    },
  });

  assert.equal(metadata.documentName, "signed.pdf");
  assert.equal(metadata.documentUrl, "https://example.com/signed.pdf");
  assert.equal(metadata.auditLogUrl, "https://example.com/audit.pdf");
  assert.equal(metadata.combinedDocumentUrl, "https://example.com/combined.pdf");
  assert.equal(metadata.completedAt?.toISOString(), "2026-04-30T12:01:00.000Z");
});
