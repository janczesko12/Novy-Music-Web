import { NextResponse } from "next/server";
import { decryptSession, STATE_COOKIE, SESSION_COOKIE, cookieOptions, encryptSession, redirectUriFor } from "../../../../../lib/youtube-auth";

export const runtime = "nodejs";

function fail(request, reason) {
  return NextResponse.redirect(new URL(`/?youtubeError=${encodeURIComponent(reason)}`, request.url));
}

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  if (url.searchParams.get("error")) return fail(request, "consent_denied");
  if (!code || !returnedState || !expectedState || returnedState !== expectedState) return fail(request, "invalid_state");
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.AUTH_SECRET) return fail(request, "not_configured");

  try {
    const body = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUriFor(request),
    });
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) return fail(request, "token_exchange_failed");

    const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      cache: "no-store",
    });
    const user = await userResponse.json();
    if (!userResponse.ok || !user.email) return fail(request, "profile_failed");

    const previous = decryptSession(request.cookies.get(SESSION_COOKIE)?.value || "");
    const session = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || previous?.refreshToken || null,
      expiresAt: Date.now() + Number(tokenData.expires_in || 3600) * 1000,
      profile: {
        sub: user.sub,
        email: user.email,
        name: user.name || user.email,
        picture: user.picture || "",
      },
    };
    const response = NextResponse.redirect(new URL("/?youtube=connected", request.url));
    response.cookies.set(SESSION_COOKIE, encryptSession(session), cookieOptions(60 * 60 * 24 * 30));
    response.cookies.set(STATE_COOKIE, "", cookieOptions(0));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return fail(request, "callback_failed");
  }
}
