ALTER TABLE "document_templates"
  ADD COLUMN "external_id" TEXT,
  ADD COLUMN "file_url" TEXT,
  ADD COLUMN "file_hash" TEXT,
  ADD COLUMN "created_by_user_id" UUID,
  ADD COLUMN "updated_by_user_id" UUID;

UPDATE "document_templates"
SET
  "external_id" = COALESCE("external_id", "id"::TEXT),
  "file_url" = COALESCE("file_url", "source_file_url");

ALTER TABLE "document_templates"
  ALTER COLUMN "external_id" SET NOT NULL;

CREATE UNIQUE INDEX "document_templates_external_id_key"
  ON "document_templates"("external_id");

CREATE INDEX "document_templates_file_hash_idx"
  ON "document_templates"("file_hash");

CREATE INDEX "document_templates_created_by_user_id_idx"
  ON "document_templates"("created_by_user_id");

CREATE INDEX "document_templates_updated_by_user_id_idx"
  ON "document_templates"("updated_by_user_id");
