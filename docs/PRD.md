# PRD: Search Ops Toolkit

## Cel
Aplikacja webowa (self-hosted) dla agencji do pobierania, przechowywania i eksportowania opinii z wizytówek Google Maps. Użytkownik podaje swoje dane API DataForSEO, wkleja URL wizytówki, a aplikacja automatycznie wyciąga CID, pobiera dane i umożliwia eksport.

## Problem
Ręczne zbieranie opinii z Google Maps jest czasochłonne. Agencje potrzebują narzędzia do szybkiego pobierania i analizowania recenzji klientów.

## Użytkownicy
- Pracownicy agencji SEO/marketingowych
- Self-hosted — każdy podaje swoje credentials DataForSEO
- Brak systemu kont — credentials przechowywane w przeglądarce (localStorage)

## Stack technologiczny
- Next.js 14+ (App Router) + TypeScript
- Tailwind CSS
- PostgreSQL (w Docker) + Prisma ORM
- DataForSEO API (credentials podawane przez użytkownika)
- SheetJS (xlsx) — eksport Excel

## Flow użytkownika
1. Pierwsze wejście → formularz DataForSEO login/password (zapisane w localStorage)
2. Wklejenie URL Google Maps
3. Ekstrakcja CID z URL-a
4. Sprawdzenie cache w DB → jeśli istnieje, pokaż z opcją odświeżenia
5. Pobranie z DataForSEO API → zapis do DB
6. Wyświetlenie w tabeli + eksport CSV/Excel

## Ekstrakcja CID
- Parametr `ludocid` z URL
- Fragment hex z `data=` w URL
- Fallback: DataForSEO business_listings_search

## Schemat bazy danych

### Business
| Pole | Typ | Opis |
|------|-----|------|
| id | cuid | PK |
| cid | string (unique) | Google CID |
| name | string | Nazwa firmy |
| address | string? | Adres |
| phone | string? | Telefon |
| website | string? | Strona www |
| category | string? | Kategoria |
| rating | float? | Średnia ocena |
| totalReviews | int? | Liczba opinii |
| mapsUrl | string? | Oryginalny URL |
| createdAt | datetime | Data dodania |
| updatedAt | datetime | Ostatnia aktualizacja |

### Review
| Pole | Typ | Opis |
|------|-----|------|
| id | cuid | PK |
| businessId | string | FK → Business |
| authorName | string | Autor opinii |
| authorAvatar | string? | Avatar autora |
| rating | int | Ocena (1-5) |
| text | string? | Treść opinii |
| publishedAt | datetime? | Data publikacji |
| ownerResponse | string? | Odpowiedź właściciela |
| ownerRespondedAt | datetime? | Data odpowiedzi |
| **unique** | | (businessId, authorName, publishedAt) |

## Endpointy API

| Endpoint | Metoda | Opis |
|----------|--------|------|
| /api/extract-cid | POST | URL → CID |
| /api/business-info | POST | Pobranie info o firmie (cid + credentials) |
| /api/reviews | POST | Pobranie opinii (cid + credentials + offset) |
| /api/export | GET | Eksport CSV/XLSX (?cid=&format=) |

## Strony
- `/` — strona główna: ustawienia API + formularz URL + wyniki
- `/history` — lista wcześniej pobranych firm

## Eksport
- **CSV** — prosty plik tabelaryczny
- **Excel (.xlsx)** — z formatowaniem
- Kolumny: autor, ocena, data, tekst opinii, odpowiedź właściciela

## Infrastruktura
- PostgreSQL 16 w Docker (docker-compose.yml)
- App uruchamiana lokalnie (`npm run dev`)
- Docelowo: pełna konteneryzacja (Dockerfile + docker-compose)

## Przyszłe rozszerzenia (poza MVP)
- System kont użytkowników
- Pełna konteneryzacja app w Docker
- Automatyczne odświeżanie opinii (cron)
- Analiza sentymentu opinii
- Dashboard z wykresami
