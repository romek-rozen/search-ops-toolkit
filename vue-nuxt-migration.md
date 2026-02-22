# Migracja Search Ops Toolkit: Next.js 15 → Vue 3.5 + Nuxt 4.3

## Context
Aplikacja Search Ops Toolkit działa na Next.js 15 + React 19. Celem jest migracja na Vue 3.5.28 + Nuxt 4.3 z zachowaniem pełnej funkcjonalności. Migracja obejmuje 13 stron, 40 API routes, 15 komponentów, 6 hooków i 17 plików lib. Nuxt 5 jest w przygotowaniu — plan uwzględnia forward-compatibility.

## Inwentarz obecnego codebase
- **Strony**: 13 (wszystkie "use client" poza landing)
- **API routes**: 40 (auth, search, reviews, business-info, business, locations, utilities, admin tasks, callback)
- **Komponenty**: 15 (Sidebar, SearchForm, SearchResults, ReviewsTable, ReviewTasksTable, InfoTasksTable, BusinessCard, BusinessDetailCard, ExportButtons, SearchExportBar, ReviewExportBar, CostsSummary, ShareButton, ApiSettings, BusinessesList)
- **Hooki**: 6 (useLocationData, useSearchPolling, useReviewsPolling, useBusinessInfoPolling, useBatchReviews, useTaskStream)
- **Lib**: 17 plików (12 framework-agnostic, 5 wymaga przepisania)
- **Brak testów** (brak Jest/Vitest/Playwright)

---

## FAZA 0: Przygotowanie [LOW]

- [ ] Utworzyć branch `feat/nuxt-migration`
- [ ] Zrobić screenshoty każdej strony (referencja wizualna)
- [ ] Udokumentować wszystkie 40 API routes z metodami HTTP i expected responses
- [ ] Przetestować i udokumentować flow: polling + SSE end-to-end

---

## FAZA 1: Scaffolding projektu Nuxt [MEDIUM]

### 1.1 Inicjalizacja
- [ ] `npx nuxi@latest init` z TypeScript
- [ ] Struktura katalogów Nuxt 4:
  ```
  app/
    pages/         ← src/app/**/page.tsx
    components/    ← src/components/
    composables/   ← src/hooks/
    layouts/       ← src/app/layout.tsx
    assets/css/    ← src/app/globals.css
    middleware/    ← client-side route guards
  server/
    api/           ← src/app/api/**/route.ts
    middleware/    ← middleware.ts (root)
    utils/         ← src/lib/
  prisma/          ← bez zmian
  ```

### 1.2 `nuxt.config.ts`
- [ ] `nitro: { preset: 'node-server' }` (odpowiednik `output: "standalone"`)
- [ ] `css: ['~/assets/css/main.css']`
- [ ] `modules: ['@nuxtjs/tailwindcss']` lub ręczny `postcss.config.mjs`
- [ ] `runtimeConfig` zamiast `process.env` w komponentach:
  ```ts
  runtimeConfig: {
    sessionSecret: process.env.SESSION_SECRET,
    adminEmail: process.env.ADMIN_EMAIL,
    callbackBaseUrl: process.env.CALLBACK_BASE_URL,
    public: { adminEmail: process.env.ADMIN_EMAIL }
  }
  ```
- [ ] `app.head` — metadata (title, description, robots: noindex)
- [ ] Font Inter — `@nuxtjs/google-fonts` lub `@font-face` w CSS

### 1.3 Konfiguracja
- [ ] Przenieść `postcss.config.mjs` (bez zmian — Tailwind v4 kompatybilny)
- [ ] Przenieść `globals.css` → `app/assets/css/main.css` (treść bez zmian: `@theme`, `@layer base`, `@layer components`)
- [ ] ESLint: `@nuxt/eslint` zamiast `eslint-config-next`
- [ ] TypeScript: Nuxt auto-generuje tsconfig, alias `~/` zamiast `@/`

### 1.4 Weryfikacja
- [ ] `npx nuxi dev` startuje bez błędów
- [ ] Tailwind renderuje klasy poprawnie

---

## FAZA 2: Prisma + Server Utilities [LOW]

### 2.1 Prisma — bez zmian
- [ ] `prisma/schema.prisma` — skopiować, zmienić `output` na `../server/generated/prisma`
- [ ] `prisma/migrations/` — skopiować bez zmian
- [ ] `prisma.config.ts` — skopiować

### 2.2 Pliki do skopiowania (tylko zmiana importów)
12 plików framework-agnostic — przenieść do `server/utils/`:

| Obecny plik | Nowy plik | Zmiany |
|---|---|---|
| `src/lib/dfs/client.ts` | `server/utils/dfs/client.ts` | import paths |
| `src/lib/dfs/locations.ts` | `server/utils/dfs/locations.ts` | import paths |
| `src/lib/dfs/maps-search.ts` | `server/utils/dfs/maps-search.ts` | import paths |
| `src/lib/dfs/reviews.ts` | `server/utils/dfs/reviews.ts` | import paths |
| `src/lib/dfs/business-info.ts` | `server/utils/dfs/business-info.ts` | import paths |
| `src/lib/validation.ts` | `server/utils/validation.ts` | import paths |
| `src/lib/cid-extractor.ts` | `server/utils/cid-extractor.ts` | import paths |
| `src/lib/export.ts` | `server/utils/export.ts` | import paths |
| `src/lib/pingback.ts` | `server/utils/pingback.ts` | import paths |
| `src/lib/task-processors.ts` | `server/utils/task-processors.ts` | import paths |
| `src/lib/task-events.ts` | `server/utils/task-events.ts` | import paths |
| `src/lib/task-retry.ts` | `server/utils/task-retry.ts` | import paths |
| `src/lib/locations-cache.ts` | `server/utils/locations-cache.ts` | import paths |

### 2.3 `db.ts` → `server/utils/db.ts` — minor rewrite
- [ ] Zmienić import Prisma na nową ścieżkę output
- [ ] Pattern `globalThis` działa w Nitro bez zmian

### 2.4 `session.ts` → `server/utils/session.ts` — FULL REWRITE [MEDIUM]
- [ ] Zamienić `iron-session` na `nuxt-auth-utils` (h3 sealed cookies)
- [ ] `getSession()` → `useSession(event, config)` z h3
- [ ] `getSessionCredentials()` — ta sama logika, inny dostęp do sesji
- [ ] `isAdmin()`, `userWhere()`, `canAccess()` — pure functions, bez zmian

### 2.5 Weryfikacja
- [ ] Prisma generate działa
- [ ] Testowy API route czyta/pisze sesję poprawnie

---

## FAZA 3: Server Middleware [MEDIUM]

### 3.1 Auth middleware → `server/middleware/auth.ts` — FULL REWRITE
Obecny `middleware.ts` (root) → Nitro server middleware:
```ts
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  // Skip: /, /login, /api/auth/*, /api/callback/*
  // Brak sesji + API → throw createError({ statusCode: 401 })
  // Brak sesji + strona → sendRedirect(event, '/login')
});
```

### 3.2 Security headers → `server/middleware/security-headers.ts` — NEW
- [ ] Przenieść headery z `next.config.ts` `headers()`: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, X-XSS-Protection
- [ ] Użyć `setHeaders(event, {...})`

### 3.3 Weryfikacja
- [ ] `/api/search` bez sesji → 401
- [ ] `/login` dostępny bez sesji
- [ ] `/api/callback/postback` dostępny bez sesji
- [ ] Security headers obecne na wszystkich odpowiedziach

---

## FAZA 4: API Routes (40 routes) [HIGH]

### Wzorzec konwersji
| Next.js | Nitro |
|---|---|
| `export async function POST(req: NextRequest)` | `export default defineEventHandler(async (event) =>` |
| `req.json()` | `readBody(event)` |
| `req.nextUrl.searchParams` | `getQuery(event)` |
| `NextResponse.json({}, { status: 200 })` | `return {}` |
| `NextResponse.json({error}, { status: 400 })` | `throw createError({ statusCode: 400, message })` |
| `req.headers.get('x-forwarded-for')` | `getRequestHeader(event, 'x-forwarded-for')` |
| Eksport `GET`/`POST` w jednym pliku | Oddzielne pliki: `route.get.ts`, `route.post.ts` |
| `params.taskId` z folderu `[taskId]` | `getRouterParam(event, 'taskId')` |

### 4.1 Auth (3 routes)
- [ ] `api/auth/me` → `server/api/auth/me.get.ts` — FULL (session read)
- [ ] `api/auth/login` → `server/api/auth/login.post.ts` — FULL (session create)
- [ ] `api/auth/logout` → `server/api/auth/logout.post.ts` — FULL (session destroy)

### 4.2 Search (6 routes)
- [ ] `api/search` → `server/api/search/index.post.ts`
- [ ] `api/search/status` → `server/api/search/status.post.ts`
- [ ] `api/search/history` → `server/api/search/history.post.ts` + `.delete.ts`
- [ ] `api/search/results` → `server/api/search/results.get.ts`
- [ ] `api/search/webhook` → `server/api/search/webhook.post.ts`
- [ ] `api/search/export` → `server/api/search/export.get.ts`

### 4.3 Reviews (9 routes)
- [ ] `api/reviews` → `server/api/reviews/index.post.ts`
- [ ] `api/reviews/status` → `server/api/reviews/status.post.ts`
- [ ] `api/reviews/batch` → `server/api/reviews/batch.post.ts`
- [ ] `api/reviews/batch/status` → `server/api/reviews/batch/status.post.ts`
- [ ] `api/reviews/history` → `server/api/reviews/history.post.ts` + `.delete.ts`
- [ ] `api/reviews/by-task/[taskId]` → `server/api/reviews/by-task/[taskId].get.ts`
- [ ] `api/reviews/pending` → `server/api/reviews/pending.get.ts`
- [ ] `api/reviews/export` → `server/api/reviews/export.get.ts`
- [ ] `api/reviews/webhook` → `server/api/reviews/webhook.post.ts`

### 4.4 Business Info (4 routes)
- [ ] `api/business-info` → `server/api/business-info/index.post.ts`
- [ ] `api/business-info/task/status` → `server/api/business-info/task/status.post.ts`
- [ ] `api/business-info/history` → `server/api/business-info/history.post.ts`
- [ ] `api/business-info/pending` → `server/api/business-info/pending.get.ts`

### 4.5 Business (2 routes)
- [ ] `api/business/[cid]` → `server/api/business/[cid].get.ts`
- [ ] `api/business/create-from-search` → `server/api/business/create-from-search.post.ts`

### 4.6 Locations (3 routes)
- [ ] `api/locations` → `server/api/locations/index.get.ts`
- [ ] `api/locations/refresh` → `server/api/locations/refresh.post.ts`
- [ ] `api/serp-locations` → `server/api/serp-locations.get.ts`

### 4.7 Utilities (5 routes)
- [ ] `api/businesses` → `server/api/businesses.get.ts`
- [ ] `api/costs` → `server/api/costs.get.ts`
- [ ] `api/extract-cid` → `server/api/extract-cid.post.ts`
- [ ] `api/share` → `server/api/share.patch.ts`
- [ ] `api/shared` → `server/api/shared.get.ts`

### 4.8 Admin Tasks (4 routes)
- [ ] `api/tasks` → `server/api/tasks/index.get.ts`
- [ ] `api/tasks/retry` → `server/api/tasks/retry.post.ts`
- [ ] `api/tasks/retry-all` → `server/api/tasks/retry-all.post.ts`
- [ ] `api/tasks/stream` → `server/api/tasks/stream.get.ts` — **SSE, HIGH** (użyć `createEventStream()` z h3 v2)

### 4.9 Callback (1 route) — HIGH
- [ ] `api/callback/postback` → `server/api/callback/postback.post.ts`
  - `readRawBody(event)` zamiast `req.arrayBuffer()`
  - `gunzipSync` z `zlib` — bez zmian
  - IP allowlist + rate limiting — bez zmian (in-memory, single-process)

### 4.10 Export routes — response headers
```ts
setResponseHeaders(event, {
  'Content-Type': 'text/csv; charset=utf-8',
  'Content-Disposition': 'attachment; filename="export.csv"',
});
return csvContent;
```

### 4.11 Weryfikacja (po każdej grupie)
- [ ] Auth: login → check session → logout
- [ ] Search: create task → poll → get results → export
- [ ] Reviews: create → poll → get → export
- [ ] SSE: connect stream → trigger postback → verify event
- [ ] Postback: simulate DFS callback z gzip payload

---

## FAZA 5: Layout + app.vue [MEDIUM]

### 5.1 `app/app.vue`
```vue
<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
```

### 5.2 `app/layouts/default.vue`
- [ ] Przenieść strukturę z `src/app/layout.tsx`: `<Sidebar />` + `<main><slot /></main>`
- [ ] Font Inter — `@nuxtjs/google-fonts` lub manual

### 5.3 SEO metadata → `nuxt.config.ts` `app.head`

### 5.4 Opcjonalnie: client-side route middleware `app/middleware/auth.global.ts`
- [ ] Sprawdzanie auth przed nawigacją (zapobiega flash protected content)

### 5.5 Weryfikacja
- [ ] Sidebar widoczny na chronionych stronach, ukryty na `/login`
- [ ] Font ładuje się poprawnie
- [ ] Nawigacja między stronami działa

---

## FAZA 6: Hooki → Composables (6) [HIGH]

### Wzorzec konwersji
| React | Vue 3 Composition API |
|---|---|
| `useState(val)` | `ref(val)` |
| `useEffect(() => {}, [deps])` | `onMounted()` / `watch()` / `watchEffect()` |
| `useCallback(fn, [deps])` | zwykła funkcja (niepotrzebna memoizacja) |
| `useRef(val)` (mutable, non-reactive) | `let` variable (plain JS) |
| `useRef(null)` (DOM ref) | `useTemplateRef()` lub `ref()` |
| cleanup w `useEffect` return | `onUnmounted()` |

### 6.1 Composables do przepisania
- [ ] `useLocationData` → `app/composables/useLocationData.ts` — **HIGH** (localStorage, API fetch, watch na country change)
- [ ] `useSearchPolling` → `app/composables/useSearchPolling.ts` — **HIGH** (setInterval + SSE integration)
- [ ] `useReviewsPolling` → `app/composables/useReviewsPolling.ts` — **HIGH** (polling + SSE)
- [ ] `useBusinessInfoPolling` → `app/composables/useBusinessInfoPolling.ts` — **HIGH** (polling + SSE)
- [ ] `useBatchReviews` → `app/composables/useBatchReviews.ts` — **MEDIUM** (batch status tracking)
- [ ] `useTaskStream` → `app/composables/useTaskStream.ts` — **MEDIUM** (EventSource wrapper)

### 6.2 Kluczowe różnice
- Timer ID (`setInterval`) → plain `let` variable, cleanup w `onUnmounted()`
- `useCallback` z deps → niepotrzebny, zwykła funkcja
- SSE: `watch()` na reactive `taskIds` ref zamiast `useEffect` z dependency array
- `$fetch` (ofetch) zamiast `fetch()` dla API calls (auto base URL, lepsze error handling)

### 6.3 Weryfikacja
- [ ] useLocationData: zmiana kraju → fetch SERP locations, localStorage persists
- [ ] useSearchPolling: submit search → polling działa → SSE przerywa polling
- [ ] useTaskStream: connect → events arrive → cleanup on unmount

---

## FAZA 7: Komponenty (15) [HIGH]

### Wzorzec konwersji JSX → Vue SFC
| React JSX | Vue Template |
|---|---|
| `className=` | `class=` |
| `{condition && <div>}` | `<div v-if="condition">` |
| `{items.map(i => <X key={i.id} />)}` | `<X v-for="i in items" :key="i.id" />` |
| `onChange={e => set(e.target.value)}` | `v-model="value"` |
| `onClick={() => fn()}` | `@click="fn()"` |
| `<Link href="/path">` | `<NuxtLink to="/path">` |
| `{loading ? <A/> : <B/>}` | `<A v-if="loading" /><B v-else />` |
| `style={{ color: x }}` | `:style="{ color: x }"` |
| `dangerouslySetInnerHTML` | `v-html` |

### 7.1 Komponenty do przepisania
- [ ] `Sidebar.tsx` → `Sidebar.vue` — **MEDIUM** (`usePathname` → `useRoute().path`, SVG icons)
- [ ] `SearchForm.tsx` → `SearchForm.vue` — **HIGH** (dropdowny z useRef → template refs + state, click-outside)
- [ ] `SearchResults.tsx` → `SearchResults.vue` — **HIGH** (tabela z checkboxami, batch toolbar)
- [ ] `ReviewsTable.tsx` → `ReviewsTable.vue` — **MEDIUM**
- [ ] `ReviewTasksTable.tsx` → `ReviewTasksTable.vue` — **MEDIUM**
- [ ] `InfoTasksTable.tsx` → `InfoTasksTable.vue` — **MEDIUM**
- [ ] `BusinessCard.tsx` → `BusinessCard.vue` — **LOW**
- [ ] `BusinessDetailCard.tsx` → `BusinessDetailCard.vue` — **MEDIUM**
- [ ] `SearchExportBar.tsx` → `SearchExportBar.vue` — **LOW**
- [ ] `ReviewExportBar.tsx` → `ReviewExportBar.vue` — **LOW**
- [ ] `ExportButtons.tsx` → `ExportButtons.vue` — **LOW**
- [ ] `CostsSummary.tsx` → `CostsSummary.vue` — **LOW**
- [ ] `ShareButton.tsx` → `ShareButton.vue` — **LOW**
- [ ] `ApiSettings.tsx` → `ApiSettings.vue` — **LOW**

### 7.2 Specyficzne wyzwania
- **SearchForm**: `useRef` dla dropdown click-outside → VueUse `onClickOutside` lub manual `addEventListener`
- **Sidebar**: inline SVG ikony — identyczny markup, usunąć JSX expression wrappers
- **SearchResults**: controlled checkboxes z `onChange` → `v-model` z `v-for`

### 7.3 Weryfikacja
- [ ] Porównanie wizualne z screenshotami z Fazy 0

---

## FAZA 8: Strony (13) [HIGH]

### Wzorzec konwersji stron
```vue
<!-- Nuxt page -->
<script setup lang="ts">
const route = useRoute();
const taskId = computed(() => route.query.taskId as string);
// useState → ref(), useEffect → onMounted/watch, useCallback → plain function
</script>
<template>
  <!-- JSX → Vue template -->
</template>
```

### 8.1 Strony do przepisania
- [ ] `/` (landing + redirect) → `app/pages/index.vue` — **LOW** (`navigateTo('/search')`)
- [ ] `/login` → `app/pages/login.vue` — **MEDIUM** (formularz, `$fetch`)
- [ ] `/search` → `app/pages/search/index.vue` — **HIGH** (3 composables, complex state)
- [ ] `/search/history` → `app/pages/search/history.vue` — **MEDIUM** (tabela, sortowanie)
- [ ] `/businesses` → `app/pages/businesses.vue` — **MEDIUM** (lista, search, sort)
- [ ] `/reviews` → `app/pages/reviews/index.vue` — **HIGH** (polling, URL prefill, autocomplete)
- [ ] `/reviews/history` → `app/pages/reviews/history.vue` — **MEDIUM**
- [ ] `/reviews/task/[taskId]` → `app/pages/reviews/task/[taskId].vue` — **MEDIUM**
- [ ] `/settings` → `app/pages/settings.vue` — **LOW**
- [ ] `/shared` → `app/pages/shared.vue` — **MEDIUM** (filtry, 2 tabele)
- [ ] `/tasks` → `app/pages/tasks.vue` — **MEDIUM** (admin, auto-polling)
- [ ] `/business/[cid]` → `app/pages/business/[cid].vue` — **HIGH** (multiple data sources, SSE)

### 8.2 Kluczowe różnice
- `useSearchParams()` → `useRoute().query`
- `useParams()` → `useRoute().params`
- `usePathname()` → `useRoute().path`
- `router.push()` → `navigateTo()` lub `useRouter().push()`
- `<Suspense>` z React → `<Suspense>` z Vue (albo v-if na loading state)
- API calls: `fetch('/api/...')` → `$fetch('/api/...')`

### 8.3 Weryfikacja (per strona)
- [ ] Formularze submitują poprawnie
- [ ] Dane ładują się z API
- [ ] Polling działa
- [ ] Nawigacja między stronami
- [ ] URL params czytane poprawnie
- [ ] localStorage persistence działa

---

## FAZA 9: Docker + Deploy [MEDIUM]

### 9.1 Dockerfile — FULL REWRITE
- [ ] Build stage: `npm run build` produkuje `.output/` (nie `.next/`)
- [ ] Production stage: `COPY --from=builder /app/.output ./.output`
- [ ] Prisma dla migracji: skopiować `prisma/` + zainstalować `prisma` CLI

### 9.2 `docker-entrypoint.sh` — minor change
```sh
#!/bin/sh
set -e
npx prisma migrate deploy
exec node .output/server/index.mjs  # ← zmiana z server.js
```

### 9.3 `docker-compose.yml`
- [ ] Usunąć `NEXT_PUBLIC_ADMIN_EMAIL` (Nuxt: `runtimeConfig.public`)
- [ ] PORT, DATABASE_URL, SESSION_SECRET — bez zmian
- [ ] Network config — bez zmian

### 9.4 Caddy config
- [ ] Bez zmian jeśli port zostaje ten sam

### 9.5 Weryfikacja
- [ ] `docker-compose up --build` — app startuje
- [ ] Migracje przechodzą
- [ ] Wszystkie strony ładują się przez Caddy

---

## FAZA 10: Cleanup + Finalna weryfikacja [LOW]

### 10.1 Usunięcie remnantów Next.js
- [ ] Usunąć: `next.config.ts`, `next-env.d.ts`, `middleware.ts` (root), `src/` (cały)
- [ ] Usunąć z package.json: `react`, `react-dom`, `next`, `@types/react`, `@types/react-dom`, `eslint-config-next`, `iron-session`
- [ ] Usunąć `.next/`

### 10.2 Pełny walkthrough aplikacji
- [ ] Login z DFS credentials
- [ ] Search (live, standard, priority)
- [ ] Historia wyszukiwań → klik w wynik
- [ ] Business detail → fetch business info
- [ ] Fetch reviews (single + batch)
- [ ] Historia reviews → per-task reviews
- [ ] Export CSV + XLSX (search + reviews)
- [ ] Webhook send
- [ ] Settings (location refresh, costs)
- [ ] Share/unshare tasks → strona /shared
- [ ] Admin: all tasks → retry
- [ ] SSE notifications (trigger postback)
- [ ] Logout

### 10.3 Aktualizacja dokumentacji
- [ ] CLAUDE.md — nowe ścieżki, komendy, konwencje
- [ ] README.md — instrukcje instalacji/deploy

---

## Podsumowanie złożoności

| Faza | Opis | Złożoność |
|---|---|---|
| 0 | Przygotowanie | LOW |
| 1 | Scaffolding Nuxt | MEDIUM |
| 2 | Prisma + server utils | LOW |
| 3 | Server middleware | MEDIUM |
| 4 | API routes (40) | HIGH |
| 5 | Layout + app.vue | MEDIUM |
| 6 | Hooki → composables (6) | HIGH |
| 7 | Komponenty (15) | HIGH |
| 8 | Strony (13) | HIGH |
| 9 | Docker + deploy | MEDIUM |
| 10 | Cleanup + weryfikacja | LOW |

## Pliki reużywalne (copy + zmiana importów): 12/17 lib files
Pełny rewrite wymagany: `session.ts`, `middleware.ts`, `db.ts` (minor)

## Forward-compatibility z Nuxt 5
- Używać `app/` directory (standard Nuxt 4+)
- `defineEventHandler` (nie deprecated `eventHandler`)
- h3 v2 utilities: `readBody`, `getQuery`, `createEventStream`
- `useRuntimeConfig()` zamiast `process.env` w komponentach
- `nuxt-auth-utils` dla sesji (maintained by Nuxt team)
- `$fetch` zamiast `useFetch` dla client-only API calls (app jest głównie CSR)

## Zależności do wymiany

| Obecna | Nowa | Powód |
|---|---|---|
| `next` | `nuxt` | framework |
| `react` + `react-dom` | `vue` (auto z Nuxt) | UI library |
| `iron-session` | `nuxt-auth-utils` | session management |
| `eslint-config-next` | `@nuxt/eslint` | linting |
| `@types/react` + `@types/react-dom` | usunąć | niepotrzebne |

Zachować bez zmian: `@prisma/client`, `@prisma/adapter-pg`, `pg`, `zod`, `xlsx`, `@tailwindcss/postcss`, `tailwindcss`, `postcss`, `typescript`, `prisma`
