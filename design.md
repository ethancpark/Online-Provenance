# Online Provenance — Design Specification

This file is the single source of truth for the visual design of Online Provenance.
Any UI work — new pages, components, or redesigns — must follow it. When something
here conflicts with an older pattern in the codebase, this file wins.

Build order for any redesign: **tokens first** (colors, fonts, spacing as variables),
then **one page at a time**. Never regenerate the whole UI in a single pass — that is
what produces generic, templated output.

---

## 1. What this is

Online Provenance monitors online marketplaces for the unauthorized sale of Native
American tribal seals and trademarked flags, flags likely infringements with a
confidence score, and helps tribes get those listings removed.

- **Name:** Online Provenance
- **Tagline:** Protecting the seals and marks of Native American nations
- **Mission line (for hero / about):** Across 574 federally recognized tribes, sacred
  seals and trademarked flags are sold by third-party sellers on Amazon, Temu, and
  Alibaba with no consent, credit, or compensation. AI-generated slop has only made the
  theft faster. Online Provenance finds it, documents it, and helps tribes get it removed.

The product should feel **institutional and trustworthy** — closer to a government
registry or a legal-tech tool than a SaaS dashboard or a crypto app. It carries an
**enforcement edge**: it is a tool for catching and stopping infringers.

---

## 2. Design principles

1. **No Native imagery. This is non-negotiable.** Do not use tribal seals, feathers,
   dreamcatchers, arrowheads, "tribal" patterns, war bonnets, turquoise-and-terracotta
   color schemes, or any other Indigenous visual motif anywhere in the brand or UI. The
   tool exists *because* people misuse these symbols; the brand must visibly not be an
   appropriator. The mission is carried entirely through neutral concepts: authentication,
   provenance, vigilance, and protection.

2. **Color encodes meaning, never decoration.** Navy and ink are the only "chrome"
   colors. Parchment is the record surface. The three signal colors (vermillion, amber,
   green) are reserved exclusively for enforcement states. If a color appears, it should
   mean something.

3. **Restraint over decoration.** Generous whitespace, one primary action per view,
   minimal borders. "Too cluttered" is the most common failure mode — default to quieter.

4. **Institutional, not flashy.** No gradients, no drop shadows, no glows, no neon. Flat
   surfaces, hairline borders, confident type. Authority comes from clarity, not effects.

5. **A forensic, on-the-record feel.** Listing IDs, match scores, and timestamps are set
   in monospace. The interface should feel like a case file, because that is what it is.

---

## 3. Logo and mark

The mark is a stylized **wax authentication seal** — historically the object that proved
a document was genuine and untampered. It means exactly what the product does. The
scalloped edge is the distinctive, ownable element; the inner shield-and-check reads as
"protected and verified."

### Usage
- **Primary lockup:** navy seal on parchment, with the wordmark below or beside it.
- **App icon:** reversed — parchment seal on a solid navy rounded square.
- **Favicon / small contexts:** the mark alone, no wordmark. It is designed to stay
  legible down to 16px.
- **Wordmark:** "ONLINE PROVENANCE" in Fraunces, uppercase, letter-spacing `0.13em`,
  weight 600. This is the one place uppercase is allowed (it is a designed wordmark, not
  UI copy).
- Clear space around the mark equal to at least the height of the inner shield.

### Don'ts
- Never recolor the mark outside the brand palette.
- Never add effects (shadow, gradient, outline glow).
- Never place the navy mark on a busy or low-contrast background — use the reversed
  version on dark surfaces.

### SVG (drop-in component)

The mark uses two CSS variables so it can be recolored per context:
`--seal-body` (the silhouette + check) and `--seal-paper` (the ring + shield).

```html
<svg class="op-seal" viewBox="0 0 100 100" width="48" height="48" role="img" aria-label="Online Provenance">
  <g fill="var(--seal-body, #1B2A4A)">
    <circle cx="88" cy="50" r="6"/><circle cx="85.1" cy="64.5" r="6"/>
    <circle cx="76.9" cy="76.9" r="6"/><circle cx="64.5" cy="85.1" r="6"/>
    <circle cx="50" cy="88" r="6"/><circle cx="35.5" cy="85.1" r="6"/>
    <circle cx="23.1" cy="76.9" r="6"/><circle cx="14.9" cy="64.5" r="6"/>
    <circle cx="12" cy="50" r="6"/><circle cx="14.9" cy="35.5" r="6"/>
    <circle cx="23.1" cy="23.1" r="6"/><circle cx="35.5" cy="14.9" r="6"/>
    <circle cx="50" cy="12" r="6"/><circle cx="64.5" cy="14.9" r="6"/>
    <circle cx="76.9" cy="23.1" r="6"/><circle cx="85.1" cy="35.5" r="6"/>
    <circle cx="50" cy="50" r="38"/>
  </g>
  <circle cx="50" cy="50" r="30" fill="none" stroke="var(--seal-paper, #F4EEE1)" stroke-width="2.4"/>
  <path d="M37 36 L63 36 L63 51 Q63 60 50 66 Q37 60 37 51 Z" fill="var(--seal-paper, #F4EEE1)"/>
  <path d="M43.5 49.5 L48.5 55.5 L57 44.5" fill="none" stroke="var(--seal-body, #1B2A4A)"
        stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

- Default (navy on parchment): use as-is.
- Reversed (parchment on navy): set `--seal-body: #F4EEE1; --seal-paper: #1B2A4A;`.
- Monochrome ink: set `--seal-body: #15171C; --seal-paper: #F4EEE1;`.

---

## 4. Color

Locked palette. Use these exact values. Do not introduce new colors without updating
this file.

### Core (chrome and surfaces)

| Token | Hex | Role |
|---|---|---|
| `--color-navy` | `#1B2A4A` | Primary brand. Headings on light, dark panels, hero, footer. |
| `--color-navy-deep` | `#15203A` | Deepest panels, hover state on navy. |
| `--color-ink` | `#15171C` | Primary text on light surfaces. |
| `--color-parchment` | `#F4EEE1` | Page background. The "record" surface. |
| `--color-surface` | `#FBF9F4` | Card / panel background (sits on parchment). |
| `--color-border` | `#E4DFD3` | Hairline borders and dividers. |
| `--color-text-secondary` | `#4A453D` | Supporting body text on light. |
| `--color-text-muted` | `#8A8275` | Labels, captions, metadata. |
| `--color-on-navy` | `#E8E0D0` | Body text on navy surfaces. |
| `--color-on-navy-strong` | `#F4EEE1` | Headings / wordmark on navy. |

### Signal (enforcement states only)

Each has a **solid** form (filled chips/buttons, usually on dark) and a **tint** form
(badges on light surfaces). Never use these as decoration.

| Meaning | Solid bg | Text on solid | Tint bg | Text on tint |
|---|---|---|---|---|
| High severity / confirmed infringement | `#C23B22` | `#F8E9E5` | `#F7E6E1` | `#8A2716` |
| Flagged for review / medium match | `#C8851A` | `#2A1B02` | `#FAEED9` | `#6B4506` |
| Verified authentic / protected / removed | `#2E6B4F` | `#E3F0EA` | `#E2EFE8` | `#1E4A36` |

> Note on the vermillion: keep it caged to high-severity alerts only. A warm red used
> broadly drifts toward a Southwest/Native palette cliché, which is exactly what we avoid.
> Used sparingly on alerts, it reads as "alert," not as styling.

This palette maps directly onto the existing high/medium-match badge logic in the
dashboard — reuse it there rather than inventing new colors.

---

## 5. Typography

Three families, all free on Google Fonts.

- **Fraunces** — display and headings. Carries heritage and gravity (the "provenance"
  feel) without being generic.
- **IBM Plex Sans** — interface and body. Institutional and legible; reads as serious
  infrastructure.
- **IBM Plex Mono** — listing IDs, match scores, timestamps, and any on-the-record data.
  This is the forensic layer; do not skip it.

### Embed

Add to `<head>` (confirm the exact current snippet at fonts.google.com when wiring up):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
```

```css
--font-display: 'Fraunces', Georgia, serif;
--font-body: 'IBM Plex Sans', system-ui, sans-serif;
--font-mono: 'IBM Plex Mono', ui-monospace, monospace;
```

### Scale

| Use | Family | Size | Weight | Line height |
|---|---|---|---|---|
| Display / hero | Fraunces | 2.75rem (44px) | 600 | 1.15 |
| H1 | Fraunces | 2.25rem (36px) | 600 | 1.2 |
| H2 | Fraunces | 1.625rem (26px) | 500 | 1.25 |
| H3 | IBM Plex Sans | 1.25rem (20px) | 500 | 1.3 |
| Body | IBM Plex Sans | 1rem (16px) | 400 | 1.65 |
| Small / caption | IBM Plex Sans | 0.875rem (14px) | 400 | 1.5 |
| Label / eyebrow | IBM Plex Sans | 0.75rem (12px) | 500 | 1.4, letter-spacing 0.04em |
| Data (IDs, scores) | IBM Plex Mono | 0.8125rem (13px) | 400 | 1.4 |

Rules: **sentence case everywhere** except the wordmark. Keep body line length to roughly
60–75 characters. Only ever use weights 400 and 500/600 — no 700.

---

## 6. Spacing, radius, borders

**Spacing — 8px grid.** Use only these step values; no arbitrary margins.

```css
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;  --space-4: 16px;
--space-6: 24px;  --space-8: 32px;  --space-12: 48px; --space-16: 64px;
```

**Radius.**

```css
--radius-sm: 8px;   /* controls, buttons, inputs, badges */
--radius-md: 12px;  /* cards and panels */
--radius-pill: 999px; /* status chips */
```

**Borders.** Hairline only: `0.5px solid var(--color-border)` (or `1px` if 0.5 renders
inconsistently in your stack). No heavy borders. Featured/recommended elements may use a
single `2px` accent border in navy.

---

## 7. Components

- **Buttons.** Primary action = solid navy bg, parchment text, `--radius-sm`. One primary
  per view. Secondary = transparent bg with hairline border, ink text. The "Report /
  Confirm infringing" destructive action is the one place vermillion is allowed as a
  button fill. No emoji in buttons — see icons below.
- **Cards / panels.** `--color-surface` bg, hairline border, `--radius-md`, padding
  `--space-6`. No shadow.
- **Status badges.** Pill shape, tint form on light surfaces, solid form on navy. Map to
  the signal colors: high match → vermillion, medium → amber, verified/removed → green.
- **Metric cards** (e.g. "Listings flagged: 15"). Muted 12px label above, large
  Fraunces or Plex number below. No border, subtle surface fill.
- **Data fields** (listing ID, match confidence, price, URL). Set values in IBM Plex Mono.

### Icons
Replace **all** emoji currently in the UI (📄 📋 🚩 ✓ ✕ etc.) with a single consistent
outline icon set — **Lucide** is the recommended choice. Mixed unicode glyphs are the
strongest "AI-generated" tell in the current build. Pick one set and use it everywhere.

---

## 8. Implementation notes (for the coding agent)

1. **Create `tokens.css` first** with every variable in sections 4–6 (or the equivalent
   Tailwind `theme.extend` config). Nothing in components should be a hardcoded hex,
   font, or pixel value — everything references a token.
2. **Wire up the three fonts** via the embed in section 5 before styling anything.
3. **Add the seal SVG** as a reusable component (section 3).
4. **Swap emoji for Lucide icons** (section 7) as an early, mechanical pass.
5. **Redesign one page at a time.** Suggested order: landing page first (review it), then
   the dashboard / review queue. Do not redesign everything in one prompt.
6. On the dashboard, **reuse the signal palette** for the existing match-confidence
   badges so the new design reinforces the existing logic instead of replacing it.
7. Casing fix: "Indigenous Scraper" and "Infringement monitor" used inconsistent casing.
   Standardize all UI to sentence case, with "Online Provenance" as the only proper-noun
   wordmark.

---

## 9. Do / Don't summary

| Do | Don't |
|---|---|
| Parchment + navy + ink as the base | Default dark theme with gray floating cards |
| Signal colors only on enforcement states | Color used decoratively |
| Lucide (or one set) icons everywhere | Mixed unicode emoji in buttons |
| Fraunces headings, Plex Sans body, Plex Mono data | Three random system fonts |
| Wax-seal mark, neutral authentication symbolism | Any tribal seal, feather, or "tribal" motif |
| 8px spacing grid, hairline borders, flat surfaces | Random margins, heavy borders, shadows/gradients |
| Sentence case | Title Case / inconsistent casing |