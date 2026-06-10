import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "第37回全日本大会 - 入退場管理",
  description: "第37回 模擬国連会議全日本大会 入退場管理システム",

  robots: {
    index: false,
    follow: false,
  },
};

// Nonce-based CSP (see proxy.ts) requires dynamic rendering: a per-request
// nonce only exists at request time, so statically pre-rendered pages would
// ship nonce-less inline scripts that the CSP then blocks. Forcing dynamic
// rendering at the root applies the nonce to every route.
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
