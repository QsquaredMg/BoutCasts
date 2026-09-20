export type Category = {
  id: string;
  name: string;
  sort_order: number;
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
  categories?: { name: string } | null;
};

export type VoteTally = {
  a: number;
  b: number;
};
