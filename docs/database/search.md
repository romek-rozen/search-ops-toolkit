# Search Tables

## MapsSearchTask

Google Maps SERP search task.

| Column | Type | Description |
|--------|------|-------------|
| id | String (cuid) | Primary key |
| dfsTaskId | String? | DataForSEO task ID (unique, null for live) |
| keyword | String | Search query |
| locationCode | Int | DataForSEO location code |
| locationName | String | Human-readable location |
| languageCode | String | Language code |
| depth | Int | Number of results (default 100) |
| method | String | `live`, `standard`, or `priority` |
| status | String | `pending` → `completed` / `failed` |
| cost | Float? | API cost in USD |
| timeSec | Float? | Processing time |
| resultsCount | Int? | Number of results returned |
| dfsResponse | Json? | Raw API response |
| dfsLogin | String? | Owner (DataForSEO login) |
| isShared | Boolean | Shared with other users (default false) |
| createdAt | DateTime | Created timestamp |
| updatedAt | DateTime | Last updated |

### Methods and cost

| Method | Endpoint | Time | Cost per SERP page |
|--------|----------|------|--------------------|
| live | `/v3/serp/google/maps/live/advanced` | Instant | $0.002 |
| standard | `task_post` priority=1 | ~5 min | $0.0006 |
| priority | `task_post` priority=2 | ~1 min | $0.0012 |

Depth multiplier: cost × (depth / 100).

## MapsSearchResult

Individual business result from a Maps SERP search.

| Column | Type | Description |
|--------|------|-------------|
| id | String (cuid) | Primary key |
| taskId | String | FK → MapsSearchTask |
| rankAbsolute | Int | Position in SERP |
| title | String | Business name |
| address | String? | Address |
| city | String? | City |
| country | String? | Country |
| phone | String? | Phone |
| domain | String? | Website domain |
| url | String? | Google Maps URL |
| cid | String? | Google Maps CID |
| placeId | String? | Google Place ID |
| rating | Float? | Average rating |
| votesCount | Int? | Number of reviews |
| ratingDistribution | Json? | Rating breakdown (1-5 stars) |
| category | String? | Primary category |
| additionalCategories | String[] | Additional categories |
| latitude | Float? | Latitude |
| longitude | Float? | Longitude |
| snippet | String? | Description snippet |
| mainImage | String? | Image URL |
| workHours | Json? | Working hours |
| priceLevel | String? | Price level |
| isClaimed | Boolean? | Is listing claimed |
| featureId | String? | Google feature ID |
| type | String? | Result type |
| businessCid | String? | FK → Business (by cid) |
| createdAt | DateTime | Created timestamp |
