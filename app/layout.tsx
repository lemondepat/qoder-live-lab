import type { Metadata } from "next";
import { Geist, Geist_Mono, Sulphur_Point } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sulphurPoint = Sulphur_Point({
  variable: "--font-sulphur-point",
  subsets: ["latin"],
  weight: "700",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "Qoder Live Lab",
  description: "Shape a live Hong Kong market dashboard. Watch Qoder build, verify, and ship every bounded change.",
  openGraph: {
    title: "Qoder Live Lab",
    description: "Shape the market. Watch it ship.",
    images: [{ url: "/og.png", width: 1729, height: 910, alt: "Qoder Live Lab — Ask for a change. Watch it ship." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Qoder Live Lab",
    description: "Shape the market. Watch it ship.",
    images: ["/og.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon", sizes: "32x32" },
      { url: "/qoder-favicon-v2.png", type: "image/png", sizes: "64x64" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/qoder-apple-touch-icon-v2.png", type: "image/png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${sulphurPoint.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
