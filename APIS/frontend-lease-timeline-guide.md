# Frontend Guide: Lease Edit + Resident Lease Discovery + Unified Timeline

This guide documents how to implement and maintain the lease history UX using timeline endpoints as the primary source.

## Scope
- Lease edit flow (partial `PATCH`)
- Resident lease discovery (active + ended leases)
- Unified lease timeline UI (history + activity)

## Source of Truth
- Primary: `tower-desk/Ins/API.md`
- Supplemental: `APIS/update-lease.md`

## Endpoints
- `GET /api/org/leases`
  - Org-wide lease list for admin/manager lease index pages
- `GET /api/org/leases/:leaseId`
  - Load lease details
- `PATCH /api/org/leases/:leaseId`
  - Partial lease update
- `GET /api/org/residents/:userId/leases`
  - Resident lease list for discovery/navigation
- `GET /api/org/residents/:userId/leases/timeline`
  - Resident-level lease history stream
- `GET /api/org/leases/:leaseId/timeline`
  - Unified timeline (history + activity)

## Lease Timeline Query Parameters
Use on `GET /api/org/leases/:leaseId/timeline`:
- `source=ALL|HISTORY|ACTIVITY`
- `historyAction=CREATED|UPDATED|MOVED_OUT`
- `activityAction=MOVE_IN|MOVE_OUT|DOCUMENT_ADDED|DOCUMENT_DELETED|ACCESS_CARD_ISSUED|ACCESS_CARD_STATUS_CHANGED|ACCESS_CARD_DELETED|PARKING_STICKER_ISSUED|PARKING_STICKER_STATUS_CHANGED|PARKING_STICKER_DELETED|OCCUPANTS_REPLACED|PARKING_ALLOCATED`
- `date_from` (ISO datetime, inclusive)
- `date_to` (ISO datetime, inclusive)
- `order=asc|desc`
- `cursor`
- `limit`

## Org-Wide Lease List Query Parameters
Use on `GET /api/org/leases`:
- `status=ACTIVE|ENDED|ALL`
- `buildingId`, `unitId`, `residentUserId` (optional)
- `q` (optional text search)
- `date_from`, `date_to` (optional ISO datetime)
- `order=asc|desc`
- `cursor`
- `limit`

## Frontend Rules
- Submit only changed lease fields in `PATCH`.
- Keep money fields as strings (`annualRent`, `securityDepositAmount`, etc.).
- Block submit when no fields changed.
- Validate `leaseEndDate > leaseStartDate`.
- When clearing nullable fields, send explicit `null`.
- Timeline is the main history source in UI.

## Suggested Types
- `UpdateLeaseDto`
- `ResidentLeaseListQuery`, `ResidentLeaseListResponse`
- `ResidentLeaseTimelineQuery`
- `LeaseTimelineQuery`, `LeaseTimelineResponse`, `LeaseTimelineItem`

## API Client Methods
Implement:
- `getLeaseById(leaseId: string)`
- `updateLease(leaseId: string, dto: UpdateLeaseDto)`
- `getResidentLeases(userId: string, query?)`
- `getResidentLeaseTimeline(userId: string, query?)`
- `getLeaseTimeline(leaseId: string, query?)`

Normalization recommendations:
- Always normalize `nextCursor` from either `nextCursor` or fallback `cursor`.
- Normalize actor as `{ id, name?, email? }`.
- For timeline entries, normalize:
  - `source`
  - `action`
  - `createdAt`
  - `changedByUser`
  - `payload`
  - lease context (`leaseId`, `status`, `buildingId`, `unitId`, dates)

## React Query Setup
Recommended query keys:
- `['leases', 'byId', leaseId]`
- `['lease-timeline', leaseId, query]`
- `['resident-leases', userId, query]`
- `['resident-lease-timeline', userId, query]`

Mutation invalidation after lease update:
- `['leases', 'byId', leaseId]`
- `['lease-timeline', leaseId]`
- `['resident-leases', residentUserId]` (if available)
- `['resident-lease-timeline', residentUserId]` (if available)

## UI Pattern

### Lease Details Page
- Tabs:
  - `Details`
  - `History`
- `History` tab should render unified timeline from `GET /leases/:leaseId/timeline`.
- Support:
  - Source/action/date/order filters
  - Cursor pagination (`Load more`)

### Residents Page
- Add row action: `Lease History`
- Open dialog/panel with:
  - `Leases` tab (`GET /residents/:userId/leases`)
  - `Timeline` tab (`GET /residents/:userId/leases/timeline`)
- Each lease row should deep-link to lease details history tab:
  - `/admin/leases/:leaseId?tab=history`

## Error Handling
Apply clear state messaging for both lease and resident timeline views:
- `400`: invalid filter/date range
- `403`: missing `leases.read`/`leases.write`
- `404`: lease or resident not found / out-of-scope
- fallback: generic load failure

## Pagination Behavior
- Keep local `items[]` and `nextCursor`.
- On first page (`cursor=null`): replace list.
- On next pages: merge by stable `id` to avoid duplicates.
- Disable `Load more` while fetching.

## Manual QA Checklist
1. Open `/admin/leases/:leaseId?tab=history`.
2. Verify `GET /api/org/leases/:leaseId/timeline` loads entries.
3. Apply source/action/date/order filters and verify request query params.
4. Verify cursor pagination (`nextCursor`) appends items.
5. Edit lease with one changed field and save.
6. Verify `PATCH /api/org/leases/:leaseId` sends only changed fields.
7. Verify timeline refreshes after successful patch.
8. In residents page, open `Lease History` for a resident.
9. Verify `GET /api/org/residents/:userId/leases` and `.../timeline` work with pagination.
10. Use lease link from resident dialog and confirm it opens lease `History` tab.
11. Validate `400/403/404` states in both timeline surfaces.

## Implementation Notes
- Keep legacy `GET /leases/:leaseId/history` as optional fallback only; do not use as primary UI source.
- If manager routes need timeline deep-linking, ensure a manager lease-details route exists or handle role-based routing before rendering links.
