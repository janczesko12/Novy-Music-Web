import { NextResponse } from "next/server";

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };

export function middleware(request) {
  // Google redirects the browser here after consent. OAuth state is validated in the callback.
  if (request.nextUrl.pathname === "/api/auth/google/callback") return NextResponse.next();

  const password = process.env.SITE_PASSWORD;
  if (!password) {
    return new NextResponse("Private site is not configured.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization || !authorization.startsWith("Basic ")) {
    return new NextResponse("Novy Music is private.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Novy Music", charset="UTF-8"',
        "Cache-Control": "no-store",
      },
    });
  }

  let decoded = "";
  try { decoded = atob(authorization.slice(6)); } catch { /* invalid header */ }
  if (decoded.slice(decoded.indexOf(":") + 1) !== password) {
    return new NextResponse("Unauthorized.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Novy Music", charset="UTF-8"',
        "Cache-Control": "no-store",
      },
    });
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
