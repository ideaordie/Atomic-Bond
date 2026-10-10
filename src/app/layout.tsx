import type { Metadata, Viewport } from "next";
import { WebAnalytics } from "../components/analytics/WebAnalytics";
import { PwaProvider } from "../components/pwa/PwaProvider";
import type { ReactNode } from "react";
import { AppearanceSync } from "../components/appearance/appearance";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atomic Bond",
  description: "See how connected we already are.",
  appleWebApp: {
    capable: true,
    title: "Atomic Bond",
    statusBarStyle: "default",
  },
  icons: { apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Shared with the standalone offline document. */}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/design-tokens.css" />
        {/* Static local initializer runs before body paint; never contains user data. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/appearance-init.js" />
      </head>
      <body>
        <AppearanceSync />
        <div id="pwa-app">{children}</div>
        <PwaProvider />
        <WebAnalytics />
      </body>
    </html>
  );
}
