import { useEffect, useState } from "react";

import { useAddOrganizationBillingAddon, useOrganizationBillingSummary, useRemoveOrganizationBillingAddon, useUpdateOrganizationBillingAddon } from "@/hooks/useBilling";
import type { BillingAddonCode, BillingCatalogItem } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type BillingManagementPanelProps = {
  canManageBilling: boolean;
  employeeLimit: number;
  employeeUsage: number;
  organizationId: string;
  propertyLimit: number;
  propertyUsage: number;
};

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

export function BillingManagementPanel({
  canManageBilling,
  employeeLimit,
  employeeUsage,
  organizationId,
  propertyLimit,
  propertyUsage,
}: BillingManagementPanelProps) {
  const billingSummaryQuery = useOrganizationBillingSummary(organizationId);
  const addAddonMutation = useAddOrganizationBillingAddon(organizationId);
  const updateAddonMutation = useUpdateOrganizationBillingAddon(organizationId);
  const removeAddonMutation = useRemoveOrganizationBillingAddon(organizationId);
  const [draftQuantities, setDraftQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    const nextDraftQuantities =
      billingSummaryQuery.data?.availableAddons.reduce<Record<string, number>>((accumulator, addon) => {
        const activeAddon = billingSummaryQuery.data?.subscription?.addons.find((item) => item.catalogCode === addon.code);
        accumulator[addon.code] = activeAddon?.quantity ?? 1;
        return accumulator;
      }, {}) ?? {};

    setDraftQuantities(nextDraftQuantities);
  }, [billingSummaryQuery.data]);

  const mutationError =
    (addAddonMutation.isError && addAddonMutation.error.message) ||
    (updateAddonMutation.isError && updateAddonMutation.error.message) ||
    (removeAddonMutation.isError && removeAddonMutation.error.message) ||
    null;

  const isMutating = addAddonMutation.isPending || updateAddonMutation.isPending || removeAddonMutation.isPending;

  const setDraftQuantity = (code: string, value: string) => {
    const parsed = Number.parseInt(value, 10);

    setDraftQuantities((previous) => ({
      ...previous,
      [code]: Number.isFinite(parsed) && parsed > 0 ? parsed : 1,
    }));
  };

  if (billingSummaryQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Billing Management</CardTitle>
          <CardDescription>Loading live subscription data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (billingSummaryQuery.isError || !billingSummaryQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Billing Management</CardTitle>
          <CardDescription>Live billing data is unavailable.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            {billingSummaryQuery.isError ? billingSummaryQuery.error.message : "Billing summary could not be loaded."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const summary = billingSummaryQuery.data;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold">Billing Management</CardTitle>
            <CardDescription>Manage active add-ons on the current paid subscription.</CardDescription>
          </div>
          <Badge variant="secondary">
            {summary.subscription?.plan?.catalogName ?? "No paid plan"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-sm text-muted-foreground">Property capacity</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {propertyUsage} / {propertyLimit}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {Math.max(propertyLimit - propertyUsage, 0)} properties remaining
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-sm text-muted-foreground">Employee capacity</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {employeeUsage} / {employeeLimit}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {Math.max(employeeLimit - employeeUsage, 0)} employees remaining
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Current subscription</p>
              <p className="mt-2 text-xl font-semibold text-foreground">
                {summary.subscription?.plan?.catalogName ?? "Free / no paid subscription"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {summary.subscription
                  ? `${formatCurrency(summary.subscription.monthlySubtotalCents)} billed this cycle before taxes.`
                  : "Add-ons become manageable after a paid subscription exists."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {summary.subscription?.addons.length ? (
                summary.subscription.addons.map((addon) => (
                  <Badge key={addon.id} variant="outline">
                    {addon.catalogName} x{addon.quantity}
                  </Badge>
                ))
              ) : (
                <Badge variant="outline">No active add-ons</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {summary.availableAddons.map((addon) => {
            const activeAddon = summary.subscription?.addons.find((item) => item.catalogCode === addon.code) ?? null;
            const draftQuantity = draftQuantities[addon.code] ?? 1;
            const actionDisabled = !canManageBilling || isMutating || !summary.subscription;

            return (
              <div key={addon.code} className="rounded-2xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{addon.name}</p>
                      {activeAddon ? <Badge variant="secondary">Active</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{addon.description}</p>
                    <p className="text-xs text-muted-foreground">{formatEntitlementPreview(addon)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">{formatCurrency(addon.unitAmountCents)}</p>
                    <p className="text-xs text-muted-foreground">per month</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {addon.quantityMode === "stackable" ? (
                    <div className="flex max-w-[180px] items-center gap-2">
                      <span className="text-sm text-muted-foreground">Qty</span>
                      <Input
                        type="number"
                        min={1}
                        value={draftQuantity}
                        onChange={(event) => setDraftQuantity(addon.code, event.target.value)}
                        disabled={actionDisabled}
                      />
                    </div>
                  ) : null}

                  {activeAddon ? (
                    <>
                      {addon.quantityMode === "stackable" ? (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={actionDisabled}
                          onClick={() =>
                            void updateAddonMutation.mutateAsync({
                              organizationId,
                              code: addon.code as BillingAddonCode,
                              quantity: draftQuantity,
                            })
                          }
                        >
                          Update quantity
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        disabled={actionDisabled}
                        onClick={() =>
                          void removeAddonMutation.mutateAsync({
                            organizationId,
                            code: addon.code as BillingAddonCode,
                          })
                        }
                      >
                        Remove
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      disabled={actionDisabled}
                      onClick={() =>
                        void addAddonMutation.mutateAsync({
                          organizationId,
                          code: addon.code as BillingAddonCode,
                          quantity: addon.quantityMode === "stackable" ? draftQuantity : 1,
                        })
                      }
                    >
                      Add add-on
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {mutationError ? <p className="text-sm text-destructive">{mutationError}</p> : null}
        {!canManageBilling ? (
          <p className="text-sm text-muted-foreground">Billing changes are restricted to organization members with billing access.</p>
        ) : null}
        {!summary.subscription ? (
          <p className="text-sm text-muted-foreground">No paid subscription is active yet, so add-ons cannot be attached from this panel.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
