import { NextResponse } from "next/server";
import { readSession } from "../../../../lib/youtube-auth";

export const runtime = "nodejs";

export async function GET(request) {
  const session = readSession(request);
  return NextResponse.json(
    session ? { connected: true, profile: session.profile } : { connected: false },
    { headers: { "Cache-Control": "no-store" } }
  );
}
