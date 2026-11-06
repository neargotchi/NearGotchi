import type { Metadata } from "next";
import { Press_Start_2P, Space_Grotesk } from "next/font/google";
import "./globals.css";
import BackgroundSparkles from "../components/BackgroundSparkles";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "../lib/site";
import { THEME_COLORS, themeInitScript } from "../lib/theme";
import SiteFooter from "./site-footer";
import SiteHeader from "./site-header";

const pressStart = Press_Start_2P({
  subsets: ["latin"],
  variable: "--font-pixel",
  weight: "400",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});

const TITLE = "NEARGOTCHI — your ai pet on near";
const DESCRIPTION = SITE_DESCRIPTION;

/** Defaults for every route; pages set their own canonical via pageMeta() (lib/site.ts). */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: SITE_NAME, url: "/", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-theme is set by the inline script before hydration, hence suppressHydrationWarning.
    <html lang="en" className={`${pressStart.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content={THEME_COLORS.light} suppressHydrationWarning />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <BackgroundSparkles />
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
