import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import { storage } from "@/lib/storage";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitRaw = Number(searchParams.get("limit") ?? "30");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 100)) : 30;

  const history = await storage.listHistory(limit);
  const baseUrl = await getBaseUrl();

  return NextResponse.json({
    items: history.map((item) => ({
      publicId: item.publicId,
      code: item.code,
      url: item.url,
      createdAt: item.createdAt,
      lastAccessedAt: item.lastAccessedAt,
      totalClicks: item.totalClicks,
      qrScans: item.qrScans,
      shortUrl: `${baseUrl}/${item.code}`,
      statsUrl: `${baseUrl}/stats/${item.publicId}`,
      qrDownloadUrl: `${baseUrl}/api/qr/${item.code}?format=jpg&download=1`,
    })),
  });
}
