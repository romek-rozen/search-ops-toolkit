# Business Tables

## Business

Main entity — a Google Maps business listing. Created automatically from `MapsSearchResult` data when user clicks "Details".

| Column | Type | Description |
|--------|------|-------------|
| id | String (cuid) | Primary key |
| cid | String | Google Maps CID (unique) |
| name | String | Business name |
| address | String? | Full address |
| city | String? | City |
| country | String? | Country |
| phone | String? | Phone number |
| website | String? | Website URL |
| category | String? | Primary category |
| rating | Float? | Average rating |
| totalReviews | Int? | Total review count |
| mapsUrl | String? | Google Maps URL |
| dfsLogin | String? | Owner (DataForSEO login) |
| createdAt | DateTime | Created timestamp |
| updatedAt | DateTime | Last updated |

### Relations
- `reviews` → Review[] (1:N)
- `tasks` → ReviewTask[] (1:N)
- `businessInfoTasks` → BusinessInfoTask[] (1:N)
- `nameHistory` → BusinessNameHistory[] (1:N)
- `dataHistory` → BusinessDataHistory[] (1:N)
- `mapsSearchResults` → MapsSearchResult[] (1:N)

## BusinessNameHistory

Tracks business name changes over time.

| Column | Type | Description |
|--------|------|-------------|
| id | String (cuid) | Primary key |
| businessId | String | FK → Business |
| name | String | Business name at that point |
| source | String | `live`, `task_get`, `manual` |
| recordedAt | DateTime | When recorded |

## BusinessDataHistory

Snapshots of business data over time. A new record is created each time business info is fetched.

| Column | Type | Description |
|--------|------|-------------|
| id | String (cuid) | Primary key |
| businessId | String | FK → Business |
| name | String? | Business name |
| address | String? | Address |
| phone | String? | Phone |
| website | String? | Website |
| category | String? | Category |
| rating | Float? | Rating |
| totalReviews | Int? | Review count |
| source | String | `live` or `task_get` |
| recordedAt | DateTime | When recorded |

**Index:** `(businessId, recordedAt)`
