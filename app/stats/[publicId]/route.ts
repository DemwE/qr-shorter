import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";

function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) {
    return null;
  }
  return forwardedFor.split(",")[0]?.trim() ?? null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await context.params;
  const link = await storage.getByPublicId(publicId);

  if (!link) {
    return NextResponse.redirect(new URL("/", request.url), { status: 302 });
  }

  const url = new URL(request.url);
  const isQrScan = url.searchParams.get("src") === "qr";

  await storage.recordRedirect(link.code, {
    type: isQrScan ? "qr_scan" : "redirect",
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    referer: request.headers.get("referer"),
  });

  return NextResponse.redirect(link.url, { status: 307 });
}
