import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", weight: ["500", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: "Keyhole · Trade in private. Sell the view.",
  description:
    "Follow traders whose records come straight from their private NEAR Intents accounts. Buy a key to see their trades and copy them.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable}`}>
      <body className="flex min-h-screen flex-col bg-canvas text-ink">{children}</body>
    </html>
  );
}
