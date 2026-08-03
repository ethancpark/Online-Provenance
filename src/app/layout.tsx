import type { Metadata } from "next";
import { Newsreader, Familjen_Grotesk } from "next/font/google";
import "./globals.css";

// Handoff typography: "anything that speaks is serif; anything that labels is
// sans." Newsreader carries headings, body and numerals; Familjen Grotesk
// carries nav, labels, buttons and captions. No monospace anywhere.
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});
const familjen = Familjen_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
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
    <html lang="en" className={`${newsreader.variable} ${familjen.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
