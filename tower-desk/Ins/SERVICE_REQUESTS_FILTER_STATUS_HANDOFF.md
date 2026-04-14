# Backend Handoff: Service Requests UI Filter Status

This note explains how the current frontend service-request UI behaves, especially the `Status` filter.

## Important

The `Status` filter in the UI is **not** a direct passthrough of the raw request `status` field.

The UI uses a mix of:

- `request.status`
- `request.queue`
- `request.ownerApproval.status` or `request.ownerApprovalStatus`
- `request.estimate.status`
- `request.policy.route`
- `request.requestTenancyContext`

So if backend only thinks in terms of `pending / assigned / in-progress / completed / cancelled`, that is not enough to reproduce the current UI behavior.

## Raw fields the UI currently uses

The frontend expects these fields on each request:

- `status`
  - `pending | assigned | in-progress | on-hold | completed | cancelled`
- `queue`
  - `NEW | NEEDS_ESTIMATE | AWAITING_ESTIMATE | AWAITING_OWNER | READY_TO_ASSIGN | ASSIGNED | IN_PROGRESS | OVERDUE`
- `ownerApproval.status` or fallback `ownerApprovalStatus`
  - `NOT_REQUIRED | PENDING | APPROVED | REJECTED`
- `estimate.status`
  - `NOT_REQUESTED | REQUESTED | SUBMITTED`
- `policy.route`
  - `DIRECT_ASSIGN | EMERGENCY_DISPATCH | NEEDS_ESTIMATE | OWNER_APPROVAL_REQUIRED`
- `requestTenancyContext.label`
  - `CURRENT_OCCUPANCY | PREVIOUS_OCCUPANCY | NO_ACTIVE_OCCUPANCY | UNKNOWN_TENANCY_CYCLE`

## What the UI shows in the Status dropdown

Primary filter options:

- `OPEN` -> label `Operational Queue`
- `NEW` -> label `New / Untriaged`
- `ASSIGNED`
- `HISTORICAL` -> label `Archived`
- `ARCHIVE` -> label `Closed`
- `AWAITING_ESTIMATE`
- `AWAITING_OWNER`
- `OVERDUE`

Secondary group `Other statuses`:

- `READY_TO_ASSIGN`
- `NEEDS_ESTIMATE`
- `IN_PROGRESS`

The secondary group only shows items that currently have count > 0, unless the currently selected value is one of them.

## What each filter actually means

### `OPEN`

Shows requests where:

- tenancy context is `CURRENT`
- and request is **not** closed

Closed means:

- `status === completed`
- or `status === cancelled`

### `ARCHIVE`

Shows requests where:

- tenancy context is `CURRENT`
- and request is closed

This is not the same as `HISTORICAL`.

### `HISTORICAL`

Shows requests where tenancy context is:

- `PREVIOUS_OCCUPANCY`
- or `NO_ACTIVE_OCCUPANCY`
- or legacy/unresolved context

In other words, this is about occupancy/tenancy history, not only request closure.

### `LEGACY_CONTEXT`

Shows requests where tenancy context is unresolved / legacy:

- `UNKNOWN_TENANCY_CYCLE`

### `NEW`

Shows current-tenancy, non-closed requests that are treated as "new/untriaged".

The UI marks a request as `NEW` when:

- `request.queue === NEW`
- or `getPrimaryManagementQueue(request)` resolves to `READY_TO_ASSIGN`
- or `getPrimaryManagementQueue(request)` resolves to `NEEDS_ESTIMATE`

This means `NEW` in the UI is not just the literal backend queue `NEW`.

### `OVERDUE`

Shows current-tenancy, non-closed requests where:

- `request.queue === OVERDUE`

### `ASSIGNED`, `READY_TO_ASSIGN`, `NEEDS_ESTIMATE`, `AWAITING_ESTIMATE`, `AWAITING_OWNER`, `IN_PROGRESS`

These use the frontend-derived workflow queue logic below.

## Queue derivation logic used by the UI

The UI computes a `primary management queue` like this:

1. If request is closed, treat it as `READY_TO_ASSIGN` internally for queue resolution.
2. If `request.queue` exists and is not `NEW` and not `OVERDUE`, use it directly.
3. If owner approval is pending, use `AWAITING_OWNER`.
4. If estimate status is `REQUESTED`, use `AWAITING_ESTIMATE`.
5. If raw status is `in-progress`, use `IN_PROGRESS`.
6. If raw status is `assigned`, or there is any assignee/provider/provider-worker, use `ASSIGNED`.
7. If `policy.route === NEEDS_ESTIMATE`, use `NEEDS_ESTIMATE`.
8. If `policy.route === OWNER_APPROVAL_REQUIRED`, use `AWAITING_OWNER`.
9. Otherwise default to `READY_TO_ASSIGN`.

## Counts shown in the filter UI

The frontend computes counts client-side from the full request list.

### `OPEN` count

- current tenancy
- not closed

### `ARCHIVE` count

- current tenancy
- closed

### `HISTORICAL` count

- historical tenancy
- plus legacy tenancy

### queue counts

For current-tenancy, non-closed requests:

- `NEW` count increments if request is considered new/untriaged
- queue counts come from the derived primary queue
- `OVERDUE` count increments only when `request.queue === OVERDUE`

## Table/grid rendering vs filter meaning

The request row itself shows:

- one raw `status` badge
- optional workflow `queue` badge
- owner approval badge
- estimate badge

So backend should understand:

- row `status` is not enough to drive the filter UX
- the filter UX is workflow-oriented

## Current API usage

For management pages, frontend currently fetches:

- `GET /org/buildings/:buildingId/requests`

Then it applies all status-filter logic on the client.

It does support query params in the API layer:

- `status`
- `ownerApprovalStatus`
- `queue`

But the current `RequestsPage` is not driving the dropdown from those server-side query params. It fetches the building requests and computes the UI filters locally.

## What backend should preserve if it does not want to break the current UI

Backend responses should keep returning enough data for each request to derive:

- raw status
- workflow queue
- estimate status
- owner approval status
- tenancy context
- assignment presence

At minimum, these fields are important:

- `status`
- `queue`
- `ownerApproval.status` or `ownerApprovalStatus`
- `estimate.status`
- `policy.route`
- `assignedTo`
- `assignedEmployeeId`
- `serviceProvider`
- `serviceProviderAssignedTo`
- `requestTenancyContext.label`

## If backend wants the UI to stop deriving this client-side

Then backend should provide one explicit, stable field for the filter bucket, for example:

- `managementFilterBucket`

Possible values could match UI concepts directly:

- `OPEN`
- `NEW`
- `READY_TO_ASSIGN`
- `NEEDS_ESTIMATE`
- `AWAITING_ESTIMATE`
- `AWAITING_OWNER`
- `ASSIGNED`
- `IN_PROGRESS`
- `OVERDUE`
- `ARCHIVE`
- `HISTORICAL`
- `LEGACY_CONTEXT`

That would remove ambiguity and reduce frontend recomputation.

## Short version for backend

The UI `Status` filter is really a **workflow queue filter**, not a raw request status filter.

Raw `status` is only one input. The frontend also depends on:

- `queue`
- owner approval state
- estimate state
- policy route
- tenancy context
- whether the request is assigned

If backend changes any of those semantics, the filter section will drift or misclassify requests.
