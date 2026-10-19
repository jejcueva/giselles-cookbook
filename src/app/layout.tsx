import type { Metadata, Viewport } from "next";
import { Dancing_Script, Nunito, Playfair_Display } from "next/font/google";
import "./globals.css";
import "../styles/recruiter.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ViewerProvider } from "@/components/viewer-provider";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const dancingScript = Dancing_Script({
  variable: "--font-dancing",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jizzy's Cookbook",
  description: "A cozy recipe space built for Phase 1 foundation.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${nunito.variable} ${playfair.variable} ${dancingScript.variable}`}>
        <ThemeProvider>
          <ViewerProvider>{children}</ViewerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
