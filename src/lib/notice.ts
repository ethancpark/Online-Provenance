/**
 * Infringement notice generation.
 *
 * Amazon runs copyright and trademark through SEPARATE processes and will not
 * accept them combined in one submission, so the basis is chosen per listing:
 *
 *  - trademark  — the nation has a USPTO-registered mark or filed official
 *                 insignia. This is the usual case for seals and flags, which
 *                 are the emblems of a sovereign government.
 *  - copyright  — no registered mark on file; the claim rests on the artwork.
 *
 * Both are submitted through Amazon's Report Infringement form, which is the
 * only channel Amazon documents for trademark. Verified on their own page:
 * "Sign in Required — To submit a report of infringement ... please sign in."
 * A free Amazon account is enough; a Seller or Brand Registry account is not
 * required. No email address is offered here: Amazon's page does not publish
 * one for this purpose, and an unverified address is worse than none for a
 * notice signed under penalty of perjury.
 *
 * The Indian Arts and Crafts Act is cited as supporting context, never as the
 * primary basis — it is a federal truth-in-advertising statute enforced by the
 * Indian Arts and Crafts Board, not something a marketplace adjudicates.
 */

export type NoticeBasis = "trademark" | "copyright";

export type Claimant = {
  full_name: string;
  job_title: string | null;
  email: string;
  nation: string;
};

export type NoticeInput = {
  claimant: Claimant;
  nation: string;
  usptoRegistered: boolean;
  usptoUrl: string | null;
  assetDescription: string;
  listingTitle: string;
  listingUrl: string;
  marketplaceId: string | null;
  marketplace: string;
  seller: string | null;
  confidencePct: number;
};

export const AMAZON_REPORT_FORM = "https://www.amazon.com/report/infringement";
export const AMAZON_BRAND_REGISTRY = "https://brandservices.amazon.com/brandregistry";
// Verified against Temu's own pages. The complaint page states "Sign in
// required". ipprotection@temu.com exists but is only for WITHDRAWING a
// report, never for filing one, so it is deliberately not offered here.
export const TEMU_IP_PORTAL = "https://www.temu.com/intellectual-property-complaint.html";
export const TEMU_BRAND_REGISTRY = "https://www.temu.com/intellectual-property-overview.html";

export function marketplaceName(mp: string) {
  if (mp === "amazon") return "Amazon";
  if (mp === "temu") return "Temu";
  return mp.charAt(0).toUpperCase() + mp.slice(1);
}

export function noticeBasis(input: Pick<NoticeInput, "usptoRegistered">): NoticeBasis {
  return input.usptoRegistered ? "trademark" : "copyright";
}

export function noticeSubject(input: NoticeInput): string {
  const basis = noticeBasis(input);
  const kind = basis === "trademark" ? "Trademark" : "Copyright";
  return `${kind} infringement notice — unauthorized use of the ${input.nation} seal`;
}

/**
 * A complete notice. Every element §512(c)(3) requires is present for the
 * copyright basis: identification of the work, identification and location of
 * the infringing material, contact details, the good-faith statement, the
 * accuracy-and-authority statement under penalty of perjury, and a signature.
 */
export function buildNotice(input: NoticeInput): string {
  const basis = noticeBasis(input);
  const mp = marketplaceName(input.marketplace);
  const today = new Date().toISOString().slice(0, 10);
  const c = input.claimant;
  const signature = [c.full_name, c.job_title, input.nation].filter(Boolean).join(", ");

  const head = [
    `To: ${mp} Intellectual Property / Legal`,
    `Date: ${today}`,
    ``,
    `To whom it may concern,`,
    ``,
  ];

  const identification =
    basis === "trademark"
      ? [
          `This is a notice of trademark infringement concerning a listing on ${mp}.`,
          ``,
          `1. The mark being infringed`,
          `   ${input.assetDescription}, owned by the ${input.nation}, a federally recognized`,
          `   sovereign Tribal nation.`,
          input.usptoUrl ? `   USPTO record: ${input.usptoUrl}` : `   Registered with the USPTO.`,
          ``,
          `   This mark is the official emblem of a sovereign government. Its use on`,
          `   merchandise falsely suggests a connection with, or endorsement by, the`,
          `   ${input.nation}, which has granted no such authorization.`,
        ]
      : [
          `This is a notice of copyright infringement under the Digital Millennium`,
          `Copyright Act (17 U.S.C. § 512) concerning a listing on ${mp}.`,
          ``,
          `1. The copyrighted work being infringed`,
          `   ${input.assetDescription}, owned by the ${input.nation}, a federally recognized`,
          `   sovereign Tribal nation.`,
        ];

  const material = [
    ``,
    `2. The infringing material and where it is located`,
    `   Listing title: ${input.listingTitle}`,
    input.marketplaceId ? `   ${mp === "Amazon" ? "ASIN" : "Item ID"}: ${input.marketplaceId}` : null,
    `   URL: ${input.listingUrl}`,
    `   Seller: ${input.seller ?? "not listed"}`,
    ``,
    `   The product image reproduces the ${input.nation}'s mark. Our image comparison`,
    `   scored this listing at ${input.confidencePct}% similarity against the nation's`,
    `   registered mark; a person has reviewed it before this notice was sent.`,
  ];

  const contact = [
    ``,
    `3. Contact information for the complaining party`,
    `   Name: ${c.full_name}`,
    c.job_title ? `   Title: ${c.job_title}` : null,
    `   Organization: ${input.nation}`,
    `   Email: ${c.email}`,
    ``,
    `   A mailing address and telephone number will be provided on request, and`,
    `   are on file with the nation's offices.`,
  ];

  const statements = [
    ``,
    `4. Statements`,
    `   I have a good faith belief that the use of the material described above is`,
    `   not authorized by the rights holder, its agent, or the law.`,
    ``,
    `   I swear, under penalty of perjury, that the information in this notice is`,
    `   accurate and that I am authorized to act on behalf of the owner of the`,
    `   right that is allegedly infringed.`,
    ``,
    `   Additional context: merchandise of this kind may also violate the Indian`,
    `   Arts and Crafts Act (25 U.S.C. § 305e), which prohibits offering goods in a`,
    `   manner that falsely suggests they are Indian-produced or the product of a`,
    `   particular Tribal nation.`,
    ``,
    `We request that the listing above be removed or disabled promptly.`,
    ``,
    `Signed,`,
    `${signature}`,
    `${c.email}`,
    `${today}`,
  ];

  return [...head, ...identification, ...material, ...contact, ...statements]
    .filter((l): l is string => l !== null)
    .join("\r\n");
}

export type SubmissionRoute = {
  primary: string;
  primaryLabel: string;
  /** What the filer needs before they can submit. */
  requirement: string | null;
  note: string;
  /** Stronger long-term option, where one exists. */
  alternative: { url: string; label: string; note: string } | null;
};

/** Where this notice should actually be filed, and what it takes to file it. */
export function submissionRoute(input: NoticeInput): SubmissionRoute {
  if (input.marketplace === "amazon") {
    return {
      primary: AMAZON_REPORT_FORM,
      primaryLabel: "Amazon's Report Infringement form",
      requirement:
        "Requires a free Amazon account to sign in. A Seller or Brand Registry account is not needed.",
      note: "Paste this notice into the form's description field, and attach the comparison images.",
      alternative: input.usptoRegistered
        ? {
            url: AMAZON_BRAND_REGISTRY,
            label: "Amazon Brand Registry",
            note:
              "With a registered trademark, enrolling the nation in Brand Registry unlocks proactive protection and faster removals than one-off reports.",
          }
        : null,
    };
  }
  return {
    primary: TEMU_IP_PORTAL,
    primaryLabel: "Temu's Report Infringement form",
    requirement:
      "Requires a free Temu account to sign in. Temu also asks for proof of ownership, such as the trademark certificate.",
    note: "Paste the listing URLs into the form, along with the notice below.",
    alternative: input.usptoRegistered
      ? {
          url: TEMU_BRAND_REGISTRY,
          label: "Temu Brand Registry",
          note:
            "Registering the nation's mark with Temu's Brand Registry removes the need to re-upload proof on every complaint, and adds the mark to their proactive monitoring — which removes far more listings than complaints do.",
        }
      : null,
  };
}

/* ------------------------------------------------------------------ batch */

/** Amazon accepts one infringement type per report, up to 50 listings. */
export const AMAZON_BATCH_LIMIT = 50;

export type BatchListing = {
  title: string;
  url: string;
  marketplaceId: string | null;
  seller: string | null;
  confidencePct: number;
};

export type BatchInput = Omit<
  NoticeInput,
  "listingTitle" | "listingUrl" | "marketplaceId" | "seller" | "confidencePct"
> & { listings: BatchListing[] };

/**
 * The identifiers each form actually asks for, one per line: Amazon's form
 * takes ASINs, Temu's takes listing URLs. Pasting the wrong kind is a common
 * cause of rejection.
 */
export function batchIdList(listings: BatchListing[], marketplace = "amazon"): string {
  if (marketplace === "amazon") {
    return listings
      .map((l) => l.marketplaceId)
      .filter((id): id is string => Boolean(id))
      .join("\n");
  }
  return listings.map((l) => l.url).join("\n");
}

/** What the paste block contains, for labelling the copy button. */
export function batchIdLabel(marketplace: string): string {
  return marketplace === "amazon" ? "ASINs" : "listing URLs";
}

/** Split into submissions that fit the marketplace's per-report cap. */
export function batchChunks<T>(items: T[], size = AMAZON_BATCH_LIMIT): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * One notice covering many listings of the same infringement type — which is
 * how Amazon wants them, and what saves a nation from filing thirty forms.
 */
export function buildBatchNotice(input: BatchInput): string {
  const basis = noticeBasis(input);
  const mp = marketplaceName(input.marketplace);
  const today = new Date().toISOString().slice(0, 10);
  const c = input.claimant;
  const signature = [c.full_name, c.job_title, input.nation].filter(Boolean).join(", ");
  const n = input.listings.length;

  const opening =
    basis === "trademark"
      ? [
          `This is a notice of trademark infringement concerning ${n} listing${n === 1 ? "" : "s"} on ${mp}.`,
          ``,
          `1. The mark being infringed`,
          `   ${input.assetDescription}, owned by the ${input.nation}, a federally recognized`,
          `   sovereign Tribal nation.`,
          input.usptoUrl ? `   USPTO record: ${input.usptoUrl}` : `   Registered with the USPTO.`,
          ``,
          `   This mark is the official emblem of a sovereign government. Its use on`,
          `   merchandise falsely suggests a connection with, or endorsement by, the`,
          `   ${input.nation}, which has granted no such authorization.`,
        ]
      : [
          `This is a notice of copyright infringement under the Digital Millennium`,
          `Copyright Act (17 U.S.C. § 512) concerning ${n} listing${n === 1 ? "" : "s"} on ${mp}.`,
          ``,
          `1. The copyrighted work being infringed`,
          `   ${input.assetDescription}, owned by the ${input.nation}, a federally recognized`,
          `   sovereign Tribal nation.`,
        ];

  const items = input.listings.flatMap((l, i) => [
    `   ${i + 1}. ${l.title}`,
    l.marketplaceId ? `      ${mp === "Amazon" ? "ASIN" : "Item ID"}: ${l.marketplaceId}` : null,
    `      URL: ${l.url}`,
    `      Seller: ${l.seller ?? "not listed"}   Image match: ${l.confidencePct}%`,
    ``,
  ]);

  return [
    `To: ${mp} Intellectual Property / Legal`,
    `Date: ${today}`,
    ``,
    `To whom it may concern,`,
    ``,
    ...opening,
    ``,
    `2. The infringing listings`,
    ``,
    ...items,
    `   Each product image reproduces the ${input.nation}'s mark. Similarity was`,
    `   scored automatically and every listing above has been reviewed by a person`,
    `   before this notice was filed.`,
    ``,
    `3. Contact information for the complaining party`,
    `   Name: ${c.full_name}`,
    c.job_title ? `   Title: ${c.job_title}` : null,
    `   Organization: ${input.nation}`,
    `   Email: ${c.email}`,
    ``,
    `4. Statements`,
    `   I have a good faith belief that the use of the material described above is`,
    `   not authorized by the rights holder, its agent, or the law.`,
    ``,
    `   I swear, under penalty of perjury, that the information in this notice is`,
    `   accurate and that I am authorized to act on behalf of the owner of the`,
    `   right that is allegedly infringed.`,
    ``,
    `   Additional context: merchandise of this kind may also violate the Indian`,
    `   Arts and Crafts Act (25 U.S.C. § 305e), which prohibits offering goods in a`,
    `   manner that falsely suggests they are Indian-produced or the product of a`,
    `   particular Tribal nation.`,
    ``,
    `We request that the listings above be removed or disabled promptly.`,
    ``,
    `Signed,`,
    `${signature}`,
    `${c.email}`,
    `${today}`,
  ]
    .filter((l): l is string => l !== null)
    .join("\r\n");
}
