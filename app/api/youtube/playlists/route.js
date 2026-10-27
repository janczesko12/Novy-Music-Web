import { NextResponse } from "next/server";
import { getUsableAccessToken, readSession, writeSession } from "../../../../lib/youtube-auth";

export const runtime = "nodejs";

export async function GET(request) {
  const session = readSession(request);
  if (!session) return NextResponse.json({ error: "Połącz najpierw konto YouTube." }, { status: 401 });
  try {
    const auth = await getUsableAccessToken(session);
    if (!auth.accessToken) return NextResponse.json({ error: auth.error || "Połącz ponownie konto YouTube." }, { status: 401 });
    const url = new URL("https://www.googleapis.com/youtube/v3/playlists");
    url.searchParams.set("part", "snippet,contentDetails,status");
    url.searchParams.set("mine", "true");
    url.searchParams.set("maxResults", "50");
    const response = await fetch(url, { headers: { Authorization: `Bearer ${auth.accessToken}` }, cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      const out = NextResponse.json({ error: data?.error?.message || "Nie udało się pobrać playlist YouTube." }, { status: response.status });
      if (auth.refreshed) writeSession(out, auth.session);
      return out;
    }
    const items = (data.items || []).map(p => ({
      id: p.id,
      title: p.snippet?.title || "Playlista YouTube",
      description: p.snippet?.description || "",
      thumbnail: p.snippet?.thumbnails?.medium?.url || p.snippet?.thumbnails?.default?.url || "",
      itemCount: p.contentDetails?.itemCount ?? 0,
      privacyStatus: p.status?.privacyStatus || "",
    }));
    const out = NextResponse.json({ items, nextPageToken: data.nextPageToken || "" }, { headers: { "Cache-Control": "no-store" } });
    if (auth.refreshed) writeSession(out, auth.session);
    return out;
  } catch {
    return NextResponse.json({ error: "Błąd pobierania playlist. Spróbuj ponownie." }, { status: 500 });
  }
}
