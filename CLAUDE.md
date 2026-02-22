# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4
- PostgreSQL 16 (Docker) + Prisma ORM
- DataForSEO API (credentials podawane przez użytkownika w UI)
- SheetJS (xlsx) — eksport Excel

## Komendy
- `docker-compose up -d db` — uruchomienie samego PostgreSQL (dev)
- `docker-compose up --build` — pełna konteneryzacja (app + DB)
- `npx prisma migrate dev` — migracje bazy
- `PORT=3848 npm run dev` — development server (dev.sot.nimblio.work przez Caddy)
- `npm run build` — production build
- `npm run db:studio` — Prisma Studio (GUI do bazy)
- `npm run db:push` — push schematu bez tworzenia migracji
- `npm run lint` — ESLint

## Architektura

### Nawigacja (Sidebar)
Aplikacja używa stałego sidebara (`src/components/Sidebar.tsx`) z sekcjami:
- `/` — landing page dla niezalogowanych (opis aplikacji, funkcje, link afiliacyjny DataForSEO); zalogowani → redirect na `/search`
- `/login` — dwukolumnowy layout: opis aplikacji + formularz logowania
- `/search` — wyszukiwarka firm (Google Maps SERP), obsługuje `?taskId=` do ładowania wyników z historii
- `/search/history` — historia wyszukiwań z eksportem CSV/XLSX per wiersz
- `/businesses` — lista wszystkich firm z bazy (wyszukiwarka, sortowanie)
- `/reviews` — pobieranie opinii po URL wizytówki, obsługuje `?prefill=<url>` do wstępnego wypełnienia pola URL (bez auto-fetcha)
- `/reviews/history` — historia pobranych opinii (lista firm z DB)
- `/settings` — ustawienia API DataForSEO
- `/shared` — udostępnione taski (filtry: czyje — od innych/moje/wszystkie, typ — wyszukiwania/opinie)
- `/tasks` — dashboard wszystkich zadań (admin-only, guard po emailu)
- `/business/[cid]` — strona szczegółów firmy (Business tworzony automatycznie z danych MapsSearchResult przy kliknięciu "Szczegóły" — bez dodatkowego API call). Przycisk "Załaduj recenzje" → `/reviews?prefill=<mapsUrl>`

`/` redirectuje na `/search`. Layout (`src/app/layout.tsx`) zawiera sidebar + main content area (flex).

### Przepływ danych (async task pattern)
Pobieranie recenzji używa 3-krokowego wzorca asynchronicznego DataForSEO:
1. POST `reviews/task_post` → tworzy task, zapisuje `ReviewTask` w DB ze statusem `pending`
2. Polling co 15s: GET `reviews/tasks_ready` → sprawdza czy task gotowy
3. GET `reviews/task_get` → pobiera wyniki, upsertuje recenzje do DB, oznacza task jako `completed`

Klient (`/reviews/page.tsx`) zarządza pollingiem przez `setInterval`. Po odświeżeniu strony, pending taski są odzyskiwane z `/api/reviews/pending`.

### Postback (callback) z DataForSEO
Gdy `CALLBACK_BASE_URL` jest ustawiony, async taski (reviews, search, business-info) wysyłają `postback_url` w payload `task_post`. Po zakończeniu taska DFS wysyła POST z pełnymi wynikami (gzip) na `/api/callback/postback?tag={type}`. Endpoint dekompresuje, parsuje JSON i przetwarza wyniki — identycznie jak polling status routes. Polling zostaje jako fallback (DFS retryuje jeśli nasz serwer nie odpowie w 10s).

Logika przetwarzania wyników jest wyekstrahowana do `src/lib/task-processors.ts` (shared między status routes a postback handler). Helper URL + IP allowlist w `src/lib/pingback.ts`. Endpoint postback waliduje IP nadawcy (tylko serwery DFS) i stosuje rate limit 100 req/min per IP.

### Wyszukiwarka firm (Google Maps SERP)
Trzy metody pobierania wyników:
- **Live** (`/v3/serp/google/maps/live/advanced`): natychmiastowe, $0.002/strona SERP
- **Standard** (async `task_post` priority=1): ~5 min, $0.0006/strona SERP
- **Priority** (async `task_post` priority=2): ~1 min, $0.0012/strona SERP

Depth mnożnik: koszt × (depth/100). Wyniki cache'owane w DB (`MapsSearchTask` + `MapsSearchResult`). Cache odświeżany tylko ręcznie (przycisk "Odśwież" z `refresh: true`).

### Pobieranie opinii (Reviews)
Cennik DataForSEO za opinie (`/v3/business_data/google/reviews/task_post`):
- **Koszt bazowy**: $0.002 per task
- **Depth mnożnik**: koszt × (depth/100), np. depth=500 → $0.002 × 5 = $0.01

Widok opinii per task: `/reviews/task/[taskId]` — dedykowana strona z pełną listą opinii + eksport (CSV, XLSX, Webhook). Kliknięcie w task na stronie firmy przenosi do tego widoku.

### Batch reviews
Endpoint `/api/reviews/batch` wysyła jeden POST do DataForSEO z wieloma taskami (do 100). Polling statusu przez `/api/reviews/batch/status`. UI z checkboxami w tabeli wyników wyszukiwania + batch actions toolbar.

### Cache'owanie
Wszystkie dane z DataForSEO API są cache'owane w PostgreSQL. Każdy endpoint API sprawdza najpierw DB — zewnętrzne API jest wywoływane tylko przy cache miss lub jawnym `refresh: true`. Deduplikacja recenzji przez constraint `@@unique([businessId, authorName, publishedAt])`. Relacja many-to-many `Review ↔ ReviewTask` (implicit junction table `_ReviewTaskReviews`) śledzi które recenzje zostały pobrane przez który task.

### Autentykacja i sesje
- Credentials DataForSEO przechowywane server-side w encrypted cookie (iron-session, `dfs_session`)
- Login walidowany przez DataForSEO API (`/v3/appendix/user_data`) na `/api/auth/login`
- `middleware.ts` (root) wymusza sesję na wszystkich stronach/API (publiczne: `/login`, `/api/auth/*`, `/_next/*`)
- Brak sesji → redirect na `/login` (strony) lub 401 (API)
- Sesja: `{ dfsLogin, dfsPassword, isLoggedIn }`, TTL 7 dni, httpOnly, secure, sameSite=lax
- Konfiguracja w `src/lib/session.ts`, wymaga `SESSION_SECRET` w `.env`

### Izolacja danych (multi-user)
- Każdy task/biznes/recenzja ma pole `dfsLogin` (email użytkownika DataForSEO)
- Użytkownik widzi tylko swoje dane (filtr `WHERE dfsLogin = ?` na każdym query)
- Admin (`ADMIN_EMAIL` env var) widzi wszystkie dane
- Helpery: `isAdmin(login)`, `userWhere(login)` w `src/lib/session.ts`
- Endpointy przyjmujące `taskId`/`cid` weryfikują własność zasobu → 403 jeśli `task.dfsLogin !== login`
- Cache wyszukiwań (`MapsSearchTask`) filtrowany po `dfsLogin` — user B nie trafia na cache usera A
- Endpointy z walidacją własności: `reviews/by-task/[taskId]`, `business/[cid]`, `search/results`, `reviews/export`, `search/export`

### Sharing (udostępnianie tasków)
- `ReviewTask` i `MapsSearchTask` mają pole `isShared Boolean @default(false)`
- `isShared = true` oznacza widoczność dla wszystkich zalogowanych użytkowników
- `userWhere()` automatycznie uwzględnia shared taski: `OR: [{dfsLogin}, {isShared: true}]`
- `canAccess()` helper sprawdza dostęp: owner || admin || isShared
- Toggle share: `PATCH /api/share` (body: `{ taskId, taskType, isShared }`) — tylko owner/admin
- Lista shared: `GET /api/shared?owner=others|mine|all&type=all|search|review`
- `ShareButton` komponent — toggle dla ownera, read-only badge dla innych
- Strona `/shared` z filtrami (czyje + typ taska)
- Business nie ma `isShared` — dostęp przez powiązane shared taski

### Walidacja wejścia
- Wszystkie API routes walidują body przez zod (`src/lib/validation.ts`)
- Helper `parseBody(schema, data)` → 400 z opisem błędu przy niepoprawnych danych

### Stan aplikacji
Stan frontendowy żyje w custom hookach i komponentach stron (useState/useEffect/useCallback). Brak zewnętrznego state managera. Logika pollingu i lokalizacji wydzielona do reużywalnych hooków w `src/hooks/`.

## Deploy
- Docker Compose: `docker-compose up -d --build` (app + PostgreSQL)
- `POSTGRES_PASSWORD` i `SESSION_SECRET` wymagane w `.env` (brak defaults — docker-compose failuje bez nich)
- `DATABASE_URL` w docker-compose automatycznie używa `${POSTGRES_PASSWORD}`
- `setup.sh` generuje `.env` z bezpiecznymi losowymi hasłami
- `.env.example` — wzór zmiennych do skopiowania jako `.env`
- Migracje odpalają się automatycznie przy starcie kontenera (`docker-entrypoint.sh`)
- Jedna czysta migracja `init` (squash z 15 inkrementalnych)
- App container dołączony do zewnętrznej sieci `caddy-network` (reverse proxy Caddy)
- Porty `APP_PORT` i `DB_PORT` dynamiczne po obu stronach (host↔container) — `PGPORT` i `PORT` ustawiane wewnątrz kontenerów

### Domeny (Caddy reverse proxy)
- **Produkcja**: `sot.nimblio.work` → `search-ops-toolkit-app-1:3847` (Docker container)
- **Dev**: `dev.sot.nimblio.work` → `172.21.0.1:3848` (host, `PORT=3848 npm run dev`)
- Caddy działa w Dockerze (`docker-caddy-1`), obsługuje SSL automatycznie

## Zmienne środowiskowe
- `SESSION_SECRET` — klucz szyfrowania sesji iron-session (wymagany)
- `DATABASE_URL` — connection string PostgreSQL (wymagany w dev, auto w docker-compose)
- `POSTGRES_PASSWORD` — hasło do PostgreSQL (używane przez docker-compose)
- `ADMIN_EMAIL` — email admina, widzi wszystkie dane użytkowników (opcjonalny)
- `APP_PORT` — port hosta dla aplikacji (default: 3000, docker-compose)
- `DB_PORT` — port hosta dla PostgreSQL (default: 5432, docker-compose, bind na 127.0.0.1)
- `CALLBACK_BASE_URL` — bazowy URL dla postbacków DataForSEO, np. `https://sot.nimblio.work` (opcjonalny, bez niego app działa z samym pollingiem)

## Struktura kluczowych plików

Strony (`src/app/**/page.tsx`) i API routes (`src/app/api/**/route.ts`) podążają za konwencją Next.js App Router — ścieżki URL mapują się 1:1 na strukturę katalogów (patrz sekcja Nawigacja).

### Hooki (`src/hooks/`)
- `useLocationData.ts` — fetch countries/languages/SERP locations, localStorage persistence
- `useSearchPolling.ts` — polling async search tasks
- `useBatchReviews.ts` — batch fetch reviews z polling statusu
- `useReviewsPolling.ts` — polling reviews tasks z timer
- `useBusinessInfoPolling.ts` — polling business info tasks

### Lib (`src/lib/`)
- `dfs/client.ts` — bazowy klient DataForSEO API (typy, auth, dfsPost/dfsGet)
- `dfs/locations.ts` — lokalizacje i języki DataForSEO
- `dfs/business-info.ts` — business info API (live + async task pattern)
- `dfs/maps-search.ts` — Google Maps SERP search (live + async)
- `dfs/reviews.ts` — reviews API (task_post, tasks_ready, task_get)
- `dataforseo.ts` — re-eksport z `dfs/` (backward compatibility)
- `session.ts` — iron-session config, getSession, getSessionCredentials, isAdmin, userWhere, canAccess
- `validation.ts` — schematy zod dla wszystkich endpointów, parseBody helper
- `cid-extractor.ts` — ekstrakcja CID z URL Google Maps (ludocid, hex z data=, ftid)
- `export.ts` — generatory CSV (z BOM UTF-8) i XLSX
- `db.ts` — singleton Prisma (globalThis pattern dla hot-reload)
- `pingback.ts` — helper `buildPostbackUrl()` + `DFS_CALLBACK_IPS` allowlist dla callbacków DataForSEO
- `task-processors.ts` — shared logika przetwarzania wyników tasków (reviews, search, business-info) — reużywana przez status routes i postback handler

### Inne
- `middleware.ts` — Next.js middleware wymuszające sesję (redirect/401)
- `prisma/schema.prisma` — modele: Business, Review, ReviewTask, BusinessInfoTask, MapsSearchTask, MapsSearchResult, DfsLocation, DfsLanguage, DfsSerpLocation

## Konwencje
- Dodawać komentarze do kodu (po angielsku, spójnie z kontekstem)
- API routes zwracają `NextResponse.json()` z odpowiednim status code
- Eksport server-side: route GET `/api/export` (recenzje) i `/api/search/export` (wyniki wyszukiwania) i `/api/reviews/export` (opinie per task) generują pliki z danych w DB
- Webhook URL przechowywany w `localStorage` pod kluczem `webhook_url`, konfigurowalny w Settings
- Webhook payloady: search → `{ type: "search_results", results }`, reviews → `{ type: "reviews", businessName, reviews }`
- Lokalizacja/język zapamiętywane w `localStorage` (`search_country`, `search_country_code`, `search_language`, `search_serp_location`, `reviews_location`, `reviews_language`, `reviews_language_code`)
- Koszty API śledzone per-task w `ReviewTask.cost` i `MapsSearchTask.cost`, agregowane w `/api/costs`
- Lokalizacje i języki DataForSEO cache'owane w tabelach `DfsLocation`/`DfsLanguage`
- Lokalizacje SERP (miasta/regiony per kraj) cache'owane w `DfsSerpLocation`, ładowane dynamicznie po zmianie kraju przez `/api/serp-locations` (endpoint: `/v3/serp/google/locations/{country_iso_code}`)
- Wszystkie taski mają pole `dfsLogin` (nullable) — zapisywany login z sesji przy tworzeniu taska
- Admin widzi wszystkie dane, zwykły user tylko swoje (filtr server-side)
- Security headers w `next.config.ts` (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
