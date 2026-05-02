export type BillingEntitlementFixture = {
  key: string;
  value: boolean | number | string | Record<string, unknown>;
};

export type BillingQuantityMode = "single" | "stackable";

export type BillingPriceFixture = {
  active?: boolean;
  billingType: "one_time" | "recurring";
  currency: string;
  intervalCount?: number | null;
  recurringInterval?: "day" | "week" | "month" | "year" | null;
  stripePriceId: string;
  unitAmountCents: number;
};

export type BillingCatalogItemFixture = {
  active?: boolean;
  code: string;
  description?: string;
  entitlements: BillingEntitlementFixture[];
  kind: "addon" | "plan";
  name: string;
  prices: BillingPriceFixture[];
  quantityMode: BillingQuantityMode;
  stripeProductId: string;
};

// Temporary fixture source for catalog and prices until admin-managed billing is added.
export const BILLING_CATALOG_FIXTURES: BillingCatalogItemFixture[] = [
  {
    code: "free",
    kind: "plan",
    name: "Free",
    description: "Single-property starter plan for onboarding and local testing.",
    stripeProductId: "prod_free_placeholder",
    entitlements: [
      { key: "max_properties", value: 1 },
      { key: "max_employees", value: 12 },
      { key: "analytics", value: false },
      { key: "advanced_scheduling", value: false },
      { key: "time_clock", value: true },
    ],
    prices: [],
    quantityMode: "single",
  },
  {
    code: "pro",
    kind: "plan",
    name: "Pro",
    description: "Operational plan for growing multi-property teams.",
    stripeProductId: "prod_UBC7a2DJV1TDmz",
    entitlements: [
      { key: "max_properties", value: 6 },
      { key: "max_employees", value: 140 },
      { key: "analytics", value: true },
      { key: "advanced_scheduling", value: true },
      { key: "time_clock", value: true },
    ],
    prices: [
      {
        billingType: "recurring",
        currency: "usd",
        recurringInterval: "month",
        intervalCount: 1,
        // Temporary reference. Update this fixture with the real Stripe price id when ready.
        stripePriceId: "prod_UBC7a2DJV1TDmz",
        unitAmountCents: 4999,
      },
    ],
    quantityMode: "single",
  },
  {
    code: "enterprise",
    kind: "plan",
    name: "Enterprise",
    description: "Enterprise billing tier with larger entitlement limits.",
    stripeProductId: "prod_enterprise_placeholder",
    entitlements: [
      { key: "max_properties", value: 24 },
      { key: "max_employees", value: 600 },
      { key: "analytics", value: true },
      { key: "advanced_scheduling", value: true },
      { key: "time_clock", value: true },
    ],
    prices: [
      {
        billingType: "recurring",
        currency: "usd",
        recurringInterval: "month",
        intervalCount: 1,
        stripePriceId: "price_1TCpjI2M9pFpo1972DCWAewH",
        unitAmountCents: 19900,
      },
    ],
    quantityMode: "single",
  },
  {
    code: "extra_properties_5",
    kind: "addon",
    name: "Extra Properties",
    description: "Adds additional property capacity to the base subscription.",
    stripeProductId: "prod_extra_properties_placeholder",
    entitlements: [{ key: "max_properties", value: 5 }],
    prices: [
      {
        billingType: "recurring",
        currency: "usd",
        recurringInterval: "month",
        intervalCount: 1,
        stripePriceId: "price_1THzQR2M9pFpo1972AH7sWaI",
        unitAmountCents: 999,
      },
    ],
    quantityMode: "stackable",
  },
  {
    code: "extra_employees_50",
    kind: "addon",
    name: "Extra Employees",
    description: "Adds fifty additional employee slots to the base subscription.",
    stripeProductId: "prod_extra_employees_50_placeholder",
    entitlements: [{ key: "max_employees", value: 50 }],
    prices: [
      {
        billingType: "recurring",
        currency: "usd",
        recurringInterval: "month",
        intervalCount: 1,
        stripePriceId: "price_1THzS72M9pFpo197SpVXZLRO",
        unitAmountCents: 999,
      },
    ],
    quantityMode: "stackable",
  },
  {
    code: "advanced_analytics",
    kind: "addon",
    name: "Advanced Analytics",
    description: "Unlocks analytics dashboards and org-level trends.",
    stripeProductId: "prod_advanced_analytics_placeholder",
    entitlements: [{ key: "analytics", value: true }],
    prices: [
      {
        billingType: "recurring",
        currency: "usd",
        recurringInterval: "month",
        intervalCount: 1,
        stripePriceId: "price_1THzSy2M9pFpo197JH8ZQqHD",
        unitAmountCents: 2999,
      },
    ],
    quantityMode: "single",
  },
  {
    code: "api_access",
    kind: "addon",
    name: "API Access",
    description: "Enables API access for downstream integrations.",
    stripeProductId: "prod_api_access_placeholder",
    entitlements: [{ key: "api_access", value: true }],
    prices: [
      {
        billingType: "recurring",
        currency: "usd",
        recurringInterval: "month",
        intervalCount: 1,
        stripePriceId: "price_1THzUJ2M9pFpo197xGpC6ouP",
        unitAmountCents: 1900,
      },
    ],
    quantityMode: "single",
  },
  {
    code: "sms_notifications",
    kind: "addon",
    name: "SMS Notifications",
    description: "Adds outbound SMS notification capability to scheduling flows.",
    stripeProductId: "prod_sms_notifications_placeholder",
    entitlements: [{ key: "sms_notifications", value: true }],
    prices: [
      {
        billingType: "recurring",
        currency: "usd",
        recurringInterval: "month",
        intervalCount: 1,
        stripePriceId: "price_1THzV32M9pFpo197koRQCLbY",
        unitAmountCents: 2500,
      },
    ],
    quantityMode: "single",
  },
];
