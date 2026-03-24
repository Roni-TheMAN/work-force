import { env } from "@/lib/env";

declare global {
  interface Window {
    google?: {
      maps?: {
        importLibrary?: (library: string) => Promise<unknown>;
      };
    };
  }
}

const GOOGLE_MAPS_SCRIPT_ID = "google-maps-javascript-api";

let googleMapsLoadPromise: Promise<void> | null = null;

function createScriptElement(apiKey: string): HTMLScriptElement {
  const script = document.createElement("script");
  script.id = GOOGLE_MAPS_SCRIPT_ID;
  script.async = true;
  script.defer = true;
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&libraries=places&v=weekly`;
  return script;
}

export function loadGoogleMapsPlacesLibrary(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser."));
  }

  const apiKey = env.googleMapsApiKey;

  if (!apiKey) {
    return Promise.reject(new Error("Missing VITE_GOOGLE_MAPS_API_KEY."));
  }

  if (window.google?.maps?.importLibrary) {
    return Promise.resolve();
  }

  if (googleMapsLoadPromise) {
    return googleMapsLoadPromise;
  }

  googleMapsLoadPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Google Maps.")), { once: true });
      return;
    }

    const script = createScriptElement(apiKey);
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Failed to load Google Maps.")), { once: true });
    document.head.appendChild(script);
  }).catch((error) => {
    googleMapsLoadPromise = null;
    throw error;
  });

  return googleMapsLoadPromise;
}
