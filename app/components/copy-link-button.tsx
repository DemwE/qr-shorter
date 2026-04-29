"use client";

import { useState } from "react";

type CopyLinkButtonProps = {
  value: string;
  label: string;
};

export default function CopyLinkButton({ value, label }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copyToClipboard}
      aria-label={`Skopiuj ${label}`}
      title={copied ? "Skopiowano" : `Skopiuj ${label}`}
      className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 text-sm font-semibold text-primary transition hover:bg-primary/20 dark:border-primary/45"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <span>{copied ? "Skopiowano" : "Copy"}</span>
    </button>
  );
}