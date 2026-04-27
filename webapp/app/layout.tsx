import type { Metadata, Viewport } from "next";
import direct from "@/data/direct_companies.json";
import "./globals.css";

export const metadata: Metadata = {
  title: `${direct.primary} IR Brief`,
  description: `${direct.primary}${direct.market && direct.ticker ? ` (${direct.market} ${direct.ticker})` : ""} IR Brief 자동 생성`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#FAFAFA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
