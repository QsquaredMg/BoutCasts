export type Sponsor = {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  tier: "title" | "standard";
  created_at: string;
  opportunity_type?: string | null;
  banner_style?: string | null;
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
  stripe_checkout_session_id?: string | null;
  crew_name?: string | null;
  teammates?: string[] | null;
  status: "pending" | "approved" | "rejected" | "appealed";
  appeal_message?: string | null;
  appealed_at?: string | null;
  created_at: string;
  categories?: { name: string } | null;
};

export type Challenge = {
  id: string;
  challenger_id: string;
  opponent_id: string;
  category_id: string | null;
  message: string | null;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  responded_at: string | null;
  challenger?: { username: string | null } | null;
  opponent?: { username: string | null } | null;
  categories?: { name: string } | null;
};

export type BoutComment = {
  id: string;
  bout_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles?: { username: string | null } | null;
};

export type WalletEvent = {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  related_submission_id: string | null;
  created_at: string;
};


export type Follow = {
  follower_id: string;
  followed_id: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export type PrizePool = {
  id: string;
  bout_id: string;
  goal_amount: number;
  created_at: string;
};

export type PoolContribution = {
  id: string;
  pool_id: string;
  user_id: string;
  amount: number;
  created_at: string;
};

export type CashWalletEvent = {
  id: string;
  user_id: string;
  amount_cents: number;
  reason: string;
  status: "pending" | "available";
  related_bout_id: string | null;
  created_at: string;
  released_at: string | null;
};

export type CashRedemption = {
  id: string;
  user_id: string;
  redemption_type: "cash" | "gift_card";
  gift_card_brand: string | null;
  amount_cents: number;
  payout_method: string | null;
  status: "pending" | "fulfilled" | "rejected";
  admin_note: string | null;
  created_at: string;
  fulfilled_at: string | null;
  profiles?: { username: string | null } | null;
};
