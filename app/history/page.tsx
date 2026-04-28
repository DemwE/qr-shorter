"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type HistoryItem = {
  publicId: string;
  code: string;
  url: string;
  createdAt: string;
  lastAccessedAt: string | null;
  totalClicks: number;
  qrScans: number;
  shortUrl: string;
  statsUrl: string;
  qrDownloadUrl: string;
};

type HistoryResponse = {
  items: HistoryItem[];
};

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedPublicId, setCopiedPublicId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/history?limit=50", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Nie udało się pobrać historii.");
        }
        const payload = (await response.json()) as HistoryResponse;
        setItems(payload.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Błąd pobierania historii.");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const hasItems = useMemo(() => items.length > 0, [items]);

  const copyShortUrl = async (publicId: string, shortUrl: string) => {
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopiedPublicId(publicId);
      setTimeout(() => {
        setCopiedPublicId((current) => (current === publicId ? null : current));
      }, 1500);
    } catch {
      setError("Nie udało się skopiować linku.");
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-primary sm:text-3xl">Historia skróconych linków</h1>
        <Link
          href="/"
          className="rounded-full border border-primary/35 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20"
        >
          Nowy link
        </Link>
      </header>

      {error ? <p className="rounded-2xl bg-red-500/10 p-3 text-sm text-red-500">{error}</p> : null}

      {isLoading ? <p className="text-sm text-muted">Ładowanie historii...</p> : null}

      {!isLoading && !hasItems ? (
        <section className="rounded-3xl border border-slate-200 bg-surface p-6 text-sm text-muted shadow-sm dark:border-slate-700">
          Brak historii. Utwórz pierwszy krótki link na stronie głównej.
        </section>
      ) : null}

      {hasItems ? (
        <section className="space-y-3">
          {items.map((item) => (
            <article
              key={item.publicId}
              className="rounded-3xl border border-slate-200 bg-surface p-4 shadow-sm dark:border-slate-700"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2 text-sm">
                  <p className="truncate text-base font-semibold text-foreground">/{item.code}</p>
                  <p className="truncate text-muted" title={item.url}>
                    {item.url}
                  </p>
                  <p className="text-xs text-muted">Utworzono: {new Date(item.createdAt).toLocaleString()}</p>
                  <p className="text-xs text-muted">
                    Kliknięcia: {item.totalClicks} • QR: {item.qrScans}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 sm:pl-4">
                  <a
                    href={item.statsUrl}
                    className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20"
                  >
                    Stats
                  </a>
                  <button
                    type="button"
                    onClick={() => copyShortUrl(item.publicId, item.shortUrl)}
                    className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20"
                  >
                    {copiedPublicId === item.publicId ? "Skopiowano" : "Kopiuj"}
                  </button>
                  <a
                    href={item.qrDownloadUrl}
                    download={`qr-${item.code}.jpg`}
                    className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    Download
                  </a>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}
