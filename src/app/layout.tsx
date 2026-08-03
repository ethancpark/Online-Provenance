import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono, Libre_Caslon_Display, Archivo } from "next/font/google";
import "./globals.css";

// §5: Fraunces (display), IBM Plex Sans (body), IBM Plex Mono (data). Weights 400/500/600 only.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fraunces",
  display: "swap",
});
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-sans",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});
// Libre Caslon Display — display serif retained for the dashboard masthead.
const libreCaslon = Libre_Caslon_Display({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-caslon",
  display: "swap",
});
// Archivo — the landing page runs on one family across weights 400-900, which
// is what keeps it from looking like a font-pairing exercise.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Online Provenance",
  description:
    "Protecting the seals and marks of Native American nations. Monitors online marketplaces for unauthorized sale of tribal seals and trademarked flags.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable} ${libreCaslon.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
