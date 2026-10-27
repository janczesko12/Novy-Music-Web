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
    const playlistItems = (data.items || []).map(item => ({
      id: item.contentDetails?.videoId || item.snippet?.resourceId?.videoId || "",
      fallbackTitle: item.snippet?.title || "Utwór z YouTube",
      fallbackChannel: item.snippet?.videoOwnerChannelTitle || item.snippet?.channelTitle || "YouTube",
      fallbackThumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || "",
    })).filter(item => item.id && item.fallbackTitle !== "Deleted video" && item.fallbackTitle !== "Private video");

    // Playlist items do not expose video category. Ask videos.list so the music library
    // can reliably keep only videos in YouTube's Music category (category ID 10).
    let musicDetails = [];
    if (playlistItems.length) {
      const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
      detailsUrl.searchParams.set("part", "snippet");
      detailsUrl.searchParams.set("id", playlistItems.map(item => item.id).join(","));
      const detailsResponse = await fetch(detailsUrl, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
        cache: "no-store",
      });
      const detailsData = await detailsResponse.json();
      if (!detailsResponse.ok) {
        const out = NextResponse.json({ error: detailsData?.error?.message || "Nie udało się sprawdzić kategorii utworów." }, { status: detailsResponse.status });
        if (auth.refreshed) writeSession(out, auth.session);
        return out;
      }
      musicDetails = (detailsData.items || []).filter(item => item.snippet?.categoryId === "10");
    }
    const byId = new Map(musicDetails.map(item => [item.id, item]));
    const items = playlistItems.filter(item => byId.has(item.id)).map(item => {
      const details = byId.get(item.id);
      return {
        id: item.id,
        title: details.snippet?.title || item.fallbackTitle,
        channel: details.snippet?.channelTitle || item.fallbackChannel,
        thumbnail: details.snippet?.thumbnails?.medium?.url || item.fallbackThumbnail,
      };
    });
    const out = NextResponse.json({ items, nextPageToken: data.nextPageToken || "" }, { headers: { "Cache-Control": "no-store" } });
    if (auth.refreshed) writeSession(out, auth.session);
    return out;
  } catch {
    return NextResponse.json({ error: "Błąd pobierania utworów playlisty." }, { status: 500 });
  }
}
