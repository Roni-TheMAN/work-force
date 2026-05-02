import { useEffect, useState } from "react";

import type {
  PropertyDashboardPayPeriod,
  PropertyDashboardPayrollConfig,
  PropertyDashboardProperty,
  PropertyPayrollFrequency,
} from "@/api/property";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PropertySettingsProps = {
  property: PropertyDashboardProperty;
  payrollConfig: PropertyDashboardPayrollConfig;
  currentPayPeriod: PropertyDashboardPayPeriod | null;
  nextPayPeriod: PropertyDashboardPayPeriod | null;
  isSaving: boolean;
  onSave: (payload: {
    name: string;
    timezone: string;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    stateRegion: string | null;
    postalCode: string | null;
    countryCode: string | null;
    payroll: {
      frequency: PropertyPayrollFrequency;
      anchorStartDate: string;
      customDayInterval: number | null;
      autoCloseAfterHours: number | null;
    };
  }) => void;
};

const payrollFrequencies: Array<{ label: string; value: PropertyPayrollFrequency }> = [
  { label: "Weekly", value: "weekly" },
  { label: "Biweekly", value: "biweekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
  { label: "Custom days", value: "custom_days" },
];

function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

export function PropertySettings({
  property,
  payrollConfig,
  currentPayPeriod,
  nextPayPeriod,
  isSaving,
  onSave,
}: PropertySettingsProps) {
  const [formState, setFormState] = useState({
    name: property.name,
    timezone: property.timezone,
    addressLine1: property.addressLine1 ?? "",
    addressLine2: property.addressLine2 ?? "",
    city: property.city ?? "",
    stateRegion: property.stateRegion ?? "",
    postalCode: property.postalCode ?? "",
    countryCode: property.countryCode ?? "",
    payrollFrequency: payrollConfig.frequency,
    payrollAnchorStartDate: payrollConfig.anchorStartDate ?? getTodayDateValue(),
    payrollCustomDayInterval: payrollConfig.customDayInterval ? String(payrollConfig.customDayInterval) : "",
    autoCloseAfterHours: String(payrollConfig.autoCloseAfterHours),
  });

  useEffect(() => {
    setFormState({
      name: property.name,
      timezone: property.timezone,
      addressLine1: property.addressLine1 ?? "",
      addressLine2: property.addressLine2 ?? "",
      city: property.city ?? "",
      stateRegion: property.stateRegion ?? "",
      postalCode: property.postalCode ?? "",
      countryCode: property.countryCode ?? "",
      payrollFrequency: payrollConfig.frequency,
      payrollAnchorStartDate: payrollConfig.anchorStartDate ?? getTodayDateValue(),
      payrollCustomDayInterval: payrollConfig.customDayInterval ? String(payrollConfig.customDayInterval) : "",
      autoCloseAfterHours: String(payrollConfig.autoCloseAfterHours),
    });
  }, [payrollConfig, property]);

  const isCustomDays = formState.payrollFrequency === "custom_days";

  return (
    <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Card>
        <CardHeader>
          <CardTitle>Property settings</CardTitle>
          <CardDescription>Update the location profile and its property-specific payroll cadence.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="property-name">Property name</Label>
            <Input
              id="property-name"
              value={formState.name}
              onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="property-timezone">Timezone</Label>
            <Input
              id="property-timezone"
              value={formState.timezone}
              onChange={(event) => setFormState((current) => ({ ...current, timezone: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="property-country">Country code</Label>
            <Input
              id="property-country"
              value={formState.countryCode}
              onChange={(event) => setFormState((current) => ({ ...current, countryCode: event.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="property-address-line-1">Address line 1</Label>
            <Input
              id="property-address-line-1"
              value={formState.addressLine1}
              onChange={(event) => setFormState((current) => ({ ...current, addressLine1: event.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="property-address-line-2">Address line 2</Label>
            <Input
              id="property-address-line-2"
              value={formState.addressLine2}
              onChange={(event) => setFormState((current) => ({ ...current, addressLine2: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="property-city">City</Label>
            <Input
              id="property-city"
              value={formState.city}
              onChange={(event) => setFormState((current) => ({ ...current, city: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="property-state-region">State / region</Label>
            <Input
              id="property-state-region"
              value={formState.stateRegion}
              onChange={(event) => setFormState((current) => ({ ...current, stateRegion: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="property-postal-code">Postal code</Label>
            <Input
              id="property-postal-code"
              value={formState.postalCode}
              onChange={(event) => setFormState((current) => ({ ...current, postalCode: event.target.value }))}
            />
          </div>

          <div className="sm:col-span-2">
            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="mb-4">
                <p className="text-sm font-medium text-foreground">Payroll period</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Each property keeps its own pay-period cadence, anchor date, and auto-close policy.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={formState.payrollFrequency}
                    onValueChange={(value) =>
                      setFormState((current) => ({
                        ...current,
                        payrollFrequency: value as PropertyPayrollFrequency,
                        payrollCustomDayInterval:
                          value === "custom_days" ? current.payrollCustomDayInterval || "15" : "",
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select payroll frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {payrollFrequencies.map((frequency) => (
                        <SelectItem key={frequency.value} value={frequency.value}>
                          {frequency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payroll-anchor-start-date">Pay period start date</Label>
                  <Input
                    id="payroll-anchor-start-date"
                    type="date"
                    value={formState.payrollAnchorStartDate}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, payrollAnchorStartDate: event.target.value }))
                    }
                  />
                </div>
                {isCustomDays ? (
                  <div className="space-y-2">
                    <Label htmlFor="payroll-custom-days">Custom day interval</Label>
                    <Input
                      id="payroll-custom-days"
                      type="number"
                      min={1}
                      value={formState.payrollCustomDayInterval}
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, payrollCustomDayInterval: event.target.value }))
                      }
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="auto-close-after-hours">Auto close after hours</Label>
                  <Input
                    id="auto-close-after-hours"
                    type="number"
                    min={1}
                    value={formState.autoCloseAfterHours}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, autoCloseAfterHours: event.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="sm:col-span-2">
            <Button
              type="button"
              disabled={isSaving}
              onClick={() =>
                onSave({
                  name: formState.name.trim(),
                  timezone: formState.timezone.trim(),
                  addressLine1: formState.addressLine1.trim() || null,
                  addressLine2: formState.addressLine2.trim() || null,
                  city: formState.city.trim() || null,
                  stateRegion: formState.stateRegion.trim() || null,
                  postalCode: formState.postalCode.trim() || null,
                  countryCode: formState.countryCode.trim() || null,
                  payroll: {
                    frequency: formState.payrollFrequency,
                    anchorStartDate: formState.payrollAnchorStartDate,
                    customDayInterval:
                      formState.payrollFrequency === "custom_days"
                        ? Number.parseInt(formState.payrollCustomDayInterval, 10) || null
                        : null,
                    autoCloseAfterHours: Number.parseInt(formState.autoCloseAfterHours, 10) || null,
                  },
                })
              }
            >
              {isSaving ? "Saving..." : "Save property settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Operational config</CardTitle>
            <CardDescription>Live property defaults currently applied to this location.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-border bg-background px-4 py-4">
              <p className="text-sm font-medium text-foreground">Overtime threshold</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {property.operationalConfig.overtimeHours} hours
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-4">
              <p className="text-sm font-medium text-foreground">Auto clock-out</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Trigger after {property.operationalConfig.autoClockOutHours} consecutive hours
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-4">
              <p className="text-sm font-medium text-foreground">Scheduling</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {property.operationalConfig.schedulingEnabled ? "Enabled for this property" : "Disabled for this property"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payroll state</CardTitle>
            <CardDescription>
              {payrollConfig.isConfigured
                ? "Current and next payroll windows for this property."
                : "This property has not been fully configured for payroll yet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-border bg-background px-4 py-4">
              <p className="text-sm font-medium text-foreground">Frequency</p>
              <p className="mt-1 text-sm capitalize text-muted-foreground">
                {payrollConfig.frequency.replace("_", " ")}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-4">
              <p className="text-sm font-medium text-foreground">Current pay period</p>
              <p className="mt-1 text-sm text-muted-foreground">{currentPayPeriod?.label ?? "Not started yet"}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-4">
              <p className="text-sm font-medium text-foreground">Next pay period</p>
              <p className="mt-1 text-sm text-muted-foreground">{nextPayPeriod?.label ?? "No next period generated yet"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
