import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { propertyStatusOptions, timezoneOptions } from "@/data/onboarding";
import { clientOrganizationsQueryKeyBase } from "@/lib/query-keys";
import { createProperty, type ClientProperty, type CreatePropertyPayload } from "@/lib/api";
import { AddressAutocomplete } from "@/components/onboarding/address-autocomplete";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PropertyCreationFormProps = {
  organizationId: string;
  defaultTimezone: string;
  onCancel: () => void;
  onCreated: (property: ClientProperty) => void;
};

type PropertyFormState = CreatePropertyPayload;

function createInitialState(organizationId: string, defaultTimezone: string): PropertyFormState {
  return {
    organizationId,
    name: "",
    code: null,
    timezone: defaultTimezone,
    addressLine1: null,
    addressLine2: null,
    city: null,
    stateRegion: null,
    postalCode: null,
    countryCode: null,
    status: "active",
  };
}

function toOptionalValue(value: string): string | null {
  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function PropertyCreationForm({
  organizationId,
  defaultTimezone,
  onCancel,
  onCreated,
}: PropertyCreationFormProps) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<PropertyFormState>(() => createInitialState(organizationId, defaultTimezone));

  useEffect(() => {
    setState(createInitialState(organizationId, defaultTimezone));
  }, [defaultTimezone, organizationId]);

  const createPropertyMutation = useMutation({
    mutationFn: createProperty,
    onSuccess: async (property) => {
      await queryClient.invalidateQueries({ queryKey: clientOrganizationsQueryKeyBase });
      onCreated(property);
    },
  });

  const isValid = Boolean(state.name.trim() && state.timezone.trim());

  const updateState = <Key extends keyof PropertyFormState>(key: Key, value: PropertyFormState[Key]) => {
    setState((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const handleSubmit = async () => {
    if (!isValid) {
      return;
    }

    await createPropertyMutation.mutateAsync({
      ...state,
      code: toOptionalValue(state.code ?? ""),
      addressLine1: toOptionalValue(state.addressLine1 ?? ""),
      addressLine2: toOptionalValue(state.addressLine2 ?? ""),
      city: toOptionalValue(state.city ?? ""),
      stateRegion: toOptionalValue(state.stateRegion ?? ""),
      postalCode: toOptionalValue(state.postalCode ?? ""),
      countryCode: toOptionalValue(state.countryCode ?? ""),
    });
  };

  const applyAddressSuggestion = (suggestion: {
    addressLine1: string | null;
    city: string | null;
    stateRegion: string | null;
    postalCode: string | null;
    countryCode: string | null;
  }) => {
    setState((previous) => ({
      ...previous,
      addressLine1: suggestion.addressLine1 ?? previous.addressLine1,
      city: suggestion.city ?? previous.city,
      stateRegion: suggestion.stateRegion ?? previous.stateRegion,
      postalCode: suggestion.postalCode ?? previous.postalCode,
      countryCode: suggestion.countryCode ?? previous.countryCode,
    }));
  };

  return (
    <Card size="sm" className="border-primary-soft bg-primary-soft/40">
      <CardHeader className="space-y-1">
        <CardTitle>Add property</CardTitle>
        <p className="text-sm text-muted-foreground">
          Capture the property fields from the phase-one schema so this organization has a real operational location.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="property-name">Property name</Label>
          <Input
            id="property-name"
            placeholder="Harbor Point Hotel"
            value={state.name}
            onChange={(event) => updateState("name", event.target.value)}
          />
        </div>
        <AddressAutocomplete onSelect={applyAddressSuggestion} />
        <div className="space-y-2">
          <Label htmlFor="property-code">Property code</Label>
          <Input
            id="property-code"
            placeholder="HARBOR"
            value={state.code ?? ""}
            onChange={(event) => updateState("code", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="property-status">Status</Label>
          <Select value={state.status} onValueChange={(value) => updateState("status", value as PropertyFormState["status"])}>
            <SelectTrigger id="property-status" className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {propertyStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="property-timezone">Timezone</Label>
          <Select value={state.timezone} onValueChange={(value) => updateState("timezone", value ?? "")}>
            <SelectTrigger id="property-timezone" className="w-full">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {timezoneOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="property-address-line-1">Address line 1</Label>
          <Input
            id="property-address-line-1"
            placeholder="123 Market Street"
            value={state.addressLine1 ?? ""}
            onChange={(event) => updateState("addressLine1", event.target.value)}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="property-address-line-2">Address line 2</Label>
          <Input
            id="property-address-line-2"
            placeholder="Suite 500"
            value={state.addressLine2 ?? ""}
            onChange={(event) => updateState("addressLine2", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="property-city">City</Label>
          <Input
            id="property-city"
            placeholder="Chicago"
            value={state.city ?? ""}
            onChange={(event) => updateState("city", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="property-state-region">State / region</Label>
          <Input
            id="property-state-region"
            placeholder="Illinois"
            value={state.stateRegion ?? ""}
            onChange={(event) => updateState("stateRegion", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="property-postal-code">Postal code</Label>
          <Input
            id="property-postal-code"
            placeholder="60601"
            value={state.postalCode ?? ""}
            onChange={(event) => updateState("postalCode", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="property-country-code">Country code</Label>
          <Input
            id="property-country-code"
            placeholder="US"
            value={state.countryCode ?? ""}
            onChange={(event) => updateState("countryCode", event.target.value)}
          />
        </div>
      </CardContent>
      <CardFooter className="justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          {createPropertyMutation.isError ? createPropertyMutation.error.message : "Properties remain scoped to one organization only."}
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!isValid || createPropertyMutation.isPending}
          >
            {createPropertyMutation.isPending ? "Creating property..." : "Create property"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
