ALTER TABLE "employees"
  ADD COLUMN "pin_lookup_key" TEXT,
  ADD COLUMN "pin_ciphertext" TEXT,
  ADD COLUMN "pin_last_set_at" TIMESTAMPTZ(6),
  ADD COLUMN "pin_last_set_by_user_id" UUID;

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_pin_last_set_by_user_id_fkey"
    FOREIGN KEY ("pin_last_set_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

CREATE UNIQUE INDEX "employees_organization_id_pin_lookup_key_key"
  ON "employees"("organization_id", "pin_lookup_key");

CREATE INDEX "employees_pin_last_set_by_user_id_idx"
  ON "employees"("pin_last_set_by_user_id");

COMMENT ON COLUMN "employees"."pin_lookup_key" IS 'Deterministic org-scoped PIN lookup key derived from the plaintext PIN.';
COMMENT ON COLUMN "employees"."pin_ciphertext" IS 'Encrypted current PIN value so authorized admins can reveal the active PIN.';
COMMENT ON COLUMN "employees"."pin_last_set_at" IS 'When the current kiosk PIN was last generated or manually updated.';
COMMENT ON COLUMN "employees"."pin_last_set_by_user_id" IS 'User who last generated or reset the current kiosk PIN.';

CREATE TABLE "employee_pin_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "performed_by_user_id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "pin_mode" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "employee_pin_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_pin_events_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "employee_pin_events_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "employee_pin_events_performed_by_user_id_fkey"
    FOREIGN KEY ("performed_by_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT "employee_pin_events_event_type_check"
    CHECK ("event_type" IN ('generated', 'manual_set', 'revealed', 'reset')),
  CONSTRAINT "employee_pin_events_pin_mode_check"
    CHECK ("pin_mode" IS NULL OR "pin_mode" IN ('auto', 'manual'))
);

CREATE INDEX "employee_pin_events_organization_id_created_at_idx"
  ON "employee_pin_events"("organization_id", "created_at");

CREATE INDEX "employee_pin_events_employee_id_created_at_idx"
  ON "employee_pin_events"("employee_id", "created_at");

CREATE INDEX "employee_pin_events_performed_by_user_id_idx"
  ON "employee_pin_events"("performed_by_user_id");

COMMENT ON TABLE "employee_pin_events" IS 'Audit trail for employee PIN lifecycle events without storing plaintext PIN values.';

CREATE TABLE "property_device_pairing_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "property_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "consumed_at" TIMESTAMPTZ(6),
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "property_device_pairing_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "property_device_pairing_tokens_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "property_device_pairing_tokens_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "property_device_pairing_tokens_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT "property_device_pairing_tokens_expiration_check"
    CHECK ("expires_at" > "created_at")
);

CREATE UNIQUE INDEX "property_device_pairing_tokens_token_hash_key"
  ON "property_device_pairing_tokens"("token_hash");

CREATE INDEX "property_device_pairing_tokens_organization_id_expires_at_idx"
  ON "property_device_pairing_tokens"("organization_id", "expires_at");

CREATE INDEX "property_device_pairing_tokens_property_id_expires_at_idx"
  ON "property_device_pairing_tokens"("property_id", "expires_at");

CREATE INDEX "property_device_pairing_tokens_created_by_user_id_idx"
  ON "property_device_pairing_tokens"("created_by_user_id");

COMMENT ON TABLE "property_device_pairing_tokens" IS 'Short-lived single-use tokens used to bind kiosk devices to a property through QR pairing.';
