# Lookup Tables

Standalone tables cached from DataForSEO API. No relations to other tables.

## DfsLocation

DataForSEO location lookup (countries).

| Column | Type | Description |
|--------|------|-------------|
| id | Int | location_code (PK) |
| name | String | Location name |
| countryCode | String | ISO country code |
| locationType | String | Location type |

## DfsLanguage

DataForSEO language lookup.

| Column | Type | Description |
|--------|------|-------------|
| code | String | language_code (PK) |
| name | String | Language name |

## DfsSerpLocation

SERP locations (cities/regions per country). Loaded dynamically when user changes country via `/api/serp-locations`.

| Column | Type | Description |
|--------|------|-------------|
| id | Int | location_code (PK) |
| name | String | Location name |
| countryCode | String | ISO country code |
| locationType | String | Country, Region, City, etc. |

**Index:** `countryCode`
