# Vue 3 + Nuxt 3 Migration Checklist

> Parallel rewrite — nowy projekt Vue obok istniejącego Next.js.
> Wspólna baza PostgreSQL + ten sam Prisma schema.

## 0. Setup projektu

- [ ] Inicjalizacja Nuxt 3 (`nuxi init search-ops-toolkit-vue`)
- [ ] Konfiguracja Tailwind CSS (bez zmian w klasach)
- [ ] Prisma — shared schema (symlink lub kopia z tego samego repo)
- [ ] Pinia (state management)
- [ ] Docker — nowy serwis w `docker-compose.yml` (ten sam DB)
- [ ] `.env` — `DATABASE_URL` identyczny jak w Next.js
- [ ] Nuxt DevTools

## 1. Lib — logika biznesowa (copy & adapt)

Pliki `src/lib/` to czysty TypeScript — większość kopiujemy 1:1.

- [ ] `lib/db.ts` — Prisma singleton (Nuxt plugin)
- [ ] `lib/dfs/client.ts` — DFS API client (bez zmian)
- [ ] `lib/dfs/reviews.ts` — reviews API (bez zmian)
- [ ] `lib/dfs/maps-search.ts` — maps search API (bez zmian)
- [ ] `lib/dfs/business-info.ts` — business info API (bez zmian)
- [ ] `lib/dfs/locations.ts` — locations API (bez zmian)
- [ ] `lib/dfs/index.ts` — re-export (bez zmian)
- [ ] `lib/dataforseo.ts` — backward compat re-export (bez zmian)
- [ ] `lib/validation.ts` — zod schemas (bez zmian)
- [ ] `lib/session.ts` — zastąpić iron-session → Nuxt sessions (`h3` cookies / `nuxt-session`)
- [ ] `lib/cid-extractor.ts` — (bez zmian)
- [ ] `lib/export.ts` — CSV/XLSX generators (bez zmian)
- [ ] `lib/pingback.ts` — postback helpers (bez zmian)
- [ ] `lib/task-processors.ts` — shared task processing (bez zmian)
- [ ] `lib/task-events.ts` — EventEmitter SSE (bez zmian)
- [ ] `lib/task-retry.ts` — retry logic (bez zmian)
- [ ] `lib/locations-cache.ts` — (bez zmian)

## 2. Server routes (API) — Next.js route.ts → Nuxt server/api/

Logika zostaje, zmienia się wrapper (NextResponse → H3 event handler).

### Auth
- [ ] `server/api/auth/login.post.ts` ← `api/auth/login/route.ts`
- [ ] `server/api/auth/logout.post.ts` ← `api/auth/logout/route.ts`
- [ ] `server/api/auth/me.get.ts` ← `api/auth/me/route.ts`

### Search
- [ ] `server/api/search/index.post.ts` ← `api/search/route.ts`
- [ ] `server/api/search/status.get.ts` ← `api/search/status/route.ts`
- [ ] `server/api/search/results.get.ts` ← `api/search/results/route.ts`
- [ ] `server/api/search/history.get.ts` ← `api/search/history/route.ts`
- [ ] `server/api/search/export.get.ts` ← `api/search/export/route.ts`
- [ ] `server/api/search/webhook.post.ts` ← `api/search/webhook/route.ts`

### Reviews
- [ ] `server/api/reviews/index.post.ts` ← `api/reviews/route.ts`
- [ ] `server/api/reviews/status.get.ts` ← `api/reviews/status/route.ts`
- [ ] `server/api/reviews/pending.get.ts` ← `api/reviews/pending/route.ts`
- [ ] `server/api/reviews/history.get.ts` ← `api/reviews/history/route.ts`
- [ ] `server/api/reviews/export.get.ts` ← `api/reviews/export/route.ts`
- [ ] `server/api/reviews/webhook.post.ts` ← `api/reviews/webhook/route.ts`
- [ ] `server/api/reviews/by-task/[taskId].get.ts` ← `api/reviews/by-task/[taskId]/route.ts`
- [ ] `server/api/reviews/batch/index.post.ts` ← `api/reviews/batch/route.ts`
- [ ] `server/api/reviews/batch/status.get.ts` ← `api/reviews/batch/status/route.ts`

### Business
- [ ] `server/api/business/[cid].get.ts` ← `api/business/[cid]/route.ts`
- [ ] `server/api/business/create-from-search.post.ts` ← `api/business/create-from-search/route.ts`
- [ ] `server/api/businesses/index.get.ts` ← `api/businesses/route.ts`

### Business Info
- [ ] `server/api/business-info/index.post.ts` ← `api/business-info/route.ts`
- [ ] `server/api/business-info/task/status.get.ts` ← `api/business-info/task/status/route.ts`
- [ ] `server/api/business-info/pending.get.ts` ← `api/business-info/pending/route.ts`
- [ ] `server/api/business-info/history.get.ts` ← `api/business-info/history/route.ts`

### Callback & SSE
- [ ] `server/api/callback/postback.post.ts` ← `api/callback/postback/route.ts`
- [ ] `server/api/tasks/stream.get.ts` ← `api/tasks/stream/route.ts` (SSE)
- [ ] `server/api/tasks/index.get.ts` ← `api/tasks/route.ts`
- [ ] `server/api/tasks/retry.post.ts` ← `api/tasks/retry/route.ts`
- [ ] `server/api/tasks/retry-all.post.ts` ← `api/tasks/retry-all/route.ts`

### Inne
- [ ] `server/api/locations/index.get.ts` ← `api/locations/route.ts`
- [ ] `server/api/locations/refresh.post.ts` ← `api/locations/refresh/route.ts`
- [ ] `server/api/serp-locations.get.ts` ← `api/serp-locations/route.ts`
- [ ] `server/api/costs.get.ts` ← `api/costs/route.ts`
- [ ] `server/api/export.get.ts` ← `api/export/route.ts`
- [ ] `server/api/extract-cid.post.ts` ← `api/extract-cid/route.ts`
- [ ] `server/api/share.patch.ts` ← `api/share/route.ts`
- [ ] `server/api/shared.get.ts` ← `api/shared/route.ts`
- [ ] `server/api/history.get.ts` ← `api/history/route.ts`

## 3. Middleware

- [ ] `server/middleware/auth.ts` — sesja check (zamiennik `middleware.ts` z Next.js)
- [ ] IP allowlist dla postback (przeniesienie logiki z `pingback.ts`)

## 4. Composables (Vue) ← Hooks (React)

React hooks → Vue composables. Przepisanie logiki, nie kopiowanie.

- [ ] `composables/useLocationData.ts` ← `hooks/useLocationData.ts`
- [ ] `composables/useSearchPolling.ts` ← `hooks/useSearchPolling.ts`
- [ ] `composables/useReviewsPolling.ts` ← `hooks/useReviewsPolling.ts`
- [ ] `composables/useBusinessInfoPolling.ts` ← `hooks/useBusinessInfoPolling.ts`
- [ ] `composables/useBatchReviews.ts` ← `hooks/useBatchReviews.ts`
- [ ] `composables/useTaskStream.ts` ← `hooks/useTaskStream.ts` (SSE EventSource)

## 5. Strony (pages/) ← app/ (Next.js)

Każda strona to nowy komponent Vue `<script setup>` + `<template>`.

- [ ] `pages/index.vue` ← `app/page.tsx` (landing / redirect)
- [ ] `pages/login.vue` ← `app/login/page.tsx`
- [ ] `pages/search/index.vue` ← `app/search/page.tsx`
- [ ] `pages/search/history.vue` ← `app/search/history/page.tsx`
- [ ] `pages/reviews/index.vue` ← `app/reviews/page.tsx`
- [ ] `pages/reviews/history.vue` ← `app/reviews/history/page.tsx`
- [ ] `pages/reviews/task/[taskId].vue` ← `app/reviews/task/[taskId]/page.tsx`
- [ ] `pages/business/[cid].vue` ← `app/business/[cid]/page.tsx`
- [ ] `pages/businesses.vue` ← `app/businesses/page.tsx`
- [ ] `pages/settings.vue` ← `app/settings/page.tsx`
- [ ] `pages/shared.vue` ← `app/shared/page.tsx`
- [ ] `pages/tasks.vue` ← `app/tasks/page.tsx`
- [ ] `pages/history.vue` ← `app/history/page.tsx`

## 6. Komponenty

- [ ] `components/Sidebar.vue` ← `Sidebar.tsx`
- [ ] `components/SearchForm.vue` ← `SearchForm.tsx`
- [ ] `components/SearchResults.vue` ← `SearchResults.tsx`
- [ ] `components/BusinessCard.vue` ← `BusinessCard.tsx`
- [ ] `components/BusinessDetailCard.vue` ← `BusinessDetailCard.tsx`
- [ ] `components/BusinessesList.vue` ← `BusinessesList.tsx`
- [ ] `components/ReviewsTable.vue` ← `ReviewsTable.tsx`
- [ ] `components/ReviewTasksTable.vue` ← `ReviewTasksTable.tsx`
- [ ] `components/InfoTasksTable.vue` ← `InfoTasksTable.tsx`
- [ ] `components/ExportButtons.vue` ← `ExportButtons.tsx`
- [ ] `components/SearchExportBar.vue` ← `SearchExportBar.tsx`
- [ ] `components/ReviewExportBar.vue` ← `ReviewExportBar.tsx`
- [ ] `components/ApiSettings.vue` ← `ApiSettings.tsx`
- [ ] `components/CostsSummary.vue` ← `CostsSummary.tsx`
- [ ] `components/ShareButton.vue` ← `ShareButton.tsx`

## 7. Layout

- [ ] `layouts/default.vue` — Sidebar + main content area (flex)
- [ ] `layouts/auth.vue` — layout bez sidebara (login page)

## 8. Pinia Stores

Nowe — nie mają odpowiednika w React (tam useState w komponentach).

- [ ] `stores/auth.ts` — stan sesji, login/logout
- [ ] `stores/search.ts` — wyniki wyszukiwania, aktywne taski
- [ ] `stores/reviews.ts` — review taski, polling state
- [ ] `stores/settings.ts` — webhook URL, preferencje lokalizacji

## 9. Infrastruktura & Deploy

- [ ] Nowy `Dockerfile` (Nuxt build)
- [ ] Aktualizacja `docker-compose.yml` — drugi serwis app (ten sam DB)
- [ ] Caddy config — nowa domena (np. `vue.sot.nimblio.work`)
- [ ] Współdzielenie `prisma/schema.prisma` (symlink lub workspace)
- [ ] Migracje — odpala tylko jeden serwis (Next.js LUB Nuxt, nie oba)

## 10. Testy & QA

- [ ] Vitest setup (unit testy dla composables i lib)
- [ ] Test każdego API route (ręcznie lub Playwright)
- [ ] Porównanie feature parity z wersją Next.js
- [ ] Test multi-user isolation (dfsLogin filtering)
- [ ] Test SSE (postback → real-time notifications)
- [ ] Test eksportu CSV/XLSX

---

## Kolejność migracji (rekomendowana)

1. **Setup** — projekt Nuxt, Prisma, Tailwind, Pinia
2. **Auth** — login/logout/session (fundament)
3. **Layout** — Sidebar + routing
4. **Search** — SearchForm + SearchResults + polling (core feature)
5. **Reviews** — fetch + polling + batch
6. **Business** — detail page + business list
7. **History & Export** — tabele historii, CSV/XLSX
8. **Shared & Tasks** — sharing, admin dashboard
9. **Settings** — API config, webhook
10. **SSE & Postback** — real-time notifications
11. **Polish** — error handling, loading states, edge cases

## Kluczowe różnice API

| Next.js | Nuxt 3 |
|---|---|
| `NextResponse.json({}, { status })` | `return { data }` lub `throw createError({ statusCode })` |
| `export async function GET(req)` | `export default defineEventHandler(async (event) => {})` |
| `req.nextUrl.searchParams` | `getQuery(event)` |
| `await req.json()` | `await readBody(event)` |
| `cookies().get()` | `getCookie(event, name)` |
| `middleware.ts` (edge) | `server/middleware/` (server) |
| `useRouter()` (next/navigation) | `useRouter()` (vue-router, auto-imported) |
| `useState + useEffect` | `ref() + watch()` lub `useFetch()` |
| `useCallback` | `computed()` lub zwykła funkcja (nie potrzeba) |
