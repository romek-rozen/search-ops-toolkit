# Plan: Izolacja danych per użytkownik (dfsLogin) + sesje server-side

## Context
Aplikacja obecnie nie izoluje danych między użytkownikami — credentials przesyłane w body requestów, brak sesji, wszystkie dane widoczne dla wszystkich. Przed deployem na serwer publiczny trzeba dodać izolację per `dfsLogin` (sekcja 1 z TODO-BEZPIECZENSTWO.md) + security headers (sekcja 2.1).

---

## Faza 1 — Instalacja + session library

- `npm install iron-session` (encrypted httpOnly cookie, zero server state, Edge-compatible)
- Dodać `SESSION_SECRET` (min 32 znaków) do `.env`

**Nowe pliki:**
- `src/lib/session-config.ts` — `SessionData { dfsLogin, dfsPassword }` + `sessionOptions` (Edge-safe, bez importów Node)
- `src/lib/session.ts` — `getSession()` (Node-only, używa `next/headers`) + `requireSession()` helper dla API routes

## Faza 2 — Auth endpoints + middleware + login page

**Nowe pliki:**
- `src/app/api/auth/login/route.ts` — POST: walidacja credentials przez `GET /v3/appendix/user_data` DataForSEO, zapis sesji
- `src/app/api/auth/logout/route.ts` — POST: `session.destroy()`
- `src/app/api/auth/me/route.ts` — GET: zwraca `{ authenticated, login }`
- `middleware.ts` (root) — sprawdza sesję, przepuszcza `/login` + `/api/auth/*`, reszta → redirect `/login` lub 401 JSON
- `src/app/login/page.tsx` — formularz login/hasło, po sukcesie `router.push("/search")`, czyszczenie localStorage

**Modyfikacje:**
- `src/app/layout.tsx` — warunkowy render Sidebar (tylko gdy zalogowany, czytanie cookies server-side)
- `src/app/settings/page.tsx` — zamiast formularza credentials: wyświetlanie loginu + przycisk "Wyloguj"

## Faza 3 — Schema DB + migracja

**`prisma/schema.prisma`:**
- Dodać `dfsLogin String @default("")` do 7 modeli: `Business`, `ReviewTask`, `BusinessInfoTask`, `BusinessNameHistory`, `BusinessDataHistory`, `MapsSearchTask`, `MapsSearchResult`
- `Business`: zmiana `cid @unique` → `@@unique([cid, dfsLogin])` (dwóch userów może śledzić tę samą firmę)
- `MapsSearchResult`: zmiana relacji z `businessCid` (broken po zmianie unique) → `businessId String?` referencing `Business.id`
- `Review` — BEZ zmian (izolacja przez `Business.id` → `dfsLogin`)
- Migracja: `npx prisma migrate dev --name add_dfslogin_user_isolation`
- Backfill: istniejące rekordy zostaną przypisane do loginu użytkownika (SQL UPDATE w migracji — zapytam o login przed uruchomieniem)

## Faza 4 — Aktualizacja wszystkich API routes (16 routes)

Wzorzec dla każdego route:
1. Usunąć `credentials` z destructuring body
2. `const { dfsLogin, credentials } = await requireSession()` na początku
3. Dodać `dfsLogin` do WHERE w każdym query Prisma
4. `Business.findUnique({ where: { cid } })` → `findUnique({ where: { cid_dfsLogin: { cid, dfsLogin } } })`
5. `*.create({ data: { ..., dfsLogin } })` dla nowych rekordów

**Routes do zmiany:**
- `/api/reviews/route.ts`, `/api/reviews/status/route.ts`, `/api/reviews/pending/route.ts`
- `/api/reviews/batch/route.ts`, `/api/reviews/batch/status/route.ts`, `/api/reviews/by-task/[taskId]/route.ts`
- `/api/business-info/route.ts`, `/api/business-info/task/status/route.ts`, `/api/business-info/pending/route.ts`, `/api/business-info/history/route.ts`
- `/api/business/[cid]/route.ts`
- `/api/search/route.ts`, `/api/search/status/route.ts`, `/api/search/history/route.ts`
- `/api/history/route.ts`, `/api/costs/route.ts`, `/api/export/route.ts`

Routes BEZ zmian dfsLogin (shared reference data, ale credentials z sesji):
- `/api/locations/route.ts`, `/api/locations/refresh/route.ts`, `/api/serp-locations/route.ts`, `/api/extract-cid/route.ts`

## Faza 5 — Frontend: usunięcie credentials z fetch calls

Usunąć pattern `localStorage.getItem("dfs_credentials")` + `credentials` w body ze stron:
- `src/app/search/page.tsx`
- `src/app/reviews/page.tsx`
- `src/app/reviews/history/page.tsx`
- `src/components/SearchResults.tsx`
- `src/app/settings/page.tsx`

## Faza 6 — Security headers

**`next.config.ts`:** dodać headers `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`

---

## Weryfikacja

1. `npm run build` — brak błędów TypeScript
2. Ręczne testy:
   - Bez sesji: każda strona redirectuje na `/login`, API zwraca 401
   - Login z poprawnymi credentials DFS → sukces, redirect na `/search`
   - Login z błędnymi credentials → komunikat błędu
   - Wyszukiwanie, pobieranie recenzji, eksport — działa normalnie
   - `/api/costs` — pokazuje koszty tylko zalogowanego usera
   - `/api/history` — tylko firmy zalogowanego usera
3. `npx prisma studio` — sprawdzić czy nowe rekordy mają `dfsLogin` ustawiony
