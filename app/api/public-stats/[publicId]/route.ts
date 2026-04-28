import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import { storage } from "@/lib/storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await context.params;
  const stats = await storage.getStatsByPublicId(publicId);

  if (!stats) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const baseUrl = await getBaseUrl();
  return NextResponse.json({
    publicId: stats.publicId,
    url: stats.url,
    createdAt: stats.createdAt,
    lastAccessedAt: stats.lastAccessedAt,
    totalClicks: stats.totalClicks,
    qrScans: stats.qrScans,
    shortUrl: `${baseUrl}/stats/${stats.publicId}`,
  });
}
