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
    <div className="space-y-1 break-all">
      <span className="block font-semibold">{label}</span>
      <div className="flex items-start gap-2">
        {content}
        <CopyLinkButton value={value} label={copyLabel} />
      </div>
    </div>
  );
}