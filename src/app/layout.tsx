import type { Metadata } from "next";
import { Newsreader, Libre_Franklin } from "next/font/google";
import "./globals.css";

// Handoff typography: "anything that speaks is serif; anything that labels is
// sans." Newsreader carries headings, body and numerals; Libre Franklin
// carries nav, labels, buttons and captions. No monospace anywhere.
//
// The sans was Familjen Grotesk, whose single-storey "a" is the giveaway of
// the geometric-grotesk family every template reaches for. Libre Franklin is
// Franklin Gothic's descendant — the American newspaper and civic workhorse —
// which suits a records tool, and its humanist proportions sit with Newsreader
// rather than against it.
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});
const libreFranklin = Libre_Franklin({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Online Provenance",
  description:
    "Protecting the seals and marks of Tribal nations. Monitors online marketplaces for unauthorized sale of Tribal seals and trademarked flags.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${newsreader.variable} ${libreFranklin.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
