CREATE TABLE "system_document_templates" (
  "id" UUID NOT NULL,
  "docuseal_template_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "source_type" TEXT NOT NULL DEFAULT 'system_seeded',
  "status" TEXT NOT NULL DEFAULT 'active',
  "source_file_url" TEXT,
  "source_file_name" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "system_document_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "system_document_templates_docuseal_template_id_key"
  ON "system_document_templates"("docuseal_template_id");

CREATE INDEX "system_document_templates_status_idx"
  ON "system_document_templates"("status");

CREATE INDEX "system_document_templates_category_idx"
  ON "system_document_templates"("category");

ALTER TABLE "document_templates"
  ADD COLUMN "system_template_id" UUID,
  ADD COLUMN "builder_status" TEXT NOT NULL DEFAULT 'ready',
  ADD COLUMN "source_file_url" TEXT,
  ADD COLUMN "source_file_name" TEXT,
  ADD COLUMN "source_file_mime_type" TEXT,
  ADD COLUMN "source_file_size_bytes" INTEGER;

ALTER TABLE "document_templates"
  ALTER COLUMN "docuseal_template_id" DROP NOT NULL;

UPDATE "document_templates"
SET "source_type" = 'docuseal_created'
WHERE "source_type" = 'docuseal';

UPDATE "document_templates"
SET "builder_status" = CASE
  WHEN "status" = 'archived' OR "archived_at" IS NOT NULL THEN 'archived'
  WHEN "docuseal_template_id" IS NOT NULL THEN 'ready'
  ELSE 'needs_setup'
END;

ALTER TABLE "document_templates"
  ADD CONSTRAINT "document_templates_system_template_id_fkey"
  FOREIGN KEY ("system_template_id") REFERENCES "system_document_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "document_templates_organization_id_builder_status_idx"
  ON "document_templates"("organization_id", "builder_status");

CREATE INDEX "document_templates_organization_id_source_type_idx"
  ON "document_templates"("organization_id", "source_type");

CREATE INDEX "document_templates_system_template_id_idx"
  ON "document_templates"("system_template_id");
