import { NextResponse } from "next/server";
import { SITE_SESSION_COOKIE } from "../../../../lib/site-auth";

export const runtime = "nodejs";

export async function POST() {
  const response = new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  response.cookies.set(SITE_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
