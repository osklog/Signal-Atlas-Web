import type { Metadata } from "next";
import { Cormorant_Garamond, IBM_Plex_Sans } from "next/font/google";

import { SiteHeader } from "@/components/site-header";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/config";

import "./globals.css";

const editorialSerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-editorial",
});

const uiSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ui",
});

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${editorialSerif.variable} ${uiSans.variable}`}>
        <div className="app-background">
          <div className="background-glow glow-left" />
          <div className="background-glow glow-right" />
        </div>
        <div className="app-shell">
          <SiteHeader />
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
