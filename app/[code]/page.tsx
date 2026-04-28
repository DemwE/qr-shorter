import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

function getClientIp(headerStore: Headers): string | null {
  const forwardedFor = headerStore.get("x-forwarded-for");
  if (!forwardedFor) {
    return null;
  }
  return forwardedFor.split(",")[0]?.trim() ?? null;
}

export default async function ShortCodePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ src?: string }>;
}) {
  const { code } = await params;
  const { src } = await searchParams;
  const link = await storage.getByCode(code);

  if (!link) {
    notFound();
  }

  const headerStore = await headers();
  const isQrScan = src === "qr";

  await storage.recordRedirect(code, {
    type: isQrScan ? "qr_scan" : "redirect",
    ip: getClientIp(headerStore),
    userAgent: headerStore.get("user-agent"),
    referer: headerStore.get("referer"),
  });

  redirect(link.url);
}
