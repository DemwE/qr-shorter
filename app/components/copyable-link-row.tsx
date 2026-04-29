"use client";

import CopyLinkButton from "@/app/components/copy-link-button";

type CopyableLinkRowProps = {
  label: string;
  value: string;
  href?: string;
  copyLabel: string;
};

export default function CopyableLinkRow({ label, value, href, copyLabel }: CopyableLinkRowProps) {
  const content = href ? (
    <a href={href} className="min-w-0 flex-1 break-all text-primary underline" target="_blank" rel="noreferrer">
      {value}
    </a>
  ) : (
    <span className="min-w-0 flex-1 break-all">{value}</span>
  );

  return (
    <p className="flex items-start gap-2 break-all">
      <span className="shrink-0 font-semibold">{label}</span>
      {content}
      <CopyLinkButton value={value} label={copyLabel} />
    </p>
  );
}