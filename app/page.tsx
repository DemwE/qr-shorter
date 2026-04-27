"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";

type ApiResult = {
  code: string;
  url: string;
  shortUrl: string;
  qrUrl: string;
  statsUrl: string;
};

type StatsResult = {
  code: string;
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

  const loadStats = async (code: string) => {
    setIsLoadingStats(true);
    try {
      const response = await fetch(`/api/stats/${code}`, { cache: "no-store" });
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
      await loadStats(nextResult.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
        <div className="text-4xl font-extrabold text-primary">QR Shorter</div>
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          {theme === "light" ? "Dark mode" : "Light mode"}
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-col items-center gap-10 px-6 pb-20 pt-8 text-center">
        <div className="space-y-6">
          <h1 className="text-5xl font-extrabold leading-tight sm:text-6xl">
            <span className="text-primary">Skracaj</span>, udostępniaj,{" "}
            <span className="text-primary">mierz</span>
          </h1>
          <p className="mx-auto max-w-3xl text-lg leading-9 text-muted">
            Shorten long URLs, generate QR codes, and measure clicks and scans from one place.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex w-full max-w-3xl flex-col gap-4 rounded-4xl border border-slate-200 bg-surface p-4 shadow-sm dark:border-slate-700"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="url"
              required
              placeholder="Wklej długi link, aby go skrócić..."
              className="h-14 flex-1 rounded-full border border-slate-200 bg-white px-6 text-base outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-900"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="h-14 rounded-full bg-primary px-8 text-lg font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
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
            <div className="rounded-3xl border border-slate-200 bg-surface p-6 text-left shadow-sm dark:border-slate-700">
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
                <p className="text-muted">
                  QR scans are tracked with <code>?src=qr</code>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadStats(result.code)}
                disabled={isLoadingStats}
                className="mt-6 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold transition hover:bg-slate-100 disabled:opacity-70 dark:border-slate-600 dark:hover:bg-slate-800"
              >
                {isLoadingStats ? "Refreshing..." : "Refresh stats"}
              </button>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-surface p-6 shadow-sm dark:border-slate-700">
              <h2 className="mb-4 text-xl font-bold">QR code</h2>
              <Image
                src={`/api/qr/${result.code}`}
                alt={`QR code for ${result.shortUrl}`}
                width={224}
                height={224}
                unoptimized
                className="mx-auto rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700"
              />
            </div>
          </section>
        ) : null}

        {stats && formattedStats ? (
          <section className="w-full max-w-4xl rounded-3xl border border-slate-200 bg-surface p-6 text-left shadow-sm dark:border-slate-700">
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
