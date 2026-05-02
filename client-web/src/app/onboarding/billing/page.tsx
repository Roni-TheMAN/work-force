import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check } from "lucide-react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Link, Navigate, useSearchParams } from "react-router-dom";

import { AppScreen } from "@/components/layout/app-screen";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { organizationPlans, type PlanId } from "@/data/onboarding";
import {
  createCheckoutSession,
  fetchOrganizationBillingSummary,
  type BillingAddonCode,
  type BillingAddonSelection,
  type BillingCatalogItem,
  type PaidPlanId,
} from "@/lib/api";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

function isPlanId(value: string | null): value is PlanId {
  return value === "free" || value === "pro" || value === "enterprise";
}

function formatCurrency(amountCents: number | null): string {
  if (amountCents === null) {
    return "Custom";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

function formatEntitlementPreview(item: BillingCatalogItem): string {
  return item.entitlements
    .map((entitlement) => {
      if (typeof entitlement.value === "number") {
        return `+${entitlement.value} ${entitlement.key.replace(/_/g, " ")}`;
      }

      if (typeof entitlement.value === "boolean") {
        return entitlement.value ? entitlement.key.replace(/_/g, " ") : `No ${entitlement.key.replace(/_/g, " ")}`;
      }

      return `${entitlement.key.replace(/_/g, " ")}: ${String(entitlement.value)}`;
    })
    .join(" • ");
}

const stripePromise = env.stripePublishableKey ? loadStripe(env.stripePublishableKey) : null;

export function BillingPage() {
  const [searchParams] = useSearchParams();
  const planId = isPlanId(searchParams.get("plan")) ? searchParams.get("plan") : "pro";
  const organizationId = searchParams.get("organization");
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});
  const [checkoutAddons, setCheckoutAddons] = useState<BillingAddonSelection[] | null>(null);

  if (planId === "free") {
    return <Navigate to="/quick-dash" replace />;
  }

  if (!organizationId) {
    return <Navigate to="/onboarding/create-organization" replace />;
  }

  const selectedPlan = organizationPlans.find((plan) => plan.id === planId) ?? organizationPlans[1];
  const billingSummaryQuery = useQuery({
    queryKey: ["onboarding-billing-summary", organizationId],
    queryFn: ({ signal }) => fetchOrganizationBillingSummary(organizationId, signal),
  });

  const selectedAddonList = useMemo(
    () =>
      Object.entries(selectedAddons)
        .filter(([, quantity]) => quantity > 0)
        .map(([code, quantity]) => ({
          code: code as BillingAddonCode,
          quantity,
        })),
    [selectedAddons]
  );

  const fetchClientSecret = useCallback(() => {
    if (!checkoutAddons) {
      return Promise.reject(new Error("Checkout has not been initialized."));
    }

    return createCheckoutSession(planId as PaidPlanId, organizationId, checkoutAddons).then((data) => data.clientSecret);
  }, [checkoutAddons, organizationId, planId]);

  const handleToggleAddon = (addon: BillingCatalogItem) => {
    setSelectedAddons((previous) => {
      const currentQuantity = previous[addon.code] ?? 0;

      if (currentQuantity > 0) {
        const next = { ...previous };
        delete next[addon.code];
        return next;
      }

      return {
        ...previous,
        [addon.code]: addon.quantityMode === "single" ? 1 : 1,
      };
    });
  };

  const handleQuantityChange = (code: string, nextValue: string) => {
    const parsed = Number.parseInt(nextValue, 10);

    setSelectedAddons((previous) => ({
      ...previous,
      [code]: Number.isFinite(parsed) && parsed > 0 ? parsed : 1,
    }));
  };

  const handlePrepareCheckout = () => {
    setCheckoutAddons(selectedAddonList);
  };

  return (
    <AppScreen
      title="Billing"
      description="Select add-ons first, then load Stripe checkout for the base plan plus any extras."
      actions={
        <Link to="/onboarding/create-organization" className={cn(buttonVariants({ variant: "ghost" }))}>
          <ArrowLeft className="size-4" />
          Back to setup
        </Link>
      }
      contentClassName="flex items-start"
    >
      <div className="grid w-full gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <CardTitle>{selectedPlan.name} checkout setup</CardTitle>
                <CardDescription>Choose any add-ons that should be attached to the first paid subscription.</CardDescription>
              </div>
              <Badge variant="secondary">{selectedPlan.price}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">Base plan</p>
              <p className="mt-2 text-xl font-semibold text-foreground">{selectedPlan.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{selectedPlan.description}</p>
            </div>

            {billingSummaryQuery.isLoading ? (
              <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
                Loading add-ons...
              </div>
            ) : billingSummaryQuery.isError ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {billingSummaryQuery.error.message}
              </div>
            ) : (
              <div className="space-y-3">
                {billingSummaryQuery.data?.availableAddons.map((addon) => {
                  const quantity = selectedAddons[addon.code] ?? 0;
                  const isSelected = quantity > 0;

                  return (
                    <div
                      key={addon.code}
                      className={cn(
                        "rounded-2xl border p-4 transition-colors",
                        isSelected ? "border-primary bg-primary-soft/30" : "border-border bg-background"
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{addon.name}</p>
                            {isSelected ? (
                              <Badge variant="secondary">
                                <Check className="mr-1 size-3" />
                                Added
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-sm text-muted-foreground">{addon.description}</p>
                          <p className="text-xs text-muted-foreground">{formatEntitlementPreview(addon)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-medium text-foreground">{formatCurrency(addon.unitAmountCents)}</p>
                            <p className="text-xs text-muted-foreground">per month</p>
                          </div>
                          <Button type="button" variant={isSelected ? "secondary" : "outline"} onClick={() => handleToggleAddon(addon)}>
                            {isSelected ? "Remove" : "Add"}
                          </Button>
                        </div>
                      </div>
                      {isSelected && addon.quantityMode === "stackable" ? (
                        <div className="mt-4 flex max-w-[180px] items-center gap-3">
                          <label htmlFor={`addon-${addon.code}`} className="text-sm text-muted-foreground">
                            Quantity
                          </label>
                          <Input
                            id={`addon-${addon.code}`}
                            type="number"
                            min={1}
                            value={quantity}
                            onChange={(event) => handleQuantityChange(addon.code, event.target.value)}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-sm text-muted-foreground">Selected add-ons</p>
              <p className="mt-2 text-sm text-foreground">
                {selectedAddonList.length > 0
                  ? selectedAddonList.map((addon) => `${addon.code} x${addon.quantity}`).join(", ")
                  : "No add-ons selected."}
              </p>
              <Button type="button" className="mt-4" onClick={handlePrepareCheckout} disabled={billingSummaryQuery.isLoading}>
                {checkoutAddons ? "Refresh checkout" : "Load Stripe checkout"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-[420px]">
          <CardHeader>
            <CardTitle>Stripe Checkout</CardTitle>
            <CardDescription>Checkout is created with the base plan plus the currently confirmed add-ons.</CardDescription>
          </CardHeader>
          <CardContent>
            {!stripePromise ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                Missing `VITE_STRIPE_PUBLISHABLE_KEY` in the client-web environment.
              </div>
            ) : !checkoutAddons ? (
              <div className="rounded-xl border border-border bg-background px-4 py-5 text-sm text-muted-foreground">
                Select any add-ons on the left, then load checkout.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-background">
                <EmbeddedCheckoutProvider
                  key={JSON.stringify(checkoutAddons)}
                  stripe={stripePromise}
                  options={{ fetchClientSecret }}
                >
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppScreen>
  );
}
