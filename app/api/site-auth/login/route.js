import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createSiteSessionToken, SITE_SESSION_COOKIE, SITE_SESSION_TTL } from "../../../../lib/site-auth";

export const runtime = "nodejs";

function passwordMatches(submitted, expected) {
  if (typeof submitted !== "string" || typeof expected !== "string") return false;
  const a = Buffer.from(submitted, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request) {
  const password = process.env.SITE_PASSWORD;
  const secret = process.env.AUTH_SECRET || password;

  if (!password || !secret) {
    return NextResponse.json(
      { error: "Logowanie nie jest skonfigurowane. Ustaw SITE_PASSWORD i AUTH_SECRET w Vercel." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400 });
  }

  if (!passwordMatches(body?.password, password)) {
    return NextResponse.json(
      { error: "To hasło nie pasuje. Sprawdź je i spróbuj ponownie." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const token = await createSiteSessionToken(secret);
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(SITE_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SITE_SESSION_TTL,
  });
  return response;
}
