export type Sponsor = {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  tier: "title" | "standard";
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  sort_order: number;
  sponsor_id: string | null;
  sponsors?: Sponsor | null;
};

export type Bout = {
  id: string;
  category_id: string;
  title: string;
  competitor_a_name: string;
  competitor_b_name: string;
  status: "upcoming" | "live" | "final";
  round_theme_name: string | null;
  round_theme_rules: string | null;
  created_at: string;
  closes_at: string | null;
  round_number: number;
  bracket_key: string | null;
  winner_side: "a" | "b" | null;
  next_bout_id: string | null;
  next_slot: "a" | "b" | null;
  sponsor_id: string | null;
  categories?: { name: string; sponsor_id?: string | null; sponsors?: Sponsor | null } | null;
  sponsors?: Sponsor | null;
};

export type VoteTally = {
  a: number;
  b: number;
};

export type Badge = {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
};

export type UserBadge = {
  id: string;
  user_id: string;
  badge_id: string;
  awarded_at: string;
  badges?: Badge | null;
};

export type PointEvent = {
  id: string;
  user_id: string;
  points: number;
  reason: string;
  related_bout_id: string | null;
  created_at: string;
};

export type LeaderboardEntry = {
  id: string;
  username: string;
  points: number;
};

export type Submission = {
  id: string;
  user_id: string;
  category_id: string;
  title: string;
  source_type: "upload" | "link" | "record";
  source_url: string | null;
  entry_type: "free" | "paid";
  entry_fee: number;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  categories?: { name: string } | null;
};

export type WalletEvent = {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  related_submission_id: string | null;
  created_at: string;
};


