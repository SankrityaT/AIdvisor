import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono, Manrope, Sora } from "next/font/google";
import "./globals.css";

// Landing page typography
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-jb", display: "swap" });

// Advisor app typography — referenced by the @theme tokens in globals.css
const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: "AIDVisor — Your AI Advisor for ASU",
  description:
    "AIDVisor is the AI advisor every Sun Devil can turn to. It builds your route to graduation and reroutes it live the moment a class falls through.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${sora.variable} ${manrope.variable} ${jetbrainsMono.variable} ${geistSans.variable} ${geistMono.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
