import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QR Shorter",
  description: "Shorten links, generate QR codes, and track stats.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-screen flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-slate-200 px-4 py-4 text-center text-sm text-slate-400 dark:border-slate-800">
          (C) 2026 - Copyright iTVT Poland Group
        </footer>
      </body>
    </html>
  );
}
