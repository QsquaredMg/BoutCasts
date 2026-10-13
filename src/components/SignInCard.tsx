import Link from "next/link";

// Branded signed-out prompt in the homepage/splash style (ink panel, blue
// slash, pill buttons). Used wherever a page needs an account.
export default function SignInCard({
  eyebrow,
  title,
  body,
  next,
}: {
  eyebrow?: string;
  title: string;
  body: string;
  next: string;
}) {
  const n = encodeURIComponent(next);
  return (
    <div className="mx-auto max-w-lg px-5 py-10">
      <div className="relative overflow-hidden rounded-3xl p-7 sm:p-9" style={{ background: "#0a0e1a", color: "#fff" }}>
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{ right: -96, top: -80, width: 150, height: 560, background: "#1b4fe4", transform: "rotate(14deg)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{ right: 62, top: -80, width: 8, height: 560, background: "#fff", opacity: 0.9, transform: "rotate(14deg)" }}
        />
        <div className="relative max-w-[66%] sm:max-w-[72%]">
          {eyebrow && (
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.12em]" style={{ color: "#9fb8ff" }}>
              {eyebrow}
            </p>
          )}
          <h1 className="text-3xl leading-[0.95] sm:text-4xl" style={{ fontWeight: 900, textTransform: "uppercase", fontStretch: "112%", color: "#fff" }}>
            {title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "#c9d0e0" }}>
            {body}
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link
              href={`/signup?next=${n}`}
              className="inline-flex min-h-[46px] items-center rounded-full px-5 text-sm font-bold"
              style={{ background: "#1b4fe4", color: "#fff" }}
            >
              Create a free account
            </Link>
            <Link
              href={`/login?next=${n}`}
              className="inline-flex min-h-[46px] items-center rounded-full border-2 px-5 text-sm font-bold"
              style={{ borderColor: "rgba(255,255,255,0.35)", color: "#fff" }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
