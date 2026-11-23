import { createServerClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";
import { NextResponse, type NextRequest } from "next/server";

/** Obnoví přihlášení a nepřihlášené pošle z /app na přihlášení. */
export async function updateSession(request: NextRequest) {
  // Odkaz z potvrzovacího e-mailu: když Supabase vrátí člověka na hlavní stránku (adresa webu
  // v nastavení Supabase) místo na /auth/confirm, předáme kód dál, ať potvrzení nepropadne.
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/" && (searchParams.has("code") || searchParams.has("token_hash"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/confirm";
    if (!url.searchParams.has("next")) url.searchParams.set("next", "/registrace-firmy");
    return NextResponse.redirect(url);
  }
  if (pathname === "/" && (searchParams.has("error_code") || searchParams.has("error_description"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/prihlaseni";
    url.search = "?chyba=odkaz";
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([key, value]) => supabaseResponse.headers.set(key, value));
        },
      },
    },
  );

  // Mezi createServerClient a getClaims nesmí nic být (jinak hrozí náhodné odhlašování).
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const path = request.nextUrl.pathname;
  if (!user && (path.startsWith("/app") || path.startsWith("/registrace-firmy") || path === "/ssh" || path.startsWith("/ssh/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/prihlaseni";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
