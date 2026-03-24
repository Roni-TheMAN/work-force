import { useEffect, useEffectEvent, useRef, useState } from "react";

import { env } from "@/lib/env";
import { loadGoogleMapsPlacesLibrary } from "@/lib/google-maps";
import { Label } from "@/components/ui/label";

type AddressSuggestion = {
  addressLine1: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  countryCode: string | null;
};

type AddressAutocompleteProps = {
  onSelect: (suggestion: AddressSuggestion) => void;
};

type AddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type GooglePlace = {
  fetchFields: (options: { fields: string[] }) => Promise<void>;
  addressComponents?: AddressComponent[];
};

type GoogleSelectEvent = Event & {
  placePrediction?: {
    toPlace: () => GooglePlace;
  };
};

type PlaceAutocompleteElementInstance = HTMLElement & {
  placeholder?: string;
  includedRegionCodes?: string[];
};

type PlacesLibrary = {
  PlaceAutocompleteElement: new () => PlaceAutocompleteElementInstance;
};

function getComponentValue(
  components: AddressComponent[],
  type: string,
  valueType: "longText" | "shortText" = "longText"
): string | null {
  const component = components.find((entry) => entry.types?.includes(type));
  const value = component?.[valueType] ?? component?.longText ?? component?.shortText;
  return value?.trim() ? value.trim() : null;
}

function parseAddressComponents(components: AddressComponent[]): AddressSuggestion {
  const streetNumber = getComponentValue(components, "street_number");
  const route = getComponentValue(components, "route", "shortText");
  const postalCode = getComponentValue(components, "postal_code");
  const postalSuffix = getComponentValue(components, "postal_code_suffix");

  return {
    addressLine1: [streetNumber, route].filter(Boolean).join(" ") || null,
    city:
      getComponentValue(components, "locality") ??
      getComponentValue(components, "postal_town") ??
      getComponentValue(components, "sublocality_level_1"),
    stateRegion: getComponentValue(components, "administrative_area_level_1", "shortText"),
    postalCode: postalSuffix && postalCode ? `${postalCode}-${postalSuffix}` : postalCode,
    countryCode: getComponentValue(components, "country", "shortText"),
  };
}

export function AddressAutocomplete({ onSelect }: AddressAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const handleAddressSelect = useEffectEvent(onSelect);

  useEffect(() => {
    if (!env.googleMapsApiKey) {
      return;
    }

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    async function mountAutocomplete() {
      try {
        await loadGoogleMapsPlacesLibrary();

        if (cancelled || !containerRef.current || !window.google?.maps?.importLibrary) {
          return;
        }

        const placesLibrary = (await window.google.maps.importLibrary("places")) as PlacesLibrary;

        if (cancelled) {
          return;
        }

        const autocompleteElement = new placesLibrary.PlaceAutocompleteElement();
        autocompleteElement.className = "google-place-autocomplete";
        autocompleteElement.placeholder = "Search property address";
        autocompleteElement.includedRegionCodes = ["us"];
        autocompleteElement.setAttribute("aria-label", "Search property address");

        const handleSelect = async (event: Event) => {
          const selectEvent = event as GoogleSelectEvent;
          const place = selectEvent.placePrediction?.toPlace();

          if (!place) {
            return;
          }

          await place.fetchFields({ fields: ["addressComponents"] });

          if (!place.addressComponents?.length) {
            return;
          }

          handleAddressSelect(parseAddressComponents(place.addressComponents));
        };

        autocompleteElement.addEventListener("gmp-select", handleSelect);
        containerRef.current.replaceChildren(autocompleteElement);

        cleanup = () => {
          autocompleteElement.removeEventListener("gmp-select", handleSelect);
          autocompleteElement.remove();
        };
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load Google Maps autocomplete.");
        }
      }
    }

    void mountAutocomplete();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [handleAddressSelect]);

  return (
    <div className="space-y-2 md:col-span-2">
      <Label htmlFor="property-address-search">Find address</Label>
      {env.googleMapsApiKey ? (
        <>
          <div
            id="property-address-search"
            ref={containerRef}
            className="rounded-xl border border-input bg-background"
          />
          <p className="text-xs text-muted-foreground">
            Search a location and the address fields below will populate automatically. You can still edit them.
          </p>
          {errorMessage ? <p className="text-xs text-destructive">{errorMessage}</p> : null}
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
          Add `VITE_GOOGLE_MAPS_API_KEY` to enable Google Maps address autocomplete.
        </p>
      )}
    </div>
  );
}
