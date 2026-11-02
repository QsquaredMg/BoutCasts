import Link from "next/link";

// Sub-tabs for the admin School Elections section.
export default function AdminSchoolTabs({ active }: { active: "elections" | "roles" }) {
  const tabs = [
    { key: "elections", href: "/admin/school-elections", label: "Elections" },
    { key: "roles", href: "/admin/school-elections/roles", label: "Student Roles & Money" },
  ] as const;
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} className="rounded-full px-4 py-1.5 text-sm font-bold"
          style={{ background: active === t.key ? "var(--surface-2)" : "transparent", boxShadow: "inset 0 0 0 1px var(--border)", color: active === t.key ? "var(--text)" : "var(--text-dim)" }}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}
