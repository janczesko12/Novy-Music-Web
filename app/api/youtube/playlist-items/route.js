import { NextResponse } from "next/server";
import { getUsableAccessToken, readSession, writeSession } from "../../../../lib/youtube-auth";

export const runtime = "nodejs";

export async function GET(request) {
  const session = readSession(request);
  if (!session) return NextResponse.json({ error: "Połącz najpierw konto YouTube." }, { status: 401 });
  const playlistId = new URL(request.url).searchParams.get("playlistId");
  if (!playlistId || playlistId.length > 200) return NextResponse.json({ error: "Brak prawidłowego ID playlisty." }, { status: 400 });
  try {
    const auth = await getUsableAccessToken(session);
    if (!auth.accessToken) return NextResponse.json({ error: auth.error || "Połącz ponownie konto YouTube." }, { status: 401 });
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "50");
    const response = await fetch(url, { headers: { Authorization: `Bearer ${auth.accessToken}` }, cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      const out = NextResponse.json({ error: data?.error?.message || "Nie udało się odczytać utworów playlisty." }, { status: response.status });
      if (auth.refreshed) writeSession(out, auth.session);
      return out;
    }
    const items = (data.items || []).map(item => ({
      id: item.contentDetails?.videoId || item.snippet?.resourceId?.videoId || "",
      title: item.snippet?.title || "Film z YouTube",
      channel: item.snippet?.videoOwnerChannelTitle || item.snippet?.channelTitle || "YouTube",
      thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || "",
    })).filter(item => item.id && item.title !== "Deleted video" && item.title !== "Private video");
    const out = NextResponse.json({ items, nextPageToken: data.nextPageToken || "" }, { headers: { "Cache-Control": "no-store" } });
    if (auth.refreshed) writeSession(out, auth.session);
    return out;
  } catch {
    return NextResponse.json({ error: "Błąd pobierania utworów playlisty." }, { status: 500 });
  }
}
