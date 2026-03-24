export type PlanId = "free" | "pro" | "enterprise";

export type Plan = {
  id: PlanId;
  name: string;
  price: string;
  description: string;
  features: string[];
  recommended?: boolean;
};

export type Property = {
  id: string;
  name: string;
  code: string | null;
  timezone: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  countryCode: string | null;
  status: string;
};

export type Organization = {
  id: string;
  name: string;
  role: string;
  status: string;
  timezone: string;
  lastActive: string;
  properties: Property[];
};

export const organizationPlans: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    description: "Start onboarding and stand up a single property with core workforce access.",
    features: [
      "1 organization workspace",
      "1 property",
      "Core employee roster",
      "Basic time tracking",
      "Email support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$79 / month",
    description: "Built for growing operators managing multiple locations and team leads.",
    features: [
      "Unlimited properties",
      "Role-based organization access",
      "Shift scheduling and approvals",
      "Cross-property reporting",
      "Priority support",
    ],
    recommended: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    description: "For multi-brand teams that need controls, provisioning, and rollout support.",
    features: [
      "Advanced tenant governance",
      "Custom onboarding assistance",
      "SSO and provisioning",
      "Audit exports",
      "Dedicated success lead",
    ],
  },
];

export const propertyStatusOptions = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Archived", value: "archived" },
] as const;

export const timezoneOptions = [
  { label: "Eastern Time (ET)", value: "America/New_York" },
  { label: "Central Time (CT)", value: "America/Chicago" },
  { label: "Mountain Time (MT)", value: "America/Denver" },
  { label: "Pacific Time (PT)", value: "America/Los_Angeles" },
  { label: "Indiana (Indianapolis)", value: "America/Indiana/Indianapolis" },
] as const;
