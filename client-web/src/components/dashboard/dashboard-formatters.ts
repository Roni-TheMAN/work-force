import type { DashboardValueVariant } from "@/hooks/useOrganizationDashboard";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-US");
const hourFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

export function formatValue(value: number, variant: DashboardValueVariant) {
  if (variant === "currency") {
    return currencyFormatter.format(value);
  }

  if (variant === "hours") {
    return `${hourFormatter.format(value)}h`;
  }

  return numberFormatter.format(value);
}

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatHours(value: number) {
  return `${hourFormatter.format(value)}h`;
}

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatDelta(delta: number) {
  const prefix = delta > 0 ? "+" : delta < 0 ? "-" : "";
  return `${prefix}${Math.abs(delta).toFixed(1)}%`;
}

export function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase())
    .join("");
}
