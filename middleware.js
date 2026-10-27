import { NextResponse } from "next/server";
import { SITE_SESSION_COOKIE, SITE_SESSION_TTL, verifySiteSessionToken } from "./lib/site-auth";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};

function noStoreHeaders(extra = {}) {
  return { "Cache-Control": "private, no-store, max-age=0", ...extra };
}

export async function middleware(request) {
  const { pathname, search } = request.nextUrl;

  // The login screen and its password endpoint must be reachable before a session exists.
  if (pathname === "/api/site-auth/login" || pathname === "/api/auth/google/callback") {
    return NextResponse.next();
  }

  const password = process.env.SITE_PASSWORD;
  const secret = process.env.AUTH_SECRET || password;
  if (!password || !secret) {
    if (pathname === "/login") return NextResponse.next();
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Prywatna strona nie jest skonfigurowana." }, {
        status: 503,
        headers: noStoreHeaders(),
      });
    }
    return new NextResponse("Novy Music nie jest jeszcze skonfigurowane. Ustaw SITE_PASSWORD w Vercel.", {
      status: 503,
      headers: noStoreHeaders({ "Content-Type": "text/plain; charset=utf-8" }),
    });
  }

  const token = request.cookies.get(SITE_SESSION_COOKIE)?.value;
  const isAuthenticated = await verifySiteSessionToken(token, secret);

  if (pathname === "/login") {
    if (isAuthenticated) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  if (isAuthenticated) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  }

  // API calls receive JSON instead of an HTML redirect, so client fetches can handle auth loss.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sesja wygasła. Zaloguj się ponownie." }, {
      status: 401,
      headers: noStoreHeaders(),
    });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", pathname + search);
  return NextResponse.redirect(loginUrl);
}
