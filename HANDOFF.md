# Online Provenance — project handoff

Context for picking this up in a fresh session.

**Repo** `~/tribal-logo-scrapper-shipasap` → github.com/ethancpark/Online-Provenance
**Live** https://onlineprovenance.vercel.app (Vercel, auto-deploys from `main`)

---

## What it is

Monitors Amazon and Temu for merchandise carrying Tribal nations' seals and
flags, scores likely infringements against each nation's registered mark, and
helps that nation file a takedown. Built by Anish Thota (Emory) and Ethan Park
(Northwestern) under Dr. Elise Blasingame (Osage Nation), part of the 𐒻𐒼𐓂 Lab.
Free, and stays free.

**Terminology:** "Tribal nations", not "Native American tribes".
**Do not** re-add any claim of accountability to NAISI — they have not approved
this project.

---

## Current state

- **132 Tribal nations**, every one with a verified reference seal/flag + CLIP embedding
- **~859 listings** documented; data 4 days old as of Aug 20 2026
- **Weekly cron** (Sundays 13:00 UTC) — succeeded Aug 2, 9, 16
- **Amazon**: working, 264 Bright Data credits/sweep, ~26% of the free 5,000/month
- **Temu**: SKIPPED for weeks — Apify's $5/month credit is exhausted. Biggest functional gap.
- **Accounts**: 1 (Ethan, `lab_admin`). Nobody else has used the tool yet.

## Costs — $0/month

| Service | Purpose | Plan |
|---|---|---|
| Bright Data | Amazon (Web Unlocker) | free 5,000 credits/mo, renews 1st |
| Apify | Temu (`crw~temu-products-scraper`) | free $5/mo — **currently exhausted** |
| Supabase | DB + auth | free |
| Vercel | hosting | free |

Do **not** buy ScraperAPI ($49/mo) or Apify Starter ($39/mo). Prof was offered
$100; the answer given was "no funding needed".

---

## Architecture

- **Next.js 16.3.1** App Router, CSS Modules, no Tailwind in components
- **Supabase**: Postgres + Auth. RLS on every table, verified enforcing.
- **pipeline/** Python scan: search → CLIP match → write to Supabase
- **Fonts**: Newsreader (serif, anything that *speaks*) + Familjen Grotesk
  (sans, anything that *labels*). No monospace.
- **Theme**: ink #2B2622, paper #FAF6EF, clay #A8462C. Radius 0. No shadows.
  No pure black/white, no saturated red. From a design handoff — follow it.

### Key files
```
src/lib/notice.ts        notice generation + marketplace routing (VERIFIED, see below)
src/lib/auth.ts          getProfile / requireLabAdmin / logAction
src/lib/supabase.ts      getPublicClient (anon) | getUserClient (session) | getServerClient (service role)
src/lib/tribeLocations.ts 132 nations, US Census coordinates
src/app/components/      LandingPage, Dashboard, ReviewQueue, ListingDetail, BulkReport, HotspotMap, AccountNav
supabase/*.sql           auth-schema, seed-tribe-domains, rate-limit (all already run)
pipeline/scripts/run_scan.py   the weekly scan
```

---

## Hard-won facts — do not re-derive or contradict

1. **Amazon reporting requires a free Amazon account** ("Sign in Required" on
   their own page). Not a Seller account. Form only — no email address is
   published for filing. Up to **50 listings per report**, one infringement
   type per report.
2. **Temu requires a free account too**, and proof of ownership. Real URL is
   `intellectual-property-complaint.html`. `ipprotection@temu.com` is for
   **withdrawing** a report only — never offer it for filing.
3. **Amazon wants ASINs; Temu wants listing URLs.** Pasting the wrong kind
   gets rejected.
4. **Most of these are TRADEMARK, not copyright** — a seal is a government
   emblem. Amazon runs the two through separate processes.
5. **Brand Registry (both marketplaces) is the highest-leverage play** for
   nations with a USPTO mark — proactive blocking beats one-off reports.
   Temu's own numbers: proactive removals beat complaints 331:1.
6. **Bright Data cannot scrape Temu** (Web Unlocker returns 0 bytes; their Temu
   dataset has no keyword discovery). Only the Apify actor works.
7. **ScraperAPI charged ~5 credits per Amazon search**, which is why it kept
   running dry. Bright Data is 1 credit/request.
8. **CLIP scores photos-of-flags ~0.33 against vector references**, so an
   image-only 0.60 threshold silently dropped real infringements. The hybrid
   matcher in `run_scan.py` accepts a low image score when the title names the
   tribe by its leading distinctive tokens AND says flag/seal/etc.
9. **Cherokee Nation (Tahlequah, OK) ≠ Eastern Band of Cherokee (Qualla, NC).**
   Name matching collapses them; Cherokee Nation is pinned explicitly.

---

## Security posture

Done: RLS everywhere (verified against live DB), Supabase Auth owns passwords,
service_role only behind role checks, public pages on the anon key, signup
rate-limited (3/email, 10/IP per hour, hashed IPs, 24h prune), CSP + frame
protection + referrer policy, 0 npm vulnerabilities, no secrets in git history.

**Outstanding:**
- [ ] **Rotate `ANTHROPIC_API_KEY`** — it sat behind a public unauthenticated
      endpoint (`/api/draft`, now deleted) for a period.
- [ ] Enable Supabase MFA on the owner account + database backups before real
      tribal data lands.
- [ ] Decide who else gets `lab_admin` — that role reads every account.

---

## What to do next

1. **Fix Temu.** It has silently skipped for weeks. Either cut the dragnet to
   ~2 queries/sweep so $5 lasts the month, or build the Playwright scraper
   (Ethan's idea; the economics do favour it — test locally from a residential
   IP first, costs nothing).
2. **Walk the reporting flow end to end as a real user.** Never been done.
   Sign in, use "Report all N listings", actually file one at Amazon. That is
   where remaining friction will show.
3. **Track reported status.** Nothing records that a notice was filed, so a
   nation could re-file the same listings monthly, and "Removed" is stuck at 0.
4. **Get one nation using it.** 859 listings and a working pipeline exist; what
   is missing is evidence a tribal office can finish a report without a wall.

---

## Working agreements

- Commit messages: **no `Co-Authored-By` trailer**.
- Run `npm run build` before pushing — tsc/eslint miss prerender errors.
- Don't spend scraper credits without asking; say the cost up front.
- Ask before running scans; poll external APIs at ≥60s (a 20s loop got the
  home IP Cloudflare-blocked by Bright Data once).
- The tribal leadership directory xlsx in ~/Downloads holds real officials'
  personal data — only domains were extracted; keep it out of the repo.
