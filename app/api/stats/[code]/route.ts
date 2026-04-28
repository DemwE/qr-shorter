import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import { storage } from "@/lib/storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const stats = await storage.getStats(code);

  if (!stats) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const baseUrl = await getBaseUrl();
  return NextResponse.json({
    ...stats,
    shortUrl: `${baseUrl}/${stats.code}`,
    statsUrl: `${baseUrl}/stats/${stats.publicId}`,
    qrUrl: `${baseUrl}/api/qr/${stats.code}`,
  });
}
