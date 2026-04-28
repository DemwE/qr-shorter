"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type ApiResult = {
  code: string;
  publicId: string;
  url: string;
  shortUrl: string;
  qrUrl: string;
  statsUrl: string;
};

type StatsResult = {
  publicId: string;
  url: string;
  createdAt: string;
  lastAccessedAt: string | null;
  totalClicks: number;
  qrScans: number;
};

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    const preferred =
      localStorage.getItem("theme") ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    return preferred === "dark" ? "dark" : "light";
  });
  const [result, setResult] = useState<ApiResult | null>(null);
  const [stats, setStats] = useState<StatsResult | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const formattedStats = useMemo(() => {
    if (!stats) {
      return null;
    }
    return {
      created: new Date(stats.createdAt).toLocaleString(),
      lastAccessed: stats.lastAccessedAt
        ? new Date(stats.lastAccessedAt).toLocaleString()
        : "Never",
    };
  }, [stats]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
  };

  const loadStats = async (publicId: string) => {
    setIsLoadingStats(true);
    try {
      const response = await fetch(`/api/public-stats/${publicId}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load statistics.");
      }
      const payload = (await response.json()) as StatsResult;
      setStats(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to fetch statistics.");
    } finally {
      setIsLoadingStats(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStats(null);
    setResult(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not shorten URL.");
      }

      const nextResult = payload as ApiResult;
      setResult(nextResult);
      setUrl("");
      
      // Save to device history
      try {
        const historyItem = {
          publicId: nextResult.publicId,
          code: nextResult.code,
          url: nextResult.url,
          createdAt: new Date().toISOString(),
          shortUrl: nextResult.shortUrl,
          statsUrl: nextResult.statsUrl,
          qrDownloadUrl: `${nextResult.qrUrl}?format=jpg&download=1`,
        };
        const stored = localStorage.getItem("qr-history");
        const history = stored ? JSON.parse(stored) : [];
        const updated = [historyItem, ...history].slice(0, 100);
        localStorage.setItem("qr-history", JSON.stringify(updated));
      } catch {
        // Silent fail for localStorage
      }
      
      await loadStats(nextResult.publicId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6 sm:py-8">
        <div className="text-3xl font-extrabold text-primary sm:text-4xl">QR Shorter</div>
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
            <span className="text-primary">Skracaj</span>, udostępniaj,{" "}
            <span className="text-primary">dziel się</span>
          </h1>
          <p className="mx-auto max-w-3xl text-base leading-7 text-muted sm:text-lg sm:leading-9">
            Shorten long URLs, generate QR codes, and measure clicks and scans from one place.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex w-full max-w-3xl flex-col gap-3 rounded-3xl border border-slate-200 bg-surface p-3 shadow-sm sm:gap-4 sm:rounded-4xl sm:p-4 dark:border-slate-700"
        >
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              type="url"
              required
              placeholder="Wklej długi link, aby go skrócić..."
              autoComplete="url"
              autoCorrect="off"
              spellCheck={false}
              className="min-h-12 min-w-0 flex-1 rounded-full border border-slate-200 bg-white p-5 text-base outline-none transition focus:border-primary sm:min-h-14 sm:px-6 dark:border-slate-700 dark:bg-slate-900"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="h-12 w-full rounded-full bg-primary px-6 text-base font-semibold text-white shadow-lg shadow-green-500/30 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70 md:h-14 md:w-auto md:px-8 md:text-lg"
            >
              {isLoading ? "Skracam..." : "Skróć link"}
            </button>
          </div>
          {error ? (
            <p className="text-left text-sm font-medium text-red-500">{error}</p>
          ) : null}
        </form>

        {result ? (
          <section className="grid w-full max-w-4xl gap-4 md:grid-cols-[1.2fr_1fr]">
            <div className="rounded-3xl border border-slate-200 bg-surface p-4 text-left shadow-sm sm:p-6 dark:border-slate-700">
              <h2 className="mb-4 text-xl font-bold">Short link</h2>
              <div className="space-y-3 text-sm">
                <p className="break-all">
                  <span className="font-semibold">Original:</span> {result.url}
                </p>
                <p className="break-all">
                  <span className="font-semibold">Short:</span>{" "}
                  <a
                    href={result.shortUrl}
                    className="text-primary underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {result.shortUrl}
                  </a>
                </p>
                <p className="break-all">
                  <span className="font-semibold">Stats (do not share public):</span>{" "}
                  <a
                    href={result.statsUrl}
                    className="text-primary underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {result.statsUrl}
                  </a>
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadStats(result.publicId)}
                disabled={isLoadingStats}
                className="mt-6 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold transition hover:bg-slate-100 disabled:opacity-70 dark:border-slate-600 dark:hover:bg-slate-800"
              >
                {isLoadingStats ? "Refreshing..." : "Refresh stats"}
              </button>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-surface p-4 shadow-sm sm:p-6 dark:border-slate-700">
              <h2 className="mb-4 text-xl font-bold">QR code</h2>
              <Image
                src={`/api/qr/${result.code}`}
                alt={`QR code for ${result.shortUrl}`}
                width={224}
                height={224}
                unoptimized
                className="mx-auto h-auto w-full max-w-56 rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700"
              />
              <a
                href={`/api/qr/${result.code}?format=jpg&download=1`}
                download={`qr-${result.code}.jpg`}
                className="mt-4 inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold transition hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
              >
                Download QR (JPG)
              </a>
            </div>
          </section>
        ) : null}

        {stats && formattedStats ? (
          <section className="w-full max-w-4xl rounded-3xl border border-slate-200 bg-surface p-4 text-left shadow-sm sm:p-6 dark:border-slate-700">
            <h2 className="mb-4 text-xl font-bold">Statistics</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <p>
                <span className="font-semibold">Total redirects:</span> {stats.totalClicks}
              </p>
              <p>
                <span className="font-semibold">QR scans:</span> {stats.qrScans}
              </p>
              <p>
                <span className="font-semibold">Created at:</span> {formattedStats.created}
              </p>
              <p>
                <span className="font-semibold">Last accessed:</span> {formattedStats.lastAccessed}
              </p>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
