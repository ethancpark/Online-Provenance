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
- **Pipeline** — Python: marketplace scraping (via ScraperAPI), CLIP image matching
  (ViT-B/32, via open_clip), and reference-mark sourcing.
- **Drafting** — the Anthropic Claude API writes the takedown and legal notices.

## Running it locally

**Web app**

```bash
npm install
# add .env.local:
#   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#   SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
npm run dev          # http://localhost:3000
```

**Data pipeline**

```bash
cd pipeline
pip install -r requirements.txt
# add pipeline/.env:
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SCRAPER_API_KEY
python -m scripts.seed_tribes               # load tribes + USPTO links
python -m scripts.discover_reference_images # source seal/flag reference images
python -m scripts.run_scan --marketplace amazon   # scan, match, store
```

The database schema lives in `supabase/schema.sql`.

## Project layout

```
src/         Next.js app — landing page and dashboard
pipeline/    Python — scraping, CLIP matching, sourcing, USPTO lookups
supabase/    database schema
design.md    the visual design specification
```

## Where it stands

This is an honest prototype, not a finished product.

- **Marketplaces.** Amazon scanning works end to end. Temu and Alibaba guard their
  pages aggressively; a scraper that can get past their bot protection (e.g. a
  dedicated Temu actor) is the next piece.
- **Coverage.** The tool currently tracks the 50 largest tribes by enrollment, with
  verified reference marks for about 36 of them. The rest simply aren't published
  anywhere we can pull automatically — those need to be added by hand.
- **Confidence is a signal, not a verdict.** A match score tells a human reviewer
  where to look; it is not a legal determination of infringement.
- **Nothing is sent automatically.** The tool drafts. People decide.

The point isn't to replace a tribe's lawyers. It's to make sure that when a seal is
being sold without permission, someone actually sees it.
