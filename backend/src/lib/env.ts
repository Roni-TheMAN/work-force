import dotenv from "dotenv";

dotenv.config();

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOptionalEnv(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}

function getPort(): number {
  const rawPort = getOptionalEnv("PORT", "4000");
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
  }

  return port;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

const supabaseUrl = trimTrailingSlash(getRequiredEnv("SUPABASE_URL"));
const clientWebUrl = trimTrailingSlash(getOptionalEnv("CLIENT_WEB_URL", "http://localhost:5173") ?? "http://localhost:5173");

export const env = {
  nodeEnv: getOptionalEnv("NODE_ENV", "development") ?? "development",
  port: getPort(),
  databaseUrl: getRequiredEnv("DATABASE_URL"),
  supabaseUrl,
  supabaseIssuer: `${supabaseUrl}/auth/v1`,
  supabaseAnonKey: getOptionalEnv("SUPABASE_ANON_KEY"),
  supabaseJwtSecret: getOptionalEnv("SUPABASE_JWT_SECRET"),
  clientWebUrl,
  appDomain: trimTrailingSlash(getOptionalEnv("APP_DOMAIN", clientWebUrl) ?? clientWebUrl),
  stripeSecretKey: getOptionalEnv("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: getOptionalEnv("STRIPE_WEBHOOK_SECRET"),
  employeePinSecret: getOptionalEnv("EMPLOYEE_PIN_SECRET"),
  docusealApiUrl: trimTrailingSlash(getOptionalEnv("DOCUSEAL_API_URL", "https://api.docuseal.com") ?? "https://api.docuseal.com"),
  docusealApiKey: getOptionalEnv("DOCUSEAL_API_KEY"),
  docusealEmbedHost: trimTrailingSlash(getOptionalEnv("DOCUSEAL_EMBED_HOST", "https://docuseal.com") ?? "https://docuseal.com"),
  docusealAdminEmail: getOptionalEnv("DOCUSEAL_ADMIN_EMAIL", getOptionalEnv("DOCUSEAL_USER_EMAIL")),
  docusealUserEmail: getOptionalEnv("DOCUSEAL_USER_EMAIL"),
  docusealWebhookSecret: getOptionalEnv("DOCUSEAL_WEBHOOK_SECRET"),
  documentUploadPublicBaseUrl: getOptionalEnv("DOCUMENT_UPLOAD_PUBLIC_BASE_URL")
    ? trimTrailingSlash(getOptionalEnv("DOCUMENT_UPLOAD_PUBLIC_BASE_URL") as string)
    : undefined,
};
