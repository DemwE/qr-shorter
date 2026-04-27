import { headers } from "next/headers";

export async function getBaseUrl(): Promise<string> {
  const headerStore = await headers();
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost ?? headerStore.get("host");

  if (host) {
    return `${forwardedProto ?? "https"}://${host}`;
  }

  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}
