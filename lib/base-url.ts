import { headers } from "next/headers";

function normalizeEnvBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.replace(/\/+$/, "");
  }

  return `https://${trimmed}`.replace(/\/+$/, "");
}

export async function getBaseUrl(): Promise<string> {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (configuredBaseUrl) {
    return normalizeEnvBaseUrl(configuredBaseUrl);
  }

  const vercelProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProductionHost) {
    return normalizeEnvBaseUrl(vercelProductionHost);
  }

  const vercelHost = process.env.VERCEL_URL;
  if (vercelHost) {
    return normalizeEnvBaseUrl(vercelHost);
  }

  const headerStore = await headers();
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost ?? headerStore.get("host");

  if (host) {
    return `${forwardedProto ?? "https"}://${host}`;
  }

  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}
