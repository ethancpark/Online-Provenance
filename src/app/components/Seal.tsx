import type { CSSProperties } from "react";

// Wax-authentication seal mark (design.md §3). Recolors via --seal-body (silhouette
// + check) and --seal-paper (ring + shield). NOT a tribal seal — neutral provenance mark.
type SealProps = {
  size?: number;
  variant?: "default" | "reversed" | "ink";
  className?: string;
};

const VARIANTS: Record<NonNullable<SealProps["variant"]>, CSSProperties> = {
  // navy on parchment — use as-is on light surfaces
  default: { ["--seal-body" as string]: "#1B2A4A", ["--seal-paper" as string]: "#F4EEE1" },
  // parchment on navy — for dark surfaces
  reversed: { ["--seal-body" as string]: "#F4EEE1", ["--seal-paper" as string]: "#1B2A4A" },
  // monochrome ink
  ink: { ["--seal-body" as string]: "#15171C", ["--seal-paper" as string]: "#F4EEE1" },
};

export default function Seal({ size = 48, variant = "default", className }: SealProps) {
  return (
    <svg
      className={className}
      style={VARIANTS[variant]}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label="Online Provenance"
    >
      <g fill="var(--seal-body, #1B2A4A)">
        <circle cx="88" cy="50" r="6" /><circle cx="85.1" cy="64.5" r="6" />
        <circle cx="76.9" cy="76.9" r="6" /><circle cx="64.5" cy="85.1" r="6" />
        <circle cx="50" cy="88" r="6" /><circle cx="35.5" cy="85.1" r="6" />
        <circle cx="23.1" cy="76.9" r="6" /><circle cx="14.9" cy="64.5" r="6" />
        <circle cx="12" cy="50" r="6" /><circle cx="14.9" cy="35.5" r="6" />
        <circle cx="23.1" cy="23.1" r="6" /><circle cx="35.5" cy="14.9" r="6" />
        <circle cx="50" cy="12" r="6" /><circle cx="64.5" cy="14.9" r="6" />
        <circle cx="76.9" cy="23.1" r="6" /><circle cx="85.1" cy="35.5" r="6" />
        <circle cx="50" cy="50" r="38" />
      </g>
      <circle cx="50" cy="50" r="30" fill="none" stroke="var(--seal-paper, #F4EEE1)" strokeWidth="2.4" />
      <path d="M37 36 L63 36 L63 51 Q63 60 50 66 Q37 60 37 51 Z" fill="var(--seal-paper, #F4EEE1)" />
      <path
        d="M43.5 49.5 L48.5 55.5 L57 44.5"
        fill="none"
        stroke="var(--seal-body, #1B2A4A)"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
