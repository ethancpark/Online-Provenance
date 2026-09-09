# Online Provenance

**Protecting the seals and marks of Native American nations.**

A tribal seal is not a logo. It is an instrument of a sovereign government and, for
many nations, a sacred object. And it is being sold online every day — printed on
flags, stickers, hoodies, and bumper decals by third-party sellers who never asked
permission, never credited the nation, and never paid it a cent.

The scale is the hard part. There are 574 federally recognized tribes, and not one
of them has the staff to police Amazon, Temu, and Alibaba at the same time. The
marketplaces do little on their own. And generative AI has poured gasoline on the
fire: a growing share of these listings is "AI slop" — machine-generated merchandise
that scrapes a sacred seal into a design and ships it the same week.

Online Provenance does the watching at scale. It scans marketplaces for listings
that reproduce a tribe's official seal or flag, scores how likely each one is a real
match, and turns every hit into an on-the-record case file a tribe can act on —
including drafted takedown and trademark notices. Find it, document it, help get it
removed.

> A research prototype. Every notice is drafted for a human to review and send —
> nothing files automatically.

## How it works

1. **Reference marks.** For each tribe we store its official seal and flag — pulled
   from USPTO trademark records, Wikimedia Commons, and tribal government sites — and
   embed every image with CLIP.
2. **Scan.** A pipeline searches each marketplace for the tribe's name, seal, and
   flag and pulls back product listings and their images.
3. **Match.** Each product image is embedded with the same CLIP model and compared
   to the tribe's reference marks by cosine similarity. Results are banded
   high / medium / low; weak matches are dropped so the review queue stays honest.
4. **Review.** Likely matches land in a queue with a confidence score, the listing's
   ID, seller, and price, shown against the official mark.
5. **Act.** One click drafts a marketplace DMCA/IP takedown, a notice to the tribe's
   own legal office, or a report to the platform — pre-filled, ready for a human to
   review and send.

The scan runs daily in the cloud (GitHub Actions) and writes to Supabase; the
dashboard simply reads the latest snapshot.

## Stack

- **Web** — Next.js (App Router, TypeScript) on Vercel. A landing page at `/` and the
  monitor at `/dashboard`.
- **Data** — Supabase (Postgres + pgvector) holds tribes, reference embeddings,
  listings, matches, and drafts.
- **Pipeline** — Python: Amazon via Bright Data's Web Unlocker, Temu via a
  browser scraper (`src/temu_playwright.py`), CLIP image matching (ViT-B/32, via
  open_clip), and reference-mark sourcing.
- **Notices** — generated from templates in `src/lib/notice.ts`. Deliberately not
  written by a language model: a document signed under penalty of perjury should
  say the same thing every time, and every clause §512(c)(3) requires has to be
  present by construction rather than by luck.
- **Accounts** — Supabase Auth, with row-level security on every table. Signup is
  gated on the email domain belonging to a Tribal nation.

## Running it locally

**Web app**

```bash
npm install
# add .env.local:
#   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#   SUPABASE_SERVICE_ROLE_KEY
# optional: CRON_SECRET and RESEND_API_KEY for the monthly digest,
#           LAB_ADMIN_EMAILS to let named lab staff sign up
npm run dev          # http://localhost:3000
```

**Data pipeline**

```bash
cd pipeline
pip install -r requirements.txt
# add pipeline/.env:
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BRIGHTDATA_API_TOKEN
python -m scripts.seed_tribes               # load tribes + USPTO links
python -m scripts.discover_reference_images # source seal/flag reference images
python -m scripts.run_scan --marketplace amazon   # scan, match, store

# Temu needs a signed-in browser session, or a residential proxy:
python -m scripts.save_temu_session
python -m scripts.run_scan --marketplace temu
```

The database schema lives in `supabase/schema.sql`.

## Project layout

```
src/         Next.js app — landing page, dashboard, accounts, notices
pipeline/    Python — scraping, CLIP matching, sourcing, USPTO lookups
supabase/    database schema and migrations, run in order
public/      reference seals and the hero tiles, both served locally
design.md    the visual design specification
```

## Where it stands

This is an honest prototype, not a finished product.

- **Marketplaces.** Amazon scanning works end to end. Temu serves search results
  only to a signed-in session — verified against a headless shell, real Chrome,
  and its sitemap — so its scraper drives a browser with a saved login, or a
  residential proxy. Alibaba is not covered.
- **Coverage.** 132 Tribal nations, each with at least one verified reference seal
  or flag and a CLIP embedding. Marks that aren't published anywhere machine-
  readable were added by hand.
- **Attribution.** A seal can resemble another nation's closely enough to be
  matched to the wrong one. Where a listing's title names a nation we monitor,
  that nation owns the claim — a notice filed for someone else's mark would be
  worse than a missed listing.
- **Confidence is a signal, not a verdict.** A match score tells a human reviewer
  where to look; it is not a legal determination of infringement.
- **Nothing is sent automatically.** The tool drafts. People decide.

The point isn't to replace a tribe's lawyers. It's to make sure that when a seal is
being sold without permission, someone actually sees it.
