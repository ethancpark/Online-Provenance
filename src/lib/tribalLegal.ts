// Tribe → its OWN legal office (Attorney General / Department of Justice /
// General Counsel). The AG button notifies the tribe itself so its lawyers can
// act on the infringement of their own mark.
//
// REALITY CHECK: only a handful of tribes publish a usable *general* legal-office
// email. Most list an office + phone + page but no inbox (or only individual
// attorneys, which we will not guess or mass-email). So each entry carries an
// `email` only when it was verified from the tribe's official site; otherwise the
// button opens `contactUrl` and surfaces `phone`. `verified` marks emails read
// directly off the official site. Unmapped tribes fall back to a web search.

export type TribalLegalContact = {
  office: string;
  email: string | null;
  phone: string | null;
  contactUrl: string;
  verified: boolean; // email confirmed from the official tribal site
  note?: string;
};

// Keyed by canonical tribe name (matches tribes.canonical_name).
const TRIBAL_LEGAL: Record<string, TribalLegalContact> = {
  "Navajo Nation": {
    office: "Navajo Nation Department of Justice — Office of the Attorney General",
    email: "nndoj.general@navajo-nsn.gov",
    phone: "(928) 871-6343",
    contactUrl: "https://nndoj.navajo-nsn.gov/",
    verified: true,
  },
  "Cherokee Nation": {
    office: "Cherokee Nation — Office of the Attorney General",
    email: "cnoag@cherokee.org",
    phone: "(918) 453-5262",
    contactUrl: "https://attorneygeneral.cherokee.org/",
    verified: true,
  },
  "Eastern Band of Cherokee Indians": {
    office: "Eastern Band of Cherokee Indians — Office of the Attorney General",
    email: "info@ebci.gov",
    phone: "(828) 346-6993",
    contactUrl: "https://www.ebci.gov/attorney-general/",
    verified: true,
    note: "General tribal inbox — no AG-specific email is published.",
  },
  "Muscogee (Creek) Nation": {
    office: "Muscogee (Creek) Nation — Office of the Attorney General",
    email: null,
    phone: "(918) 295-9720",
    contactUrl: "https://www.muscogeenation.com/attorney-general/",
    verified: false,
  },
  "Osage Nation": {
    office: "Osage Nation — Office of the Attorney General",
    email: null,
    phone: null,
    contactUrl: "https://www.osagenation-nsn.gov/who-we-are/attorney-general",
    verified: false,
  },
  "Seminole Tribe of Florida": {
    office: "Seminole Tribe of Florida — Office of the General Counsel",
    email: null,
    phone: null,
    contactUrl: "https://www.semtribe.com/contact-us",
    verified: false,
  },
  "Chickasaw Nation": {
    office: "Chickasaw Nation — Office of the General Counsel",
    email: null,
    phone: null,
    contactUrl: "https://www.chickasaw.net/Our-Nation/Contact.aspx",
    verified: false,
  },
};

/**
 * Resolve the tribe's own legal-office contact. Falls back to a web search for
 * the office when we don't have a verified entry — never a fabricated email.
 */
export function getTribalLegalContact(tribe: {
  name: string;
  canonical_name?: string | null;
}): TribalLegalContact {
  const key = tribe.canonical_name ?? tribe.name;
  const hit = TRIBAL_LEGAL[key] ?? TRIBAL_LEGAL[tribe.name];
  if (hit) return hit;

  // Unmapped tribe: no fabricated address. Point at a search for the office.
  const q = encodeURIComponent(`${tribe.name} attorney general legal department contact`);
  return {
    office: `${tribe.name} — Tribal Legal / Attorney General's Office`,
    email: null,
    phone: null,
    contactUrl: `https://www.google.com/search?q=${q}`,
    verified: false,
    note: "No verified legal-office contact on file — search for the current office.",
  };
}
