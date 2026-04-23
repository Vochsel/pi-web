import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";

import "katex/dist/katex.min.css";
import "streamdown/styles.css";
import "./globals.css";

const sans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "pi-web demo",
  description: "AI SDK Elements demo for the Pi mono CLI agent over RPC",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): ReactNode {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable}`}>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
