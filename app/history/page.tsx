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
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    const preferred =
      localStorage.getItem("theme") ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    return preferred === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

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

  const toggleTheme = () => {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  };

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
    <div className="min-h-full bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6 sm:py-8">
        <Link href="/" className="text-3xl font-extrabold text-primary sm:text-4xl">
          QR Shorter
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/history"
            aria-label="Open history"
            title="Open history"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-primary transition hover:bg-primary/20 dark:border-primary/45"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 3v6h6" />
              <path d="M12 7v5l3 3" />
            </svg>
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Switch theme
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8 px-4 pb-16 pt-4 text-center sm:gap-10 sm:px-6 sm:pb-20 sm:pt-8">
        <div className="space-y-4 sm:space-y-6">
          <h1 className="text-4xl font-extrabold leading-tight sm:text-6xl">
            <span className="text-primary">Historia</span> skróconych linków
          </h1>
          <p className="mx-auto max-w-3xl text-base leading-7 text-muted sm:text-lg sm:leading-9">
            Zobacz wszystkie utworzone skróty, ich statystyki i pobierz QR kod w jednym miejscu.
          </p>
        </div>

        {error ? <p className="w-full rounded-2xl bg-red-500/10 p-3 text-left text-sm text-red-500">{error}</p> : null}

        {isLoading ? <p className="w-full text-sm text-muted">Ładowanie historii...</p> : null}

        {!isLoading && !hasItems ? (
          <section className="w-full rounded-3xl border border-slate-200 bg-surface p-6 text-sm text-muted shadow-sm dark:border-slate-700">
            Brak historii. Utwórz pierwszy krótki link na stronie głównej.
          </section>
        ) : null}

        {hasItems ? (
          <section className="w-full space-y-3 text-left">
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
                      Get QR
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}
