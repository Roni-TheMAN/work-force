ALTER TABLE "document_recipients"
  ADD COLUMN "property_id" UUID,
  ADD COLUMN "external_company" TEXT,
  ADD COLUMN "external_group" TEXT,
  ADD COLUMN "external_phone" TEXT,
  ADD COLUMN "is_general" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "notes" TEXT;

ALTER TABLE "document_recipients"
  ADD CONSTRAINT "document_recipients_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "document_recipients_organization_id_recipient_type_status_idx"
  ON "document_recipients"("organization_id", "recipient_type", "status");

CREATE INDEX "document_recipients_property_id_created_at_idx"
  ON "document_recipients"("property_id", "created_at");

CREATE INDEX "document_recipients_external_email_idx"
  ON "document_recipients"("external_email");

CREATE INDEX "document_recipients_external_company_idx"
  ON "document_recipients"("external_company");

CREATE INDEX "document_recipients_external_group_idx"
  ON "document_recipients"("external_group");

CREATE INDEX "document_recipients_sent_at_idx"
  ON "document_recipients"("sent_at");

CREATE INDEX "document_recipients_completed_at_idx"
  ON "document_recipients"("completed_at");
