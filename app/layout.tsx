import type { Metadata } from "next";
import { Press_Start_2P, Space_Grotesk } from "next/font/google";
import "./globals.css";

const pressStart = Press_Start_2P({
  subsets: ["latin"],
  variable: "--font-pixel",
  weight: "400",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "NEARGOTCHI — your ai pet on near",
  description: "mint an ai pet on near. feed it, dress it, talk to it.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${pressStart.variable} ${spaceGrotesk.variable}`}>
      <body>{children}</body>
    </html>
  );
}
