# Business Info Task

## BusinessInfoTask

Async task for fetching detailed business info from DataForSEO.

| Column | Type | Description |
|--------|------|-------------|
| id | String (cuid) | Primary key |
| dfsTaskId | String | DataForSEO task ID (unique) |
| businessId | String | FK → Business |
| status | String | `pending` → `ready` → `completed` / `failed` |
| cost | Float? | API cost in USD |
| timeSec | String? | Processing time |
| locationName | String? | Search location |
| languageCode | String? | Language code |
| dfsStatusCode | Int? | DataForSEO status code |
| dfsResponse | Json? | Raw API response |
| error | String? | Error message |
| dfsLogin | String? | Owner (DataForSEO login) |
| createdAt | DateTime | Created timestamp |
| updatedAt | DateTime | Last updated |
