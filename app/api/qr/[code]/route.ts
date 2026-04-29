import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getBaseUrl } from "@/lib/base-url";
import { storage } from "@/lib/storage";

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const link = await storage.getByCode(code);
  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const baseUrl = await getBaseUrl();
  const qrDestination = `${baseUrl}/${link.code}?src=qr`;
  const requestUrl = new URL(request.url);
  const format = requestUrl.searchParams.get("format") === "jpg" ? "jpg" : "svg";
  const shouldDownload = requestUrl.searchParams.get("download") === "1";

  if (format === "jpg") {
    const jpgDataUrl = await QRCode.toDataURL(qrDestination, {
      type: "image/jpeg",
      width: 640,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });
    const base64 = jpgDataUrl.split(",")[1] ?? "";
    const jpgBuffer = Buffer.from(base64, "base64");

    return new NextResponse(jpgBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        ...(shouldDownload
          ? { "Content-Disposition": `attachment; filename="qr-${code}.jpg"` }
          : {}),
      },
    });
  }

  const svg = await QRCode.toString(qrDestination, {
    type: "svg",
    width: 320,
    margin: 1,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      ...(shouldDownload
        ? { "Content-Disposition": `attachment; filename="qr-${code}.svg"` }
        : {}),
    },
  });
}
