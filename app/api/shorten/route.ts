import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Redis } from "@upstash/redis";
import { getBaseUrl } from "@/lib/base-url";
import { storage } from "@/lib/storage";
import { createHash } from "node:crypto";

function normalizeUrl(rawValue: unknown): string {
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    throw new Error("URL is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(rawValue.trim());
  } catch {
    throw new Error("Invalid URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http/https URLs are allowed.");
  }

  return parsed.toString();
}

function getClientIdentifier(headerStore: Headers): string {
  const forwardedFor = headerStore.get("x-forwarded-for");
  const userAgent = headerStore.get("user-agent") || "";
  const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
  const userAgentHash = createHash("sha256").update(userAgent).digest("hex").slice(0, 8);
  return `${ip}:${userAgentHash}`;
}

async function checkRateLimit(clientId: string): Promise<{ allowed: boolean; waitSeconds?: number }> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { allowed: true };
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  const key = `rate-limit:${clientId}`;
  const maxRequests = 5;
  const windowSeconds = 30;

  try {
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    if (current > maxRequests) {
      const ttl = await redis.ttl(key);
      return { allowed: false, waitSeconds: ttl || windowSeconds };
    }

    return { allowed: true };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    return { allowed: true };
  }
}

export async function POST(request: Request) {
  try {
    const headerStore = await headers();
    const clientId = getClientIdentifier(headerStore);
    const rateLimitCheck = await checkRateLimit(clientId);

    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Error: Przekroczono limit. Spróbuj ponownie za ${rateLimitCheck.waitSeconds} sekund.`,
          retryAfter: rateLimitCheck.waitSeconds,
        },
        { status: 429 },
      );
    }

    const body = await request.json();
    const url = normalizeUrl(body?.url);
    const created = await storage.createShortLink(url);
    const baseUrl = await getBaseUrl();

    return NextResponse.json(
      {
        code: created.code,
        publicId: created.publicId,
        url: created.url,
        shortUrl: `${baseUrl}/${created.code}`,
        qrUrl: `${baseUrl}/api/qr/${created.code}`,
        statsUrl: `${baseUrl}/stats/${created.publicId}`,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się skrócić URL." },
      { status: 400 },
    );
  }
}
