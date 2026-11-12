import type { Metadata } from "next";
import { Press_Start_2P, Space_Grotesk } from "next/font/google";
import "@near-wallet-selector/modal-ui/styles.css";
import "./globals.css";
import "./hero-header.css";
import "./sections.css";
import "./mint.css";
import "./pet.css";
import BackgroundSparkles from "../components/BackgroundSparkles";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "../lib/site";
import { THEME_COLOR } from "../lib/theme";
import SiteFooter from "./site-footer";
import SiteHeader from "./site-header";
import Toaster from "./toaster";

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
  applicationName: SITE_NAME,
  icons: {
    icon: [
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: { type: "website", siteName: SITE_NAME, url: "/", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // One theme, dark (task 093): fixed on <html>, with the page colour inline so the first paint is
    // dark before any stylesheet arrives, whatever the system preference.
    // data-scroll-behavior: smooth anchor scrolling (hero-header.css) but instant jumps between routes.
    <html
      lang="en"
      className={`${pressStart.variable} ${spaceGrotesk.variable}`}
      data-theme="dark"
      data-scroll-behavior="smooth"
      style={{ colorScheme: "dark", backgroundColor: THEME_COLOR }}
    >
      <head>
        <meta name="theme-color" content={THEME_COLOR} />
      </head>
      <body className="pixel-ui">
        <BackgroundSparkles />
        <SiteHeader />
        {children}
        <SiteFooter />
        <Toaster />
      </body>
    </html>
  );
}
