"use client";

import { useEffect, useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [destination, setDestination] = useState("/");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const candidate = params.get("next") || "/";
    try {
      const target = new URL(candidate, window.location.origin);
      const safe = target.origin === window.location.origin && target.pathname.startsWith("/") && !candidate.startsWith("//");
      setDestination(safe ? target.pathname + target.search + target.hash : "/");
    } catch {
      setDestination("/");
    }
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/site-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || (response.status === 401
          ? "To hasło nie pasuje. Sprawdź je i spróbuj ponownie."
          : "Nie udało się zalogować. Spróbuj ponownie."));
        return;
      }
      window.location.assign(destination);
    } catch {
      setError("Nie udało się połączyć z serwerem. Sprawdź połączenie i spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-shell" aria-label="Logowanie do Novy Music">
        <div className="login-art" aria-hidden="true">
          <div className="login-brand">
            <span className="login-brand-mark" aria-hidden="true"><img src="/novy-music-mark.webp" alt="" /></span>
            <span className="login-brand-name">novy<span>music</span></span>
          </div>
          <p className="login-kicker">YOUR PRIVATE MUSIC SPACE</p>
          <h1 className="login-headline">Twoja muzyka.<br /><span>Twój własny rytm.</span></h1>
          <p className="login-copy">Wróć do ulubionych utworów, odkrywaj nowe brzmienia i miej swoją muzyczną przestrzeń zawsze pod ręką.</p>
          <div className="login-logo-art-wrap"><img className="login-logo-art" src="/novy-music-logo.webp" alt="Novy Music — logo" /></div>
          <div className="login-badges"><span>♫ Twoja biblioteka</span><span>✦ Bezpieczny dostęp</span><span>▶ YouTube</span></div>
        </div>

        <div className="login-panel">
          <div className="login-form-wrap">
            <div className="login-mini-brand">
              <span className="login-brand-mark" aria-hidden="true"><img src="/novy-music-mark.webp" alt="" /></span>
              <span className="login-brand-name">novy<span>music</span></span>
            </div>
            <p className="login-overline">PRYWATNA PRZESTRZEŃ</p>
            <h2 className="login-title">Witaj ponownie.</h2>
            <p className="login-subtitle">Wprowadź hasło, aby otworzyć swoją bibliotekę muzyczną.</p>

            <form onSubmit={submit}>
              <label className="login-label" htmlFor="site-password">Hasło dostępu</label>
              <div className="login-input-wrap">
                <input
                  id="site-password"
                  className="login-input"
                  type={visible ? "text" : "password"}
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  placeholder="Wpisz hasło do Novy Music"
                  autoComplete="current-password"
                  autoFocus
                  required
                  disabled={loading}
                />
                <button className="login-input-toggle" type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? "Ukryj hasło" : "Pokaż hasło"}>
                  {visible ? "Ukryj" : "Pokaż"}
                </button>
              </div>

              {error && <p className="login-error" role="alert">{error}</p>}
              <button className="login-submit" type="submit" disabled={loading || !password}>
                {loading ? "Sprawdzam…" : "Zaloguj się"}
                {!loading && <span className="login-submit-arrow">→</span>}
              </button>
            </form>

            <div className="login-divider">Tylko dla Ciebie</div>
            <div className="login-security">
              <span className="login-security-icon">▣</span>
              <span>Twoja strona jest prywatna. Sesja zostanie zapisana w bezpiecznym ciasteczku i wygaśnie po 7 dniach.</span>
            </div>
            <p className="login-status">Po zalogowaniu możesz połączyć swoje konto Google / YouTube.</p>
            <p className="login-footer">NOVY MUSIC <span>·</span> TWOJA MUZYKA, TWOJE ZASADY</p>
          </div>
        </div>
      </section>
    </main>
  );
}
