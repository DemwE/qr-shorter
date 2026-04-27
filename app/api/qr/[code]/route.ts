import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getBaseUrl } from "@/lib/base-url";
import { storage } from "@/lib/storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const link = await storage.getByCode(code);
  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const baseUrl = await getBaseUrl();
  const qrDestination = `${baseUrl}/${code}?src=qr`;
  const svg = await QRCode.toString(qrDestination, {
    type: "svg",
    width: 320,
    margin: 1,
    color: {
      dark: "#1d4ed8",
      light: "#ffffff",
    },
  });

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
