import { headers } from "next/headers";

function normalizeEnvBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }

  const candidate =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname) {
      return "";
    }
    return parsed.origin;
  } catch {
    return "";
  }
}

export async function getBaseUrl(): Promise<string> {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (configuredBaseUrl) {
    const normalized = normalizeEnvBaseUrl(configuredBaseUrl);
    if (normalized) {
      return normalized;
    }
  }

  const vercelProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProductionHost) {
    const normalized = normalizeEnvBaseUrl(vercelProductionHost);
    if (normalized) {
      return normalized;
    }
  }

  const vercelHost = process.env.VERCEL_URL;
  if (vercelHost) {
    const normalized = normalizeEnvBaseUrl(vercelHost);
    if (normalized) {
      return normalized;
    }
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
