import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired - required for Server Components
  const { data: auth } = await supabase.auth.getUser();

  // Admin area: only an admin account gets past here, whatever the page or API does itself.
  const path = request.nextUrl.pathname;
  const isAdminApi = path === "/api/admin" || path.startsWith("/api/admin/");
  const isAdminPage = path === "/admin" || path.startsWith("/admin/");
  if (isAdminApi || isAdminPage) {
    let allowed = false;
    if (auth.user) {
      const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", auth.user.id).maybeSingle();
      allowed = !!profile?.is_admin;
    }
    if (!allowed) {
      if (isAdminApi) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (!auth.user) {
        const login = request.nextUrl.clone();
        login.pathname = "/login";
        login.search = `?next=${encodeURIComponent(path)}`;
        return NextResponse.redirect(login);
      }
      const gone = request.nextUrl.clone();
      gone.pathname = "/not-found-admin";
      gone.search = "";
      return NextResponse.rewrite(gone, { status: 404 });
    }
  }

  return supabaseResponse;
}
