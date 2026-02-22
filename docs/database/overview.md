# Database Overview

## Entity Relationship Diagram

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────┐
│  MapsSearchTask  │──1:N──│ MapsSearchResult  │──N:1──│  Business   │
└─────────────────┘       └──────────────────┘       └──────┬──────┘
                                                            │
                          ┌──────────────────┐              │ 1:N
                          │   ReviewTask      │──N:1────────┤
                          └────────┬─────────┘              │
                                   │ M:N                    │ 1:N
                          ┌────────┴─────────┐              │
                          │     Review        │──N:1────────┘
                          └──────────────────┘

Business ──1:N── BusinessInfoTask
Business ──1:N── BusinessNameHistory
Business ──1:N── BusinessDataHistory

DfsLocation, DfsLanguage, DfsSerpLocation — standalone lookup tables
```

## Key relationships

- **Business** is the central entity — linked by `cid` (Google Maps CID)
- **MapsSearchResult** → Business is optional (linked when user clicks "Details")
- **Review ↔ ReviewTask** is M:N via implicit junction table `_ReviewTaskReviews`
- All task tables use cascade delete from Business

## Multi-user isolation

Every task and business has a `dfsLogin` field storing the DataForSEO email of the user who created it. All queries filter by `WHERE dfsLogin = ?` unless the user is admin (`ADMIN_EMAIL` env var). Shared tasks (`isShared = true`) are visible to all logged-in users.

## Async task pattern

Tasks (`ReviewTask`, `BusinessInfoTask`, `MapsSearchTask`) follow a status flow:

```
pending → ready → completed
                → failed
```

`MapsSearchTask` with `method = "live"` skips async — goes directly to `completed`.
