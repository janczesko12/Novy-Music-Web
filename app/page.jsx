'use client';

import { useEffect, useRef, useState } from "react";

const KEY = "novy-music-api-key";
const STORE = "novy-music-state";

export default function Page() {
  const [view, setView] = useState("home");
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [draftKey, setDraftKey] = useState("");
  const [results, setResults] = useState([]);
  const [nextToken, setNextToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(null);
  const [playerMode, setPlayerMode] = useState("video");
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playQueue, setPlayQueue] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const playerFrameRef = useRef(null);
  const videoStartedRef = useRef(false);
  const [favorites, setFavorites] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [recent, setRecent] = useState([]);
  const [playlistId, setPlaylistId] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [ytAccount, setYtAccount] = useState(null);
  const [ytPlaylists, setYtPlaylists] = useState([]);
  const [ytItems, setYtItems] = useState([]);
  const [selectedYtPlaylist, setSelectedYtPlaylist] = useState(null);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState("");
  const [historyImportMessage, setHistoryImportMessage] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationFilter, setRecommendationFilter] = useState("Dla Ciebie");
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState("");
  const [recommendationProfile, setRecommendationProfile] = useState("");
  const [dismissedRecommendations, setDismissedRecommendations] = useState([]);
  const [recommendationAttempted, setRecommendationAttempted] = useState(false);

  useEffect(() => {
    const k = localStorage.getItem(KEY) || "";
    setApiKey(k);
    setDraftKey(k);
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || "{}");
      setFavorites(saved.favorites || []);
      setPlaylists(saved.playlists || []);
      setRecent(saved.recent || []);
      setDismissedRecommendations(saved.dismissedRecommendations || []);
      const savedRecommendations = Array.isArray(saved.recommendations) ? saved.recommendations : [];
      setRecommendations(savedRecommendations);
      if (savedRecommendations.length) setRecommendationAttempted(true);
      setRecommendationProfile(saved.recommendationProfile || "");
    } catch { /* ignore damaged local storage */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORE, JSON.stringify({
      favorites, playlists, recent, dismissedRecommendations, recommendations, recommendationProfile
    }));
  }, [hydrated, favorites, playlists, recent, dismissedRecommendations, recommendations, recommendationProfile]);

  useEffect(() => {
    if (!hydrated || view !== "home" || recommendationAttempted) return;
    setRecommendationAttempted(true);
    void loadRecommendations("Dla Ciebie");
  }, [hydrated, view, recommendationAttempted]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("youtube") === "connected";
    const authError = params.get("youtubeError");
    if (connected || authError) setView("settings");
    if (authError) {
      const messages = {
        not_configured: "Brakuje konfiguracji OAuth w Vercel. Sprawdź zmienne środowiskowe.",
        consent_denied: "Logowanie zostało anulowane. Możesz spróbować ponownie.",
        invalid_state: "Nie udało się potwierdzić sesji logowania. Spróbuj połączyć konto ponownie.",
        token_exchange_failed: "Google nie zwróciło tokenu logowania. Sprawdź Client ID, Client Secret i URI przekierowania.",
        profile_failed: "Nie udało się odczytać profilu Google.",
        callback_failed: "Wystąpił błąd podczas łączenia konta Google.",
      };
      setYtError(messages[authError] || "Nie udało się połączyć konta YouTube.");
    }
    if (connected || authError) window.history.replaceState(null, "", window.location.pathname);

    let active = true;
    fetch("/api/auth/status", { cache: "no-store" })
      .then(response => response.json())
      .then(async data => {
        if (!active) return;
        if (data.connected) {
          setYtAccount(data.profile);
          await loadYtPlaylists();
        } else {
          setYtAccount(null);
          setYtPlaylists([]);
        }
      })
      .catch(() => { if (active) setYtAccount(null); });
    return () => { active = false; };
  }, []);

  async function loadYtPlaylists() {
    setYtLoading(true);
    setYtError("");
    try {
      const response = await fetch("/api/youtube/playlists", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Nie udało się pobrać playlist.");
      setYtPlaylists(data.items || []);
    } catch (e) {
      setYtError(e?.message || "Nie udało się pobrać playlist z YouTube.");
    } finally { setYtLoading(false); }
  }

  async function openYtPlaylist(playlist) {
    setSelectedYtPlaylist(playlist);
    setYtItems([]);
    setYtError("");
    setView("youtube");
    setYtLoading(true);
    try {
      const response = await fetch(`/api/youtube/playlist-items?playlistId=${encodeURIComponent(playlist.id)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Nie udało się odczytać playlisty.");
      setYtItems(data.items || []);
    } catch (e) {
      setYtError(e?.message || "Nie udało się odczytać playlisty YouTube.");
    } finally { setYtLoading(false); }
  }

  async function disconnectYoutube() {
    await fetch("/api/auth/logout", { method: "POST" });
    setYtAccount(null);
    setYtPlaylists([]);
    setYtItems([]);
    setSelectedYtPlaylist(null);
    setYtError("");
    setView("settings");
  }

  async function searchMusic(value = query, pageToken = "", append = false) {
    if (!value.trim()) return;
    if (!apiKey) {
      setError("Dodaj klucz YouTube Data API w Ustawieniach.");
      setView("settings");
      return;
    }
    setLoading(true);
    setError("");
    setTerm(value);
    setView("search");
    if (!append) { setResults([]); setNextToken(""); }

    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      const params = {
        part: "snippet", type: "video", maxResults: "20", q: value.trim(),
        regionCode: "PL", safeSearch: "moderate", key: apiKey,
        ...(pageToken ? { pageToken } : {}),
      };
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      const response = await fetch(url);
      const json = await response.json();
      if (!response.ok || json.error) {
        const reason = json?.error?.errors?.[0]?.reason;
        if (reason === "quotaExceeded") throw new Error("Dzienny limit YouTube API został wyczerpany.");
        if (response.status === 403) throw new Error("Sprawdź klucz i włącz YouTube Data API v3 w Google Cloud.");
        throw new Error(json?.error?.message || "Błąd wyszukiwania.");
      }
      const found = (json.items || []).filter(x => x.id?.videoId).map(x => ({
        id: x.id.videoId,
        title: x.snippet?.title || "Utwór z YouTube",
        channel: x.snippet?.channelTitle || "YouTube",
        thumbnail: x.snippet?.thumbnails?.medium?.url || "",
      }));
      setResults(old => append ? [...old, ...found] : found);
      setNextToken(json.nextPageToken || "");
      if (!found.length && !append) setError("Nie znaleziono utworów. Spróbuj innego zapytania.");
    } catch (e) {
      setError(e?.message || "Nie udało się połączyć z YouTube API.");
    } finally { setLoading(false); }
  }

  function sendPlayerCommand(func, args = []) {
    const frame = playerFrameRef.current;
    if (!frame?.contentWindow) return;
    frame.contentWindow.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "https://www.youtube-nocookie.com"
    );
  }

  function handlePlayerFrameLoad() {
    // Start the embedded player postMessage handshake before subscribing to its events.
    const frame = playerFrameRef.current;
    frame?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: "novy-youtube-player" }), "https://www.youtube-nocookie.com");
    window.setTimeout(() => {
      sendPlayerCommand("addEventListener", ["onStateChange"]);
      sendPlayerCommand("addEventListener", ["onReady"]);
      sendPlayerCommand("setPlaybackRate", [Number(playbackRate)]);
      sendPlayerCommand("setVolume", [Number(volume)]);
      sendPlayerCommand("getDuration");
      sendPlayerCommand("getCurrentTime");
    }, 500);
  }

  function formatPlayerTime(value) {
    const seconds = Math.max(0, Math.floor(Number(value) || 0));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function play(track, queue = []) {
    const sourceQueue = Array.isArray(queue) && queue.length ? queue : [track];
    const uniqueQueue = sourceQueue.filter((item, index, all) =>
      item?.id && all.findIndex(candidate => candidate?.id === item.id) === index
    );
    if (!uniqueQueue.some(item => item.id === track.id)) uniqueQueue.unshift(track);
    setPlayQueue(uniqueQueue);
    setCurrent(track);
    setPlayerMode("video");
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(true);
    videoStartedRef.current = false;
    const playedAt = new Date().toISOString();
    setRecent(old => [
      { ...track, playedAt, historyId: `${track.id}-live-${Date.now()}`, importedFromTakeout: false },
      ...old.filter(x => x.id !== track.id)
    ].slice(0, 500));
  }

  function skipTrack(direction) {
    if (!current || !playQueue.length) return;
    const index = playQueue.findIndex(track => track.id === current.id);
    const next = playQueue[index + direction];
    if (next) play(next, playQueue);
  }

  function togglePlayback() {
    if (!current) return;
    if (playerMode !== "video") {
      setPlayerMode("video");
      setIsPlaying(true);
      return;
    }
    const nextPlaying = !isPlaying;
    sendPlayerCommand(nextPlaying ? "playVideo" : "pauseVideo");
    setIsPlaying(nextPlaying);
  }

  function togglePlayerMode(mode) {
    if (mode === playerMode) return;
    if (mode === "cover") {
      sendPlayerCommand("pauseVideo");
      setIsPlaying(false);
      setPlayerMode("cover");
    } else {
      setPlayerMode("video");
      setIsPlaying(true);
    }
  }

  useEffect(() => {
    if (!current || playerMode !== "video") return;

    const handlePlayerState = state => {
      if (state === 1) {
        videoStartedRef.current = true;
        setIsPlaying(true);
      } else if (state === 2) {
        setIsPlaying(false);
      } else if (state === 0 && videoStartedRef.current) {
        // Only advance after the current video actually started and then ended.
        videoStartedRef.current = false;
        const index = playQueue.findIndex(track => track.id === current.id);
        const next = index >= 0 ? playQueue[index + 1] : null;
        if (next) {
          play(next, playQueue);
        } else {
          setIsPlaying(false);
          setCurrentTime(duration || 0);
        }
      }
    };

    const onMessage = event => {
      if (event.source !== playerFrameRef.current?.contentWindow) return;
      if (!/youtube(-nocookie)?\.com$/i.test(new URL(event.origin).hostname)) return;
      let message = event.data;
      if (typeof message === "string") {
        try { message = JSON.parse(message); } catch { return; }
      }
      if (!message || typeof message !== "object") return;
      const info = message.info;
      if (message.event === "infoDelivery" && info && typeof info === "object") {
        if (Number.isFinite(info.currentTime)) setCurrentTime(Math.max(0, info.currentTime));
        if (Number.isFinite(info.duration) && info.duration > 0) setDuration(info.duration);
        if (Number.isFinite(info.volume)) setVolume(info.volume);
        if (Number.isFinite(info.playerState)) handlePlayerState(info.playerState);
      } else if (message.event === "onStateChange" && Number.isFinite(message.info)) {
        handlePlayerState(message.info);
      }
    };

    window.addEventListener("message", onMessage);
    const poll = window.setInterval(() => {
      sendPlayerCommand("getCurrentTime");
      sendPlayerCommand("getDuration");
      sendPlayerCommand("getVolume");
    }, 1000);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(poll);
    };
  }, [current, playerMode, playQueue, duration]);

  async function importYoutubeHistory(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setHistoryImportMessage("");
    try {
      const parsed = JSON.parse(await file.text());
      const records = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.items)
          ? parsed.items
          : Array.isArray(parsed?.activity)
            ? parsed.activity
            : null;
      if (!records) throw new Error("To nie wygląda na plik historii YouTube w formacie JSON.");

      const getVideoId = value => {
        if (typeof value !== "string") return "";
        try {
          const url = new URL(value);
          const id = url.searchParams.get("v");
          if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
          const match = url.pathname.match(/\/(?:shorts|embed|live)\/([a-zA-Z0-9_-]{11})/);
          if (match) return match[1];
          if (url.hostname === "youtu.be") {
            const shortId = url.pathname.slice(1).split("/")[0];
            if (/^[a-zA-Z0-9_-]{11}$/.test(shortId)) return shortId;
          }
        } catch { /* ignore malformed URLs */ }
        return "";
      };

      const usable = records.map((entry, index) => {
        const url = entry?.titleUrl || entry?.url || "";
        const id = getVideoId(url);
        if (!id) return null;
        const title = String(entry.title || "Utwór z YouTube")
          .replace(/^(watched|played|listened to|obejrzano|odtworzono|słuchano|sluchano)\s*/i, "")
          .trim() || "Utwór z YouTube";
        const channel = Array.isArray(entry.subtitles)
          ? entry.subtitles.map(x => x?.name).filter(Boolean).join(", ")
          : "";
        const playedAt = entry.time && !Number.isNaN(Date.parse(entry.time))
          ? new Date(entry.time).toISOString()
          : "";
        const products = Array.isArray(entry.products) ? entry.products.join(" ") : "";
        const marker = `${entry.header || ""} ${products} ${url}`;
        return {
          id,
          title,
          channel: channel || "YouTube",
          thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
          playedAt,
          historyId: `takeout-${id}-${playedAt || index}`,
          importedFromTakeout: true,
          __musicMarked: /youtube\s*music|music\.youtube\.com/i.test(marker),
          __index: index,
        };
      }).filter(Boolean);

      if (!usable.length) {
        throw new Error("Nie znaleziono utworów z linkiem do filmu. Wybierz watch-history.json z Google Takeout.");
      }

      const markedMusic = usable.filter(item => item.__musicMarked);
      const selected = markedMusic.length ? markedMusic : usable;
      const imported = selected
        .sort((a, b) => (Date.parse(b.playedAt) || 0) - (Date.parse(a.playedAt) || 0) || b.__index - a.__index)
        .slice(0, 500)
        .map(({ __musicMarked, __index, ...track }) => track);

      setRecent(old => {
        const keptLocal = old.filter(track => !track.importedFromTakeout);
        const uniqueLocal = new Map(keptLocal.map(track => [track.historyId || track.id, track]));
        const merged = [...uniqueLocal.values(), ...imported];
        const seenImported = new Set();
        const unique = merged.filter(track => {
          if (!track.importedFromTakeout) return true;
          if (seenImported.has(track.historyId)) return false;
          seenImported.add(track.historyId);
          return true;
        });
        return unique
          .sort((a, b) => (Date.parse(b.playedAt) || 0) - (Date.parse(a.playedAt) || 0))
          .slice(0, 500);
      });
      setHistoryImportMessage(`Zaimportowano ${imported.length} wpisów z historii. Dane zostały w tej przeglądarce.`);
    } catch (e) {
      setHistoryImportMessage(e?.message || "Nie udało się odczytać pliku historii.");
    } finally {
      event.target.value = "";
    }
  }
  async function loadRecommendations(filter = recommendationFilter) {
    setRecommendationAttempted(true);
    setRecommendationFilter(filter);
    setRecommendationError("");
    setRecommendationLoading(true);

    const clean = value => String(value || "")
      .toLocaleLowerCase("pl-PL")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    const stopWords = new Set([
      "official", "video", "music", "audio", "lyrics", "lyric", "visualizer",
      "officialvideo", "officialaudio", "prod", "production", "records", "record",
      "feat", "ft", "featuring", "with", "and", "the", "for", "from", "remix",
      "version", "edit", "mv", "hd", "4k", "topic", "vevo", "youtube", "musicvideo",
      "obejrzano", "odtworzono", "sluchano", "sluchany", "remastered", "live",
      "full", "song", "songs", "track", "visual", "audio", "pl", "officially"
    ]);
    const tokens = value => clean(value).split(/\s+/).filter(word => word.length > 2 && !stopWords.has(word));

    const artistOf = track => {
      const rawChannel = String(track?.channel || "").split(",")[0].trim();
      const channel = rawChannel
        .replace(/\s*[-–—]\s*topic$/i, "")
        .replace(/vevo$/i, "")
        .replace(/official$/i, "")
        .trim();
      const generic = !channel || /^(youtube|youtube music|unknown|various artists|topic|official audio|music)$/i.test(channel) || /sony music|warner music|universal music|music group|spinnin.? records|worldstar|music india/i.test(channel);
      if (!generic && channel.length <= 50) return channel;

      const title = String(track?.title || "");
      const prefix = title.split(/\s[-–—|•]\s/)[0]?.trim();
      if (prefix && prefix.length >= 2 && prefix.length <= 45 && tokens(prefix).length <= 5) return prefix;
      return "";
    };

    // Repeated listens count as a signal; favourites deliberately receive extra weight.
    const signalTracks = [
      ...favorites.map(track => ({ track, weight: 4 })),
      ...recent.slice(0, 100).map((track, index) => ({
        track,
        weight: Math.max(0.8, 2.3 - index * 0.015)
      }))
    ].filter(item => item.track?.id && item.track?.title);

    const uniqueSignalCount = new Set(signalTracks.map(item => item.track.id)).size;
    const artistScores = new Map();
    const wordScores = new Map();
    for (const { track, weight } of signalTracks) {
      const artist = artistOf(track);
      if (artist) {
        const key = clean(artist);
        if (key && key.length > 1) {
          const existing = artistScores.get(key) || { name: artist, score: 0 };
          existing.score += weight;
          artistScores.set(key, existing);
        }
      }
      const distinctWords = new Set([...tokens(track.title), ...tokens(track.channel)]);
      for (const word of distinctWords) wordScores.set(word, (wordScores.get(word) || 0) + weight);
    }

    const topArtists = [...artistScores.values()].sort((a, b) => b.score - a.score).slice(0, 4);
    const topArtistNames = topArtists.map(item => item.name);
    const artistWords = new Set(topArtistNames.flatMap(name => tokens(name)));
    const topTerms = [...wordScores.entries()]
      .filter(([word]) => !artistWords.has(word))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([word]) => word);
    const historyTracks = [...favorites, ...recent.slice(0, 100)].filter(track => track?.id && track?.title);
    const knownTitles = historyTracks.map(track => new Set(tokens(track.title)));
    const seenIds = new Set([
      ...favorites.map(track => track.id),
      ...recent.map(track => track.id),
      ...dismissedRecommendations
    ].filter(Boolean));

    setRecommendationProfile(topArtistNames.length
      ? `Najczęściej słuchasz: ${topArtistNames.slice(0, 3).join(" · ")}`
      : "");

    if (uniqueSignalCount < 3 || !topArtistNames.length) {
      setRecommendations([]);
      setRecommendationError("Nie chcę zgadywać na ślepo. Odtwórz lub polub co najmniej 3 różne utwory albo zaimportuj historię YouTube Music w zakładce „Ostatnie” — wtedy dopasuję propozycje do Twojego gustu.");
      setRecommendationLoading(false);
      return;
    }

    if (!apiKey) {
      setRecommendations([]);
      setRecommendationError("Twój profil muzyczny jest już rozpoznany, ale do wyszukania nowych, dopasowanych utworów potrzebny jest klucz YouTube Data API. Dodaj go w Ustawieniach.");
      setRecommendationLoading(false);
      return;
    }

    const filterQueries = {
      "Polski rap": "polski rap podobni wykonawcy nowe utwory",
      "Pop": "pop podobni wykonawcy nowe utwory",
      "Elektronika": "electronic dance podobni artyści nowe utwory",
      "Chill": "chill lofi mellow podobni artyści muzyka",
      "Nowości": `nowe utwory podobni wykonawcy ${new Date().getFullYear()}`,
    };

    try {
      const primaryArtist = topArtistNames[0];
      const secondaryArtist = topArtistNames[1];
      const favouriteTrack = favorites[0] || recent.find(track => artistOf(track) === primaryArtist) || recent[0];
      let searchQuery = "";

      if (filter === "Dla Ciebie") {
        const titleHint = favouriteTrack?.title ? tokens(favouriteTrack.title).slice(0, 4).join(" ") : "";
        searchQuery = titleHint.length > 2
          ? `songs like ${titleHint} by ${primaryArtist} similar artists`
          : `music similar to ${primaryArtist} ${secondaryArtist ? `and ${secondaryArtist}` : ""} similar artists`;
      } else {
        searchQuery = `${filterQueries[filter] || "music"} similar to ${primaryArtist}`;
        if (secondaryArtist) searchQuery += ` ${secondaryArtist}`;
        if (topTerms.length) searchQuery += ` ${topTerms.slice(0, 2).join(" ")}`;
      }

      // One search request per refresh. The old relatedToVideoId parameter is no longer supported.
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      const params = {
        part: "snippet",
        type: "video",
        maxResults: "50",
        order: "relevance",
        videoCategoryId: "10",
        regionCode: "PL",
        safeSearch: "moderate",
        q: searchQuery.replace(/\s+/g, " ").trim().slice(0, 100),
        key: apiKey,
      };
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

      const response = await fetch(url);
      const json = await response.json();
      if (!response.ok || json.error) {
        const reason = json?.error?.errors?.[0]?.reason;
        if (reason === "quotaExceeded") throw new Error("Wykorzystano dzienny limit wyszukiwania YouTube API. Odśwież rekomendacje później.");
        if (response.status === 403) throw new Error("Sprawdź klucz API i dostęp do YouTube Data API v3 w Ustawieniach.");
        throw new Error(json?.error?.message || "Nie udało się pobrać dopasowanych rekomendacji.");
      }

      const categoryWords = new Set(tokens(filterQueries[filter] || ""));
      const rejected = /\b(reaction|reacts|podcast|interview|tutorial|how to|gameplay|walkthrough|review|prank|news|commentary|reaction video)\b/i;
      const candidates = (json.items || [])
        .filter(item => item.id?.videoId && !seenIds.has(item.id.videoId))
        .map((item, index) => {
          const track = {
            id: item.id.videoId,
            title: item.snippet?.title || "Utwór z YouTube",
            channel: item.snippet?.channelTitle || "YouTube",
            thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || "",
          };
          const combinedText = `${track.title} ${track.channel}`;
          const normalizedTitle = new Set(tokens(track.title));
          const titleAlreadyHeard = knownTitles.some(previous => {
            if (!previous.size || !normalizedTitle.size) return false;
            const intersection = [...normalizedTitle].filter(word => previous.has(word)).length;
            return intersection / Math.max(normalizedTitle.size, previous.size) >= 0.78;
          });
          if (titleAlreadyHeard || rejected.test(track.title)) return null;

          const textKey = clean(combinedText);
          const artistMatches = topArtistNames.filter(artist => {
            const artistKey = clean(artist);
            return artistKey.length > 2 && textKey.includes(artistKey);
          });
          const words = new Set([...tokens(track.title), ...tokens(track.channel)]);
          let profileOverlap = 0;
          for (const word of words) profileOverlap += wordScores.get(word) || 0;
          let categoryOverlap = 0;
          for (const word of words) if (categoryWords.has(word)) categoryOverlap += 1;

          const score =
            (50 - index) * 0.025 +
            artistMatches.reduce((sum, artist) => sum + Math.min(artistScores.get(clean(artist))?.score || 0, 10) * 0.12, 0) +
            Math.min(profileOverlap, 12) * 0.16 +
            categoryOverlap * 0.25;
          const reason = artistMatches.length
            ? `Pasuje do: ${artistMatches[0]}`
            : topArtistNames.length
              ? `Podobne wyszukiwanie: ${topArtistNames[0]}`
              : "Dopasowane do Twojej muzyki";
          return { ...track, recommendationScore: score, recommendationReason: reason, recommendationQuery: searchQuery };
        })
        .filter(Boolean)
        .sort((a, b) => b.recommendationScore - a.recommendationScore);

      // Keep the feed varied: don't let one channel occupy every recommendation slot.
      const channelCounts = new Map();
      const diversified = candidates.filter(track => {
        const key = clean(track.channel || "unknown") || "unknown";
        const count = channelCounts.get(key) || 0;
        if (count >= 3) return false;
        channelCounts.set(key, count + 1);
        return true;
      }).slice(0, 24);

      setRecommendations(diversified);
      if (!diversified.length) {
        setRecommendationError("Nie znalazłem nowych utworów wystarczająco podobnych do Twojej historii. Spróbuj innego filtra lub posłuchaj kilku kolejnych utworów.");
      }
    } catch (e) {
      setRecommendations([]);
      setRecommendationError(e?.message || "Nie udało się pobrać rekomendacji.");
    } finally {
      setRecommendationLoading(false);
    }
  }

  function dismissRecommendation(track) {
    setDismissedRecommendations(old => [...new Set([...old, track.id])].slice(-1000));
    setRecommendations(old => old.filter(item => item.id !== track.id));
  }

  const isFavorite = track => favorites.some(x => x.id === track.id);
  function toggleFavorite(track) {
    setFavorites(old => isFavorite(track) ? old.filter(x => x.id !== track.id) : [track, ...old]);
  }
  function createPlaylist() {
    const name = window.prompt("Nazwa playlisty:");
    if (!name?.trim()) return;
    const playlist = { id: crypto.randomUUID(), name: name.trim(), tracks: [] };
    setPlaylists(old => [...old, playlist]);
    setPlaylistId(playlist.id);
    setView("playlist");
  }
  function addToPlaylist(track) {
    if (!playlists.length) {
      const name = window.prompt("Nazwa nowej playlisty:");
      if (!name?.trim()) return;
      const playlist = { id: crypto.randomUUID(), name: name.trim(), tracks: [track] };
      setPlaylists(old => [...old, playlist]);
      setPlaylistId(playlist.id);
      return;
    }
    const answer = window.prompt("Wpisz numer playlisty:\n" + playlists.map((x, i) => `${i + 1}. ${x.name}`).join("\n"));
    const index = Number(answer) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= playlists.length) return;
    setPlaylists(old => old.map(p => p.id === playlists[index].id
      ? { ...p, tracks: p.tracks.some(x => x.id === track.id) ? p.tracks : [...p.tracks, track] }
      : p));
  }
  function saveApiKey() {
    const value = draftKey.trim();
    if (value) localStorage.setItem(KEY, value); else localStorage.removeItem(KEY);
    setApiKey(value);
    setView("home");
  }

  const playlist = playlists.find(x => x.id === playlistId);
  const items = view === "liked" ? favorites : view === "recent" ? recent : view === "playlist" ? (playlist?.tracks || []) : results;
  const pageTitle = ({ home: "Twoja muzyka. Twój rytm.", search: "Wyniki wyszukiwania", liked: "Polubione", recent: "Ostatnio odtwarzane", library: "Biblioteka", settings: "Ustawienia", discover: "Odkrywaj", recommendations: "Rekomendacje", youtube: selectedYtPlaylist?.title || "Moje YouTube" })[view] || playlist?.name || "Playlista";
  const quickSearch = value => { setQuery(value); void searchMusic(value); };
  function trackRows(list) {
    return <div className="track-list">{list.map((track, i) => <div className="track" key={track.historyId || `${track.id}-${i}`}>
      <button className="thumb" onClick={() => play(track, list)}>{track.thumbnail ? <img src={track.thumbnail} alt="" /> : "♫"}<i>▶</i></button>
      <button className="track-info" onClick={() => play(track, list)}><b title={track.title}>{track.title}</b><small>{track.channel}{track.playedAt ? ` · ${new Date(track.playedAt).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })}` : ""}</small></button>
      <button className={isFavorite(track) ? "action liked" : "action"} onClick={() => toggleFavorite(track)} title="Polub">{isFavorite(track) ? "♥" : "♡"}</button>
      <button className="action" onClick={() => addToPlaylist(track)} title="Dodaj do playlisty">＋</button>
      <button className="action ext" onClick={() => window.open(`https://www.youtube.com/watch?v=${track.id}`, "_blank", "noopener,noreferrer")} title="Otwórz na YouTube">↗</button>
    </div>)}</div>;
  }

  return <main className="app">
    <header className="topbar">
      <button className="brand" onClick={() => setView("home")}><i>♫</i><b>novy<span>music</span></b></button>
      <form className="search" onSubmit={e => { e.preventDefault(); void searchMusic(); }}><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Szukaj utworów, wykonawców…" /><button aria-label="Szukaj">⌕</button></form>
      <button className="gear" onClick={() => { setDraftKey(apiKey); setView("settings"); }} title="Ustawienia">⚙</button>
      <button className="logout" onClick={async () => { try { await fetch("/api/site-auth/logout", { method: "POST" }); } finally { window.location.assign("/login"); } }} title="Wyloguj">↗ <span>Wyloguj</span></button>
    </header>

    <div className="layout">
      <nav className="sidebar"><label>MENU</label>
        {[ ["home","⌂ Strona główna"], ["recommendations","▦ Rekomendacje"], ["discover","◈ Odkrywaj"], ["library","▤ Biblioteka"], ["liked","♥ Polubione"], ["recent","◷ Ostatnie"], ["youtube","▶ Moje YouTube"] ].map(([id, label]) => <button key={id} className={view === id ? "nav on" : "nav"} onClick={() => { setView(id); if (id === "recommendations") void loadRecommendations("Dla Ciebie"); if (id === "youtube") { setSelectedYtPlaylist(null); setYtItems([]); if (ytAccount) void loadYtPlaylists(); } }}>{label}</button>)}
        <hr /><div className="side-title">PLAYLISTY <button onClick={createPlaylist}>＋</button></div>
        {playlists.map(p => <button key={p.id} className={view === "playlist" && playlistId === p.id ? "nav on" : "nav"} onClick={() => { setPlaylistId(p.id); setView("playlist"); }}>♫ {p.name}</button>)}
        <div className="spacer" /><small>🔒 PRYWATNA PRZESTRZEŃ</small>
      </nav>

      <section className="content"><small className="eyebrow">● TWOJA MUZYCZNA PRZESTRZEŃ</small><h1>{view === "playlist" ? (playlist?.name || "Playlista") : pageTitle}</h1>
        {view === "home" && <>
          <section className="hero"><div><small className="tag">♫ NOVY MUSIC</small><h2>Każdy utwór.<br /><em>Twój własny rytm.</em></h2><p>Wyszukuj muzykę z YouTube, zapisuj ulubione i twórz playlisty.</p><button onClick={() => quickSearch("popular music 2026")}>▶ Odkryj muzykę</button></div><span className="disc">♫</span></section>
          <div className="section"><h2>Na co masz ochotę?</h2><p>Wybierz gatunek, aby wyszukać utwory.</p></div>
          <div className="moods">{[["Polski rap","polski rap"],["Pop","pop hits"],["Elektronika","electronic music"],["Chill","chill music"]].map(([name, q], i) => <button key={name} className={`mood mood-${i}`} onClick={() => quickSearch(q)}><b>{name}</b><small>Odkrywaj muzykę　›</small></button>)}</div>
          <section className="home-hits">
            <div className="home-hits-heading">
              <div>
                <small className="home-hits-kicker">DOPASOWANE DO TWOJEGO GUSTU</small>
                <h2>Hity dla Ciebie <span>♫</span></h2>
                <p>{recommendationProfile || "Na podstawie Twojej historii i polubień"}</p>
              </div>
              <div className="home-hits-tools">
                <button onClick={() => { setView("recommendations"); if (!recommendations.length) void loadRecommendations("Dla Ciebie"); }}>Wszystkie <span>↗</span></button>
                <button className="home-hits-refresh" aria-label="Odśwież hity" title="Odśwież hity" disabled={recommendationLoading} onClick={() => void loadRecommendations("Dla Ciebie")}>↻</button>
              </div>
            </div>
            {recommendationLoading && !recommendations.length ? <div className="home-hits-row">
              {[0, 1, 2, 3].map(item => <div className="home-hit-skeleton" key={item}><div /><span /><span /></div>)}
            </div> : recommendations.length ? <div className="home-hits-row">
              {recommendations.slice(0, 12).map(track => <article className="home-hit" key={track.historyId || track.id}>
                <button className="home-hit-cover" onClick={() => play(track, recommendations)} aria-label={`Odtwórz ${track.title}`}>
                  {track.thumbnail ? <img src={track.thumbnail} alt="" loading="lazy" /> : <span>♫</span>}
                  <i>▶</i>
                </button>
                <div className="home-hit-details">
                  <button className="home-hit-title" onClick={() => play(track, recommendations)} title={track.title}>{track.title}</button>
                  <p>{track.channel || "YouTube"}</p>
                  {track.recommendationReason && <small>{track.recommendationReason}</small>}
                </div>
                <button className={isFavorite(track) ? "home-hit-like liked" : "home-hit-like"} title={isFavorite(track) ? "Usuń z ulubionych" : "Dodaj do ulubionych"} onClick={() => toggleFavorite(track)}>{isFavorite(track) ? "♥" : "♡"}</button>
              </article>)}
            </div> : <div className="home-hits-empty">
              <span className="home-hits-empty-icon">♫</span>
              <div><b>Najpierw poznajmy Twój gust</b><p>{recommendationError || "Zaimportuj historię YouTube Music albo posłuchaj kilku utworów, żebyśmy mogli dobrać trafniejsze hity."}</p></div>
              <button onClick={() => setView("recent")}>Importuj historię <span>›</span></button>
            </div>}
          </section>
          <div className="section"><h2>Ostatnio słuchane</h2></div>{recent.length ? trackRows(recent.slice(0, 5)) : <p className="hint">Wyszukaj pierwszy utwór, aby zobaczyć go tutaj.</p>}
          {!apiKey && <div className="setup"><span>⚿</span><div><b>Połącz wyszukiwanie YouTube</b><p>Dodaj klucz API w ustawieniach.</p></div><button onClick={() => setView("settings")}>Skonfiguruj ›</button></div>}
        </>}
        {view === "discover" && <div className="moods">{[["Polski rap","polski rap"],["Pop","pop music"],["Rock","rock music"],["Elektronika","electronic music"],["Lo-fi","lofi hip hop"],["Soundtracki","movie soundtrack"]].map(([n, q], i) => <button key={n} className={`mood mood-${i % 4}`} onClick={() => quickSearch(q)}><b>{n}</b><small>Odkrywaj ›</small></button>)}</div>}
        {view === "recommendations" && <div className="recommendations-view">
          <div className="recommendation-intro">
            <div><b>Odkryj coś nowego</b><p>Dobieram muzykę na podstawie powtarzających się wykonawców, Twojej historii i polubień.</p>{recommendationProfile && <small className="recommendation-profile">{recommendationProfile}</small>}</div>
            <button className="recommendation-refresh" onClick={() => void loadRecommendations(recommendationFilter)} disabled={recommendationLoading}>↻ Odśwież</button>
          </div>
          <div className="recommendation-filters" role="group" aria-label="Filtry rekomendacji">
            {["Dla Ciebie", "Polski rap", "Pop", "Elektronika", "Chill", "Nowości"].map(filter => <button key={filter} disabled={recommendationLoading} className={recommendationFilter === filter ? "recommendation-chip active" : "recommendation-chip"} onClick={() => void loadRecommendations(filter)}>{filter}</button>)}
          </div>
          {recommendationLoading && <p className="hint">Szukam propozycji w YouTube…</p>}
          {recommendationError && <div className="recommendation-message">{recommendationError}{!apiKey && <button onClick={() => { setDraftKey(apiKey); setView("settings"); }}>Otwórz ustawienia ↗</button>}</div>}
          {recommendations.length > 0 && <div className="recommendation-grid">
            {recommendations.map(track => <article className="recommendation-card" key={track.historyId || track.id}>
              <button className="recommendation-thumbnail" onClick={() => play(track, recommendations)} aria-label={`Odtwórz ${track.title}`}>
                {track.thumbnail ? <img src={track.thumbnail} alt="" loading="lazy" /> : <span>♫</span>}
                <i>▶</i>
              </button>
              <div className="recommendation-card-body">
                <div className="recommendation-text"><button className="recommendation-title" onClick={() => play(track, recommendations)} title={track.title}>{track.title}</button><p>{track.channel || "YouTube"}</p><small className="recommendation-reason">{track.recommendationReason}</small></div>
                <div className="recommendation-actions">
                  <button className={isFavorite(track) ? "action liked" : "action"} onClick={() => toggleFavorite(track)} title="Polub">{isFavorite(track) ? "♥" : "♡"}</button>
                  <button className="action" onClick={() => addToPlaylist(track)} title="Dodaj do playlisty">＋</button>
                  <button className="action ext" onClick={() => window.open(`https://www.youtube.com/watch?v=${track.id}`, "_blank", "noopener,noreferrer")} title="Otwórz na YouTube">↗</button>
                  <button className="action recommendation-dismiss" onClick={() => dismissRecommendation(track)} title="Nie polecaj tego utworu">×</button>
                </div>
              </div>
            </article>)}
          </div>}
          {!recommendationLoading && !recommendations.length && !recommendationError && <p className="hint">Nie ma jeszcze propozycji. Wybierz filtr, aby spróbować ponownie.</p>}
        </div>}
        {view === "settings" && <div className="settings">
          <h2>Połącz konto YouTube</h2>
          <p>Połączenie konta pozwoli Novy Music odczytać Twoje playlisty. Autoryzacja odbywa się na stronie Google, a tokeny są przechowywane po stronie serwera w zaszyfrowanym pliku cookie.</p>
          {ytError && <p className="error">{ytError}</p>}
          {ytAccount ? <div className="yt-account">
            {ytAccount.picture && <img src={ytAccount.picture} alt="" />}
            <div><b>Konto połączone</b><small>{ytAccount.name}</small><small>{ytAccount.email}</small></div>
            <button onClick={() => { setSelectedYtPlaylist(null); setYtItems([]); setView("youtube"); void loadYtPlaylists(); }}>Moje playlisty</button>
            <button className="disconnect" onClick={() => void disconnectYoutube()}>Odłącz</button>
          </div> : <a className="yt-connect" href="/api/auth/google">▶ Połącz konto Google / YouTube</a>}
          <div className="yt-playlists">
            <div className="yt-playlist-head"><h3>Twoje playlisty YouTube</h3><button onClick={() => void loadYtPlaylists()} disabled={!ytAccount || ytLoading}>Odśwież</button></div>
            {!ytAccount && <p>Najpierw połącz konto Google, aby zobaczyć playlisty.</p>}
            {ytLoading && <p>Ładowanie danych YouTube…</p>}
            {ytAccount && !ytLoading && !ytPlaylists.length && !ytError && <p>Nie znaleziono playlist na tym koncie.</p>}
            {ytPlaylists.map(item => <button className="yt-playlist" key={item.id} onClick={() => void openYtPlaylist(item)}>
              {item.thumbnail ? <img src={item.thumbnail} alt="" /> : <span>♫</span>}
              <span><b>{item.title}</b><small>{item.itemCount} utworów · {item.privacyStatus === "private" ? "Prywatna" : item.privacyStatus === "unlisted" ? "Niepubliczna" : "Publiczna"}</small></span><i>›</i>
            </button>)}
          </div>
          <hr />
          <h2>Klucz do wyszukiwania YouTube</h2><p>Klucz API jest używany do wyszukiwania utworów; połączenie konta powyżej służy do odczytu playlist.</p>
          <input type="password" value={draftKey} onChange={e => setDraftKey(e.target.value)} placeholder="YouTube Data API key" />
          <ol><li>Włącz <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer">YouTube Data API v3</a>.</li><li>Utwórz klucz w <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">Google Cloud Credentials</a>.</li><li>Ogranicz klucz do YouTube Data API i zapisz go tutaj.</li></ol><button onClick={saveApiKey}>Zapisz klucz</button>
          <p className="warning">Odtwarzacz YouTube może wyświetlać reklamy. Novy Music ich nie blokuje ani nie omija.</p>
        </div>}
        {view === "youtube" && <div className="yt-library">
          <div className="yt-playlist-head"><button onClick={() => { setSelectedYtPlaylist(null); setYtItems([]); }}>← Playlisty</button><button onClick={() => void loadYtPlaylists()} disabled={!ytAccount || ytLoading}>Odśwież playlisty</button></div>
          {!ytAccount && <div className="setup"><div><b>Nie połączono konta</b><p>Przejdź do ustawień, aby połączyć konto YouTube.</p></div><button onClick={() => setView("settings")}>Ustawienia ›</button></div>}
          {ytError && <p className="error">{ytError}</p>}
          {!selectedYtPlaylist && ytPlaylists.map(item => <button className="yt-playlist" key={item.id} onClick={() => void openYtPlaylist(item)}>
            {item.thumbnail ? <img src={item.thumbnail} alt="" /> : <span>♫</span>}
            <span><b>{item.title}</b><small>{item.itemCount} utworów</small></span><i>›</i>
          </button>)}
          {selectedYtPlaylist && <><p className="results-head">{selectedYtPlaylist.title}</p>{ytLoading ? <p className="hint">Pobieram utwory…</p> : trackRows(ytItems)}{!ytLoading && !ytItems.length && !ytError && <p className="hint">Ta playlista nie zawiera dostępnych filmów.</p>}</>}
        </div>}
        {["search", "liked", "recent", "playlist", "library"].includes(view) && (view === "library" ? <div className="library">{[{name:"Polubione", count:favorites.length, go:()=>setView("liked")},{name:"Ostatnie",count:recent.length,go:()=>setView("recent")},...playlists.map(p=>({name:p.name,count:p.tracks.length,go:()=>{setPlaylistId(p.id);setView("playlist")}}))].map(x=><button key={x.name} onClick={x.go}><b>{x.name}</b><small>{x.count} utworów　›</small></button>)}<button onClick={createPlaylist}>＋ Nowa playlista</button></div> : <>{view === "recent" && <section className="history-import">
          <div className="history-import-copy"><b>Historia YouTube Music</b><p>Importuj historię słuchania z Google Takeout. Plik jest przetwarzany lokalnie w tej przeglądarce — nie wysyłamy go na serwer.</p></div>
          <div className="history-import-actions"><a href="https://takeout.google.com/" target="_blank" rel="noreferrer">Pobierz historię w Google Takeout ↗</a><label htmlFor="youtube-history-file" className="history-import-button">＋ Importuj watch-history.json</label><input id="youtube-history-file" className="history-file" type="file" accept=".json,application/json" onChange={importYoutubeHistory} /></div>
          {historyImportMessage && <p className="history-import-status" role="status">{historyImportMessage}</p>}
          <p className="history-import-note">W Google Takeout wybierz „YouTube i YouTube Music”, następnie „historia” i format JSON. Po imporcie do 500 najnowszych wpisów znajdzie się na liście „Ostatnie”. Oficjalne API nie udostępnia historii na żywo.</p>
        </section>}<p className="results-head">{view === "search" ? `Wyniki: ${term}` : `${items.length} utworów`}</p>{error && <p className="error">{error}</p>}{loading && <p className="hint">Szukam w YouTube…</p>}{trackRows(items)}{view === "search" && nextToken && !loading && <button className="more" onClick={() => searchMusic(term, nextToken, true)}>Pokaż więcej</button>}{["liked","recent","playlist"].includes(view) && !items.length && <p className="hint">Lista jest pusta.</p>}</>)}
        <footer>Novy Music · YouTube Data API · Oficjalny odtwarzacz YouTube</footer>
      </section>

      <aside className="player"><small className="player-kicker">TERAZ ODTWARZANE</small><h2>Odtwarzacz</h2>
        {current ? <>
          <div className="player-mode-switch" role="group" aria-label="Widok odtwarzacza">
            <button className={playerMode === "cover" ? "active" : ""} onClick={() => togglePlayerMode("cover")} aria-pressed={playerMode === "cover"}>▧ Okładka</button>
            <button className={playerMode === "video" ? "active" : ""} onClick={() => togglePlayerMode("video")} aria-pressed={playerMode === "video"}>▶ Wideo</button>
          </div>
          {playerMode === "cover" ? <div className="player-cover">
            {current.thumbnail ? <img src={current.thumbnail} alt={`Okładka: ${current.title}`} /> : <div className="player-cover-fallback">♫</div>}
            <div className="player-cover-overlay"><button onClick={togglePlayback}>▶ Odtwórz wideo</button></div>
          </div> : <div className="video"><iframe ref={playerFrameRef} key={current.id} id="novy-youtube-player" src={`https://www.youtube-nocookie.com/embed/${current.id}?autoplay=1&controls=1&rel=0&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(typeof window !== "undefined" ? window.location.origin : "https://music.novydev.pl")}`} title={current.title} onLoad={handlePlayerFrameLoad} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>}
          <div className="player-track-meta"><h3>{current.title}</h3><small>{current.channel || "YouTube"}</small></div>
          <div className={`player-progress ${playerMode === "cover" ? "is-paused" : ""}`} style={{ "--player-progress": `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%` }}>
            <div className="player-progress-times"><span>{formatPlayerTime(currentTime)}</span><span>{duration > 0 ? formatPlayerTime(duration) : "--:--"}</span></div>
            <input type="range" min="0" max={Math.max(duration, 1)} step="1" value={Math.min(currentTime, duration || 1)} disabled={playerMode !== "video" || duration <= 0} onChange={event => { const seconds = Number(event.target.value); setCurrentTime(seconds); sendPlayerCommand("seekTo", [seconds, true]); }} aria-label="Pozycja utworu" />
          </div>
          {playQueue[playQueue.findIndex(track => track.id === current.id) + 1] && <div className="player-up-next"><span>DALEJ W KOLEJCE</span><b>{playQueue[playQueue.findIndex(track => track.id === current.id) + 1].title}</b><small>{playQueue[playQueue.findIndex(track => track.id === current.id) + 1].channel || "YouTube"}</small></div>}
          <div className="player-control-dock">
            <div className="player-transport">
              <button className="player-skip" onClick={() => skipTrack(-1)} disabled={playQueue.findIndex(track => track.id === current.id) <= 0} title="Poprzedni utwór" aria-label="Poprzedni utwór">⏮</button>
              <button className="player-play-pause" onClick={togglePlayback} title={playerMode === "cover" ? "Otwórz wideo i odtwórz" : isPlaying ? "Wstrzymaj" : "Odtwórz"} aria-label={playerMode === "cover" ? "Otwórz wideo i odtwórz" : isPlaying ? "Wstrzymaj" : "Odtwórz"}>{playerMode === "video" && isPlaying ? "Ⅱ" : "▶"}</button>
              <button className="player-skip" onClick={() => skipTrack(1)} disabled={playQueue.findIndex(track => track.id === current.id) < 0 || playQueue.findIndex(track => track.id === current.id) >= playQueue.length - 1} title="Następny utwór" aria-label="Następny utwór">⏭</button>
            </div>
            <div className="player-control-tools">
              <label className="player-speed"><span>Prędkość</span><select value={playbackRate} onChange={event => { const rate = Number(event.target.value); setPlaybackRate(rate); if (playerMode === "video") sendPlayerCommand("setPlaybackRate", [rate]); }} aria-label="Prędkość odtwarzania">
                <option value={0.5}>0,5×</option><option value={0.75}>0,75×</option><option value={1}>1×</option><option value={1.25}>1,25×</option><option value={1.5}>1,5×</option><option value={1.75}>1,75×</option><option value={2}>2×</option>
              </select></label>
              <label className="player-volume" style={{ "--volume-progress": `${volume}%` }}><span aria-hidden="true">{volume === 0 ? "🔇" : volume < 45 ? "🔉" : "🔊"}</span><input type="range" min="0" max="100" step="1" value={volume} onChange={event => { const nextVolume = Number(event.target.value); setVolume(nextVolume); if (playerMode === "video") sendPlayerCommand("setVolume", [nextVolume]); }} aria-label="Głośność" /></label>
              <div className="player-secondary-actions">
                <button onClick={() => toggleFavorite(current)} title={isFavorite(current) ? "Usuń z polubionych" : "Polub"} aria-label="Polub">{isFavorite(current) ? "♥" : "♡"}</button>
                <button onClick={() => addToPlaylist(current)} title="Dodaj do playlisty" aria-label="Dodaj do playlisty">＋</button>
              </div>
            </div>
          </div>
          {playerMode === "cover" && <p className="player-mode-note">Tryb okładki wstrzymuje wideo. Aby odtwarzać utwór, przełącz na „Wideo”.</p>}
          <p className="warning">Oficjalny odtwarzacz YouTube — reklamy mogą się pojawić.</p>
        </> : <div className="empty"><div>♫</div><h3>Muzyka czeka</h3><p>Wyszukaj i wybierz utwór.</p></div>}
        <small className="note">Playlisty zapisane w tej przeglądarce.</small>
      </aside>
    </div>
  </main>;
}
