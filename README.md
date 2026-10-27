# Novy Music

Prywatna aplikacja Next.js do wyszukiwania i odtwarzania filmów z YouTube. Zawiera lokalne polubienia/historię, lokalne playlisty oraz opcjonalne połączenie konta Google/YouTube przez OAuth do odczytu playlist YouTube.

## Konfiguracja OAuth Google/YouTube

1. W Google Cloud włącz **YouTube Data API v3**.
2. W Google Auth Platform ustaw typ odbiorców **Z zewnątrz**, dodaj swój Gmail w sekcji **Użytkownicy testowi** i dodaj zakres `https://www.googleapis.com/auth/youtube.readonly` w **Dostęp do danych**.
3. Utwórz klienta OAuth typu **Aplikacja internetowa**.
4. W **Autoryzowane identyfikatory URI przekierowania** dodaj dokładnie adres, który będzie ustawiony jako `GOOGLE_REDIRECT_URI`, na przykład:
   `https://music.novydev.pl/api/auth/google/callback`
5. Ustaw w zmiennych środowiskowych Vercel (Production):
   - `GOOGLE_CLIENT_ID` — identyfikator klienta OAuth.
   - `GOOGLE_CLIENT_SECRET` — tajny klucz klienta. Nie umieszczaj go w kodzie ani w repozytorium.
   - `GOOGLE_REDIRECT_URI` — dokładnie ten sam adres co w Google Cloud.
   - `AUTH_SECRET` — losowy sekret o długości co najmniej 32 znaków. Wygeneruj w PowerShell/terminalu poleceniem:
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `SITE_PASSWORD` — hasło do prywatnej strony.
6. Zapisz zmienne i wykonaj ponowne wdrożenie produkcyjne.
7. Otwórz Novy Music, przejdź do **Ustawienia** i kliknij **Połącz konto Google / YouTube**. Konto musi być na liście użytkowników testowych podczas testowania.

`GOOGLE_REDIRECT_URI` musi być identyczny w Google Cloud i Vercel — włącznie z `https://`, domeną, ścieżką i brakiem dodatkowego ukośnika. Jeżeli aplikacja jest testowana na innej domenie niż `music.novydev.pl`, dodaj również jej dokładny callback URI w Google Cloud i ustaw tę samą wartość w Vercel.

## Lokalny start

1. Zainstaluj Node.js 20.9 lub nowszy.
2. Skopiuj `.env.example` do `.env.local` i uzupełnij prawdziwe wartości.
3. `npm install`
4. `npm run dev`

W lokalnym teście ustaw `GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback` i dodaj identyczny adres w konfiguracji OAuth Google. W Google Cloud dodaj `http://localhost:3000` do autoryzowanych źródeł JavaScript, jeśli formularz tego wymaga.

## Bezpieczeństwo i ograniczenia

- Sekrety OAuth nie są przekazywane do kodu klienta. Sesja z tokenami jest szyfrowana po stronie serwera i przechowywana w ciasteczku HttpOnly.
- Strona nadal używa HTTP Basic Auth z `SITE_PASSWORD`.
- W trybie testowym Google OAuth mogą logować się tylko dodani użytkownicy testowi.
- W aplikacji są playlisty lokalne (zapisane w tej przeglądarce) i osobno playlisty konta YouTube.
- Odtwarzanie odbywa się przez oficjalny odtwarzacz YouTube; mogą pojawiać się reklamy. Aplikacja ich nie omija.
