import { NextResponse } from "next/server";
import { SESSION_COOKIE, cookieOptions } from "../../../../lib/youtube-auth";

export async function POST(request) {
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  return response;
}
