import { createClient } from "@/lib/supabase/server";
import CategoryManager from "@/components/CategoryManager";

export default async function AdminCategoriesPage() {
  const supabase = await createClient();

  const [{ data: categories }, { data: subcategories }, { data: sponsors }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("subcategories").select("*").order("sort_order"),
    supabase.from("sponsors").select("id, name").order("name"),
  ]);

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Categories
      </h2>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Create and reorder the categories submissions and bouts are grouped under.
      </p>
      <CategoryManager initialCategories={categories ?? []} initialSubcategories={subcategories ?? []} sponsors={sponsors ?? []} />
    </div>
  );
}
