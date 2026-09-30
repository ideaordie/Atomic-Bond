import type { Metadata, Viewport } from "next";
import { PwaProvider } from "../components/pwa/PwaProvider";
import type { ReactNode } from "react";
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
export const viewport: Viewport = { themeColor: "#f3f6f8" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div id="pwa-app">{children}</div>
        <PwaProvider />
      </body>
    </html>
  );
}
