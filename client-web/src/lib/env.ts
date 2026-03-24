function getRequiredEnv(
  name: "VITE_API_BASE_URL" | "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY"
): string {
  const value = import.meta.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOptionalEnv(
  name: "VITE_STRIPE_PUBLISHABLE_KEY" | "VITE_GOOGLE_MAPS_API_KEY"
): string | undefined {
  const value = import.meta.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export const env = {
  apiBaseUrl: trimTrailingSlash(getRequiredEnv("VITE_API_BASE_URL")),
  supabaseUrl: trimTrailingSlash(getRequiredEnv("VITE_SUPABASE_URL")),
  supabaseAnonKey: getRequiredEnv("VITE_SUPABASE_ANON_KEY"),
  stripePublishableKey: getOptionalEnv("VITE_STRIPE_PUBLISHABLE_KEY"),
  googleMapsApiKey: getOptionalEnv("VITE_GOOGLE_MAPS_API_KEY"),
};
