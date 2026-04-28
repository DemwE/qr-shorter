"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SiteHeaderProps = {
  showHistoryLink?: boolean;
};

export default function SiteHeader({ showHistoryLink = true }: SiteHeaderProps) {
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

  const toggleTheme = () => {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  };

  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6 sm:py-8">
      <Link href="/" className="text-3xl font-extrabold text-primary sm:text-4xl">
        QR Shorter
      </Link>
      <div className="flex items-center gap-2 sm:gap-3">
        {showHistoryLink ? (
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
        ) : null}
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          Switch theme
        </button>
      </div>
    </header>
  );
}
