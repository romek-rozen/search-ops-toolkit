# Reviews Tables

## Review

Individual Google Maps review.

| Column | Type | Description |
|--------|------|-------------|
| id | String (cuid) | Primary key |
| businessId | String | FK → Business |
| authorName | String | Reviewer name |
| authorAvatar | String? | Avatar URL |
| rating | Int | 1-5 star rating |
| text | String? | Review text |
| publishedAt | DateTime? | When the review was posted |
| ownerResponse | String? | Business owner's reply |
| ownerRespondedAt | DateTime? | Owner reply timestamp |
| dfsLogin | String? | Who fetched this review |
| createdAt | DateTime | Created in DB |

**Unique constraint:** `(businessId, authorName, publishedAt)` — deduplication across tasks.

**M:N relation** with `ReviewTask` via implicit junction table `_ReviewTaskReviews`.

## ReviewTask

Async task for fetching reviews from DataForSEO (`/v3/business_data/google/reviews/task_post`).

| Column | Type | Description |
|--------|------|-------------|
| id | String (cuid) | Primary key |
| dfsTaskId | String | DataForSEO task ID (unique) |
| businessId | String | FK → Business |
| status | String | `pending` → `ready` → `completed` / `failed` |
| depth | Int | Number of reviews to fetch (default 100) |
| cost | Float? | API cost in USD |
| timeSec | String? | Processing time |
| locationName | String? | Search location |
| languageName | String? | Search language |
| keyword | String? | Search keyword filter |
| device | String? | Device type |
| os | String? | OS type |
| dfsStatusCode | Int? | DataForSEO status code |
| dfsResponse | Json? | Raw API response |
| error | String? | Error message |
| dfsLogin | String? | Owner (DataForSEO login) |
| isShared | Boolean | Shared with other users (default false) |
| createdAt | DateTime | Created timestamp |
| updatedAt | DateTime | Last updated |

### Cost formula

Base cost: $0.002 per task. Depth multiplier: cost × (depth / 100).
Example: depth=500 → $0.002 × 5 = $0.01.
