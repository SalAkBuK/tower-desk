import type { Metadata } from "next";
import { Suspense } from "react";
import localFont from "next/font/local";
import "./globals.css";
import Providers from "@/components/providers";

const spaceGrotesk = localFont({
  src: [
    { path: "../../public/fonts/space-grotesk/space-grotesk-300.ttf", weight: "300", style: "normal" },
    { path: "../../public/fonts/space-grotesk/space-grotesk-400.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/space-grotesk/space-grotesk-500.ttf", weight: "500", style: "normal" },
    { path: "../../public/fonts/space-grotesk/space-grotesk-600.ttf", weight: "600", style: "normal" },
    { path: "../../public/fonts/space-grotesk/space-grotesk-700.ttf", weight: "700", style: "normal" },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TowerDesk",
  description: "Premium Building Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={spaceGrotesk.className}>
        <Suspense fallback={null}>
          <Providers>{children}</Providers>
        </Suspense>
      </body>
    </html>
  );
}
