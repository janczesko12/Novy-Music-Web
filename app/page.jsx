'use client';

import { useEffect, useState } from "react";

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

  useEffect(() => {
    const k = localStorage.getItem(KEY) || "";
    setApiKey(k);
    setDraftKey(k);
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || "{}");
      setFavorites(saved.favorites || []);
      setPlaylists(saved.playlists || []);
      setRecent(saved.recent || []);
    } catch { /* ignore damaged local storage */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORE, JSON.stringify({ favorites, playlists, recent }));
  }, [hydrated, favorites, playlists, recent]);

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

  function play(track) {
    setCurrent(track);
    setRecent(old => [track, ...old.filter(x => x.id !== track.id)].slice(0, 15));
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
  const pageTitle = ({ home: "Twoja muzyka. Twój rytm.", search: "Wyniki wyszukiwania", liked: "Polubione", recent: "Ostatnio odtwarzane", library: "Biblioteka", settings: "Ustawienia", discover: "Odkrywaj", youtube: selectedYtPlaylist?.title || "Moje YouTube" })[view] || playlist?.name || "Playlista";
  const quickSearch = value => { setQuery(value); void searchMusic(value); };
  function trackRows(list) {
    return <div className="track-list">{list.map((track, i) => <div className="track" key={track.id}>
      <button className="thumb" onClick={() => play(track)}>{track.thumbnail ? <img src={track.thumbnail} alt="" /> : "♫"}<i>▶</i></button>
      <button className="track-info" onClick={() => play(track)}><b title={track.title}>{track.title}</b><small>{track.channel}</small></button>
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
    </header>

    <div className="layout">
      <nav className="sidebar"><label>MENU</label>
        {[ ["home","⌂ Strona główna"], ["discover","◈ Odkrywaj"], ["library","▤ Biblioteka"], ["liked","♥ Polubione"], ["recent","◷ Ostatnie"], ["youtube","▶ Moje YouTube"] ].map(([id, label]) => <button key={id} className={view === id ? "nav on" : "nav"} onClick={() => { setView(id); if (id === "youtube") { setSelectedYtPlaylist(null); setYtItems([]); if (ytAccount) void loadYtPlaylists(); } }}>{label}</button>)}
        <hr /><div className="side-title">PLAYLISTY <button onClick={createPlaylist}>＋</button></div>
        {playlists.map(p => <button key={p.id} className={view === "playlist" && playlistId === p.id ? "nav on" : "nav"} onClick={() => { setPlaylistId(p.id); setView("playlist"); }}>♫ {p.name}</button>)}
        <div className="spacer" /><small>🔒 PRYWATNA PRZESTRZEŃ</small>
      </nav>

      <section className="content"><small className="eyebrow">● TWOJA MUZYCZNA PRZESTRZEŃ</small><h1>{view === "playlist" ? (playlist?.name || "Playlista") : pageTitle}</h1>
        {view === "home" && <>
          <section className="hero"><div><small className="tag">♫ NOVY MUSIC</small><h2>Każdy utwór.<br /><em>Twój własny rytm.</em></h2><p>Wyszukuj muzykę z YouTube, zapisuj ulubione i twórz playlisty.</p><button onClick={() => quickSearch("popular music 2026")}>▶ Odkryj muzykę</button></div><span className="disc">♫</span></section>
          <div className="section"><h2>Na co masz ochotę?</h2><p>Wybierz gatunek, aby wyszukać utwory.</p></div>
          <div className="moods">{[["Polski rap","polski rap"],["Pop","pop hits"],["Elektronika","electronic music"],["Chill","chill music"]].map(([name, q], i) => <button key={name} className={`mood mood-${i}`} onClick={() => quickSearch(q)}><b>{name}</b><small>Odkrywaj muzykę　›</small></button>)}</div>
          <div className="section"><h2>Ostatnio słuchane</h2></div>{recent.length ? trackRows(recent.slice(0, 5)) : <p className="hint">Wyszukaj pierwszy utwór, aby zobaczyć go tutaj.</p>}
          {!apiKey && <div className="setup"><span>⚿</span><div><b>Połącz wyszukiwanie YouTube</b><p>Dodaj klucz API w ustawieniach.</p></div><button onClick={() => setView("settings")}>Skonfiguruj ›</button></div>}
        </>}
        {view === "discover" && <div className="moods">{[["Polski rap","polski rap"],["Pop","pop music"],["Rock","rock music"],["Elektronika","electronic music"],["Lo-fi","lofi hip hop"],["Soundtracki","movie soundtrack"]].map(([n, q], i) => <button key={n} className={`mood mood-${i % 4}`} onClick={() => quickSearch(q)}><b>{n}</b><small>Odkrywaj ›</small></button>)}</div>}
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
        {["search", "liked", "recent", "playlist", "library"].includes(view) && (view === "library" ? <div className="library">{[{name:"Polubione", count:favorites.length, go:()=>setView("liked")},{name:"Ostatnie",count:recent.length,go:()=>setView("recent")},...playlists.map(p=>({name:p.name,count:p.tracks.length,go:()=>{setPlaylistId(p.id);setView("playlist")}}))].map(x=><button key={x.name} onClick={x.go}><b>{x.name}</b><small>{x.count} utworów　›</small></button>)}<button onClick={createPlaylist}>＋ Nowa playlista</button></div> : <><p className="results-head">{view === "search" ? `Wyniki: ${term}` : `${items.length} utworów`}</p>{error && <p className="error">{error}</p>}{loading && <p className="hint">Szukam w YouTube…</p>}{trackRows(items)}{view === "search" && nextToken && !loading && <button className="more" onClick={() => searchMusic(term, nextToken, true)}>Pokaż więcej</button>}{["liked","recent","playlist"].includes(view) && !items.length && <p className="hint">Lista jest pusta.</p>}</>)}
        <footer>Novy Music · YouTube Data API · Oficjalny odtwarzacz YouTube</footer>
      </section>

      <aside className="player"><small>TERAZ ODTWARZANE</small><h2>Odtwarzacz</h2>
        {current ? <><div className="video"><iframe key={current.id} src={`https://www.youtube-nocookie.com/embed/${current.id}?autoplay=1&rel=0&playsinline=1`} title={current.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div><h3>{current.title}</h3><small>{current.channel}</small><div className="controls"><button onClick={() => { const i = results.findIndex(t => t.id === current.id); if (i > 0) play(results[i-1]); }}>◀◀</button><button onClick={() => { const i = results.findIndex(t => t.id === current.id); if (i >= 0 && i < results.length-1) play(results[i+1]); }}>▶▶</button><button onClick={() => toggleFavorite(current)}>{isFavorite(current) ? "♥" : "♡"}</button><button onClick={() => addToPlaylist(current)}>＋ Playlista</button></div><p className="warning">Oficjalny odtwarzacz YouTube — reklamy mogą się pojawić.</p></> : <div className="empty"><div>♫</div><h3>Muzyka czeka</h3><p>Wyszukaj i wybierz utwór.</p></div>}
        <small className="note">Playlisty zapisane w tej przeglądarce.</small>
      </aside>
    </div>
  </main>;
}
