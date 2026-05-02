ALTER TABLE "document_templates"
  DROP CONSTRAINT IF EXISTS "document_templates_source_type_check";

ALTER TABLE "document_templates"
  ADD CONSTRAINT "document_templates_source_type_check"
  CHECK ("source_type" IN ('uploaded', 'docuseal_created', 'system_seeded', 'cloned_system'));
