CREATE TABLE "document_templates" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "docuseal_template_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "archived_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_templates_source_type_check" CHECK ("source_type" IN ('docuseal')),
  CONSTRAINT "document_templates_status_check" CHECK ("status" IN ('active', 'inactive', 'archived'))
);

CREATE TABLE "document_envelopes" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "purpose" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "requested_by_user_id" UUID NOT NULL,
  "message_subject" TEXT,
  "message_body" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "document_envelopes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_envelopes_purpose_check" CHECK ("purpose" IN ('employee_onboarding', 'employee_general', 'external_signature')),
  CONSTRAINT "document_envelopes_status_check" CHECK ("status" IN ('pending', 'sent', 'completed', 'declined', 'expired', 'failed'))
);

CREATE TABLE "document_envelope_items" (
  "id" UUID NOT NULL,
  "envelope_id" UUID NOT NULL,
  "template_id" UUID NOT NULL,
  "docuseal_template_id_snapshot" TEXT NOT NULL,
  "title_snapshot" TEXT NOT NULL,
  "category_snapshot" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "document_envelope_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_recipients" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "envelope_id" UUID NOT NULL,
  "envelope_item_id" UUID NOT NULL,
  "recipient_type" TEXT NOT NULL,
  "employee_id" UUID,
  "external_name" TEXT,
  "external_email" TEXT,
  "signer_name" TEXT NOT NULL,
  "signer_email" TEXT,
  "docuseal_submission_id" TEXT,
  "docuseal_submission_slug" TEXT,
  "docuseal_submitter_id" TEXT,
  "docuseal_submitter_slug" TEXT,
  "docuseal_signing_url" TEXT,
  "docuseal_status" TEXT,
  "status" TEXT NOT NULL,
  "sent_at" TIMESTAMPTZ(6),
  "opened_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "declined_at" TIMESTAMPTZ(6),
  "expired_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "document_recipients_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_recipients_type_check" CHECK ("recipient_type" IN ('employee', 'external')),
  CONSTRAINT "document_recipients_status_check" CHECK ("status" IN ('pending', 'sent', 'opened', 'completed', 'declined', 'expired', 'failed')),
  CONSTRAINT "document_recipients_employee_required_check" CHECK (
    ("recipient_type" = 'employee' AND "employee_id" IS NOT NULL)
    OR ("recipient_type" = 'external')
  )
);

CREATE TABLE "signed_documents" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "recipient_id" UUID NOT NULL,
  "template_id" UUID NOT NULL,
  "employee_id" UUID,
  "document_name" TEXT,
  "document_url" TEXT,
  "audit_log_url" TEXT,
  "combined_document_url" TEXT,
  "completed_at" TIMESTAMPTZ(6),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "signed_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_events" (
  "id" UUID NOT NULL,
  "organization_id" UUID,
  "envelope_id" UUID,
  "recipient_id" UUID,
  "template_id" UUID,
  "employee_id" UUID,
  "actor_user_id" UUID,
  "source" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "idempotency_key" TEXT,
  "processing_status" TEXT NOT NULL DEFAULT 'processed',
  "error_message" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "occurred_at" TIMESTAMPTZ(6) NOT NULL,
  "processed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "document_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_events_source_check" CHECK ("source" IN ('app', 'docuseal')),
  CONSTRAINT "document_events_processing_status_check" CHECK ("processing_status" IN ('processed', 'ignored', 'failed'))
);

CREATE UNIQUE INDEX "document_templates_organization_id_docuseal_template_id_key"
ON "document_templates"("organization_id", "docuseal_template_id");

CREATE INDEX "document_templates_organization_id_status_idx" ON "document_templates"("organization_id", "status");
CREATE INDEX "document_templates_organization_id_category_idx" ON "document_templates"("organization_id", "category");
CREATE INDEX "document_envelopes_organization_id_created_at_idx" ON "document_envelopes"("organization_id", "created_at");
CREATE INDEX "document_envelopes_requested_by_user_id_idx" ON "document_envelopes"("requested_by_user_id");
CREATE INDEX "document_envelopes_status_idx" ON "document_envelopes"("status");

CREATE UNIQUE INDEX "document_envelope_items_envelope_id_template_id_key"
ON "document_envelope_items"("envelope_id", "template_id");

CREATE INDEX "document_envelope_items_template_id_idx" ON "document_envelope_items"("template_id");
CREATE UNIQUE INDEX "document_recipients_docuseal_submission_id_key" ON "document_recipients"("docuseal_submission_id");
CREATE UNIQUE INDEX "document_recipients_docuseal_submitter_id_key" ON "document_recipients"("docuseal_submitter_id");
CREATE INDEX "document_recipients_organization_id_status_idx" ON "document_recipients"("organization_id", "status");
CREATE INDEX "document_recipients_employee_id_created_at_idx" ON "document_recipients"("employee_id", "created_at");
CREATE INDEX "document_recipients_envelope_id_idx" ON "document_recipients"("envelope_id");
CREATE INDEX "document_recipients_envelope_item_id_idx" ON "document_recipients"("envelope_item_id");

CREATE UNIQUE INDEX "signed_documents_recipient_id_template_id_key"
ON "signed_documents"("recipient_id", "template_id");

CREATE INDEX "signed_documents_organization_id_completed_at_idx" ON "signed_documents"("organization_id", "completed_at");
CREATE INDEX "signed_documents_employee_id_completed_at_idx" ON "signed_documents"("employee_id", "completed_at");
CREATE INDEX "signed_documents_template_id_idx" ON "signed_documents"("template_id");
CREATE UNIQUE INDEX "document_events_idempotency_key_key" ON "document_events"("idempotency_key");
CREATE INDEX "document_events_organization_id_occurred_at_idx" ON "document_events"("organization_id", "occurred_at");
CREATE INDEX "document_events_envelope_id_idx" ON "document_events"("envelope_id");
CREATE INDEX "document_events_recipient_id_idx" ON "document_events"("recipient_id");
CREATE INDEX "document_events_template_id_idx" ON "document_events"("template_id");
CREATE INDEX "document_events_employee_id_idx" ON "document_events"("employee_id");
CREATE INDEX "document_events_source_event_type_idx" ON "document_events"("source", "event_type");

ALTER TABLE "document_templates"
ADD CONSTRAINT "document_templates_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_envelopes"
ADD CONSTRAINT "document_envelopes_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_envelopes"
ADD CONSTRAINT "document_envelopes_requested_by_user_id_fkey"
FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_envelope_items"
ADD CONSTRAINT "document_envelope_items_envelope_id_fkey"
FOREIGN KEY ("envelope_id") REFERENCES "document_envelopes"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_envelope_items"
ADD CONSTRAINT "document_envelope_items_template_id_fkey"
FOREIGN KEY ("template_id") REFERENCES "document_templates"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_recipients"
ADD CONSTRAINT "document_recipients_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_recipients"
ADD CONSTRAINT "document_recipients_envelope_id_fkey"
FOREIGN KEY ("envelope_id") REFERENCES "document_envelopes"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_recipients"
ADD CONSTRAINT "document_recipients_envelope_item_id_fkey"
FOREIGN KEY ("envelope_item_id") REFERENCES "document_envelope_items"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_recipients"
ADD CONSTRAINT "document_recipients_employee_id_fkey"
FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "signed_documents"
ADD CONSTRAINT "signed_documents_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "signed_documents"
ADD CONSTRAINT "signed_documents_recipient_id_fkey"
FOREIGN KEY ("recipient_id") REFERENCES "document_recipients"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "signed_documents"
ADD CONSTRAINT "signed_documents_template_id_fkey"
FOREIGN KEY ("template_id") REFERENCES "document_templates"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "signed_documents"
ADD CONSTRAINT "signed_documents_employee_id_fkey"
FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_events"
ADD CONSTRAINT "document_events_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_events"
ADD CONSTRAINT "document_events_envelope_id_fkey"
FOREIGN KEY ("envelope_id") REFERENCES "document_envelopes"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_events"
ADD CONSTRAINT "document_events_recipient_id_fkey"
FOREIGN KEY ("recipient_id") REFERENCES "document_recipients"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_events"
ADD CONSTRAINT "document_events_template_id_fkey"
FOREIGN KEY ("template_id") REFERENCES "document_templates"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "document_events"
ADD CONSTRAINT "document_events_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
