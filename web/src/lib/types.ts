export type Tribe = {
  id: string;
  name: string;
  canonical_name: string;
  rank: number | null;
  has_registered_mark: boolean;
  uspto_status: string | null;
  uspto_notes: string | null;
  uspto_search_url: string | null;
};

export type ReferenceAsset = {
  id: string;
  tribe_id: string;
  asset_type: "seal" | "flag" | "logo";
  description: string;
  image_url: string;
  source_url: string | null;
};

export type Listing = {
  id: string;
  tribe_id: string;
  marketplace: "amazon" | "temu";
  marketplace_id: string | null;
  title: string;
  seller: string | null;
  price: string | null;
  listing_url: string;
  image_url: string | null;
  search_query: string | null;
  scraped_at: string;
};

export type ConfidenceBand = "low" | "medium" | "high";
export type MatchStatus = "awaiting_review" | "dismissed";

export type Match = {
  id: string;
  listing_id: string;
  reference_asset_id: string;
  confidence: number;
  confidence_band: ConfidenceBand;
  status: MatchStatus;
  reviewed_at: string | null;
  created_at: string;
};

// Match joined with the listing and reference asset — what the queue displays
export type MatchRow = Match & {
  listings: Listing;
  reference_assets: ReferenceAsset;
};

export type TribeSummary = {
  tribe_id: string;
  tribe_name: string;
  listings_flagged: number;
  awaiting_review: number;
  notices_sent: number;
  removed: number;
};

export type TakedownDraft = {
  id: string;
  match_id: string;
  draft_type: "marketplace_takedown" | "ag_notification";
  recipient: string | null;
  body: string;
  status: "draft" | "sent" | "removed";
  sent_at: string | null;
  created_at: string;
};
