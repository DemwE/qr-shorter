import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBaseUrl } from "@/lib/base-url";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function StatsDetailsPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const stats = await storage.getStatsByPublicId(publicId);

  if (!stats) {
    notFound();
  }

  const baseUrl = await getBaseUrl();
  const shortUrl = `${baseUrl}/${stats.code}`;
  const statsUrl = `${baseUrl}/stats/${stats.publicId}`;
  const qrDownloadUrl = `/api/qr/${stats.code}?format=jpg&download=1`;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-primary sm:text-3xl">Szczegóły linku</h1>
        <Link
          href="/history"
          className="rounded-full border border-primary/35 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20"
        >
          Historia
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-surface p-4 text-left shadow-sm sm:p-6 dark:border-slate-700">
          <h2 className="mb-4 text-xl font-bold">Przekierowanie</h2>
          <div className="space-y-3 text-sm">
            <p className="break-all">
              <span className="font-semibold">Oryginalny URL:</span> {stats.url}
            </p>
            <p className="break-all">
              <span className="font-semibold">Krótki link:</span>{" "}
              <a href={shortUrl} className="text-primary underline" target="_blank" rel="noreferrer">
                {shortUrl}
              </a>
            </p>
            <p className="break-all">
              <span className="font-semibold">Stats ID:</span>{" "}
              <a href={statsUrl} className="text-primary underline" target="_blank" rel="noreferrer">
                {statsUrl}
              </a>
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-surface p-4 text-center shadow-sm sm:p-6 dark:border-slate-700">
          <h2 className="mb-4 text-xl font-bold">QR code</h2>
          <Image
            src={`/api/qr/${stats.code}`}
            alt={`QR code for ${shortUrl}`}
            width={224}
            height={224}
            unoptimized
            className="mx-auto h-auto w-full max-w-56 rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700"
          />
          <a
            href={qrDownloadUrl}
            download={`qr-${stats.code}.jpg`}
            className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Download QR (JPG)
          </a>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-surface p-4 text-left shadow-sm sm:p-6 dark:border-slate-700">
        <h2 className="mb-4 text-xl font-bold">Statystyki</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <p>
            <span className="font-semibold">Przekierowania:</span> {stats.totalClicks}
          </p>
          <p>
            <span className="font-semibold">Skanowania QR:</span> {stats.qrScans}
          </p>
          <p>
            <span className="font-semibold">Utworzono:</span> {new Date(stats.createdAt).toLocaleString()}
          </p>
          <p>
            <span className="font-semibold">Ostatni dostęp:</span>{" "}
            {stats.lastAccessedAt ? new Date(stats.lastAccessedAt).toLocaleString() : "Nigdy"}
          </p>
        </div>
      </section>
    </main>
  );
}
