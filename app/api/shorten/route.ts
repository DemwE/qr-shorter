import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import { storage } from "@/lib/storage";

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

export async function POST(request: Request) {
  try {
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
      { error: error instanceof Error ? error.message : "Unable to shorten URL." },
      { status: 400 },
    );
  }
}
