-- CreateTable
CREATE TABLE "billing_catalog_items" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stripe_product_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_prices" (
    "id" UUID NOT NULL,
    "catalog_item_id" UUID NOT NULL,
    "stripe_price_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "unit_amount_cents" BIGINT NOT NULL,
    "billing_type" TEXT NOT NULL,
    "recurring_interval" TEXT,
    "interval_count" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_subscriptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "stripe_customer_id" TEXT NOT NULL,
    "stripe_subscription_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "collection_method" TEXT,
    "default_payment_method_id" TEXT,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "trial_start" TIMESTAMP(3),
    "trial_end" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "latest_invoice_id" TEXT,
    "checkout_session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_subscription_items" (
    "id" UUID NOT NULL,
    "organization_subscription_id" UUID NOT NULL,
    "catalog_item_id" UUID NOT NULL,
    "stripe_subscription_item_id" TEXT NOT NULL,
    "stripe_price_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "organization_subscription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_entitlements" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "source_catalog_item_id" UUID,
    "source_subscription_item_id" UUID,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "granted_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_webhook_events" (
    "id" UUID NOT NULL,
    "stripe_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "api_version" TEXT,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "processing_status" TEXT NOT NULL,
    "error_message" TEXT,

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_catalog_items_code_key" ON "billing_catalog_items"("code");

-- CreateIndex
CREATE UNIQUE INDEX "billing_catalog_items_stripe_product_id_key" ON "billing_catalog_items"("stripe_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_prices_stripe_price_id_key" ON "billing_prices"("stripe_price_id");

-- CreateIndex
CREATE INDEX "billing_prices_catalog_item_id_idx" ON "billing_prices"("catalog_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_subscriptions_stripe_subscription_id_key" ON "organization_subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "organization_subscriptions_organization_id_idx" ON "organization_subscriptions"("organization_id");

-- CreateIndex
CREATE INDEX "organization_subscriptions_checkout_session_id_idx" ON "organization_subscriptions"("checkout_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_subscriptions_one_live_per_organization_idx"
ON "organization_subscriptions"("organization_id")
WHERE "status" IN ('incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'paused')
  AND "ended_at" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "organization_subscription_items_stripe_subscription_item_id_key" ON "organization_subscription_items"("stripe_subscription_item_id");

-- CreateIndex
CREATE INDEX "organization_subscription_items_organization_subscription_id_idx" ON "organization_subscription_items"("organization_subscription_id");

-- CreateIndex
CREATE INDEX "organization_subscription_items_catalog_item_id_idx" ON "organization_subscription_items"("catalog_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_entitlements_organization_id_key_key" ON "organization_entitlements"("organization_id", "key");

-- CreateIndex
CREATE INDEX "organization_entitlements_source_catalog_item_id_idx" ON "organization_entitlements"("source_catalog_item_id");

-- CreateIndex
CREATE INDEX "organization_entitlements_source_subscription_item_id_idx" ON "organization_entitlements"("source_subscription_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_webhook_events_stripe_event_id_key" ON "stripe_webhook_events"("stripe_event_id");

-- CreateIndex
CREATE INDEX "stripe_webhook_events_processing_status_idx" ON "stripe_webhook_events"("processing_status");

-- AddForeignKey
ALTER TABLE "billing_prices" ADD CONSTRAINT "billing_prices_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "billing_catalog_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_subscription_items" ADD CONSTRAINT "organization_subscription_items_organization_subscription_id_fkey" FOREIGN KEY ("organization_subscription_id") REFERENCES "organization_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_subscription_items" ADD CONSTRAINT "organization_subscription_items_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "billing_catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_entitlements" ADD CONSTRAINT "organization_entitlements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_entitlements" ADD CONSTRAINT "organization_entitlements_source_catalog_item_id_fkey" FOREIGN KEY ("source_catalog_item_id") REFERENCES "billing_catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_entitlements" ADD CONSTRAINT "organization_entitlements_source_subscription_item_id_fkey" FOREIGN KEY ("source_subscription_item_id") REFERENCES "organization_subscription_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
