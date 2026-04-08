# Frontend Handoff: Vendor / Service Provider APIs

Use this file as the source of truth for frontend integration with the vendor or service-provider MVP.

## Base

- API prefix: `/api` if your gateway prefixes Nest routes.
- Auth: `Authorization: Bearer <accessToken>`.
- All vendor MVP routes are org-scoped under `/org/*`.
- Vendors are not separate tenant orgs in MVP. They live inside the building org data model.

## MVP Model

There are two distinct frontend surfaces:

1. Building-management screens that manage providers and assign maintenance requests to them.
2. Provider-user screens where provider managers and provider workers handle assigned requests.

## Locked Frontend Rules

- A service provider belongs to one org and can be linked to multiple buildings in that org.
- Provider memberships have their own `membershipIsActive` flag and also depend on the linked user account being active.
- Building staff assignment and provider assignment are mutually exclusive on a request.
- Assigning a provider clears internal staff assignment.
- Assigning internal staff clears provider assignment and provider worker assignment.
- Provider users only see requests assigned to their provider.
- Provider users only see `SHARED` comments.
- Provider workers can write only on requests where they are the assigned provider worker.
- Provider managers can manage any request belonging to their provider.
- Reading request comments marks visible comments as read.
- Posting a comment also advances the caller's read state for that request thread.

## Route Groups

### Service Provider Admin

- `GET /org/service-providers`
- `GET /org/service-providers/:providerId`
- `POST /org/service-providers`
- `PATCH /org/service-providers/:providerId`
- `POST /org/service-providers/:providerId/buildings`
- `DELETE /org/service-providers/:providerId/buildings/:buildingId`
- `POST /org/service-providers/:providerId/users`
- `DELETE /org/service-providers/:providerId/users/:userId`

### Building-Side Request Assignment

- `GET /org/buildings/:buildingId/requests`
- `GET /org/buildings/:buildingId/requests/:requestId`
- `GET /org/buildings/:buildingId/requests/comments/unread-count`
- `POST /org/buildings/:buildingId/requests/:requestId/assign-provider`
- `POST /org/buildings/:buildingId/requests/:requestId/assign-provider-worker`
- `POST /org/buildings/:buildingId/requests/:requestId/unassign-provider`
- `GET /org/buildings/:buildingId/requests/:requestId/comments`
- `POST /org/buildings/:buildingId/requests/:requestId/comments`
- `POST /org/buildings/:buildingId/requests/:requestId/attachments`

### Provider Runtime

- `GET /org/provider/requests`
- `GET /org/provider/requests/comments/unread-count`
- `GET /org/provider/requests/:requestId`
- `POST /org/provider/requests/:requestId/assign-worker`
- `POST /org/provider/requests/:requestId/status`
- `GET /org/provider/requests/:requestId/comments`
- `POST /org/provider/requests/:requestId/comments`
- `POST /org/provider/requests/:requestId/attachments`

## Key Response Shapes

### Service Provider

`GET /org/service-providers`

```json
[
  {
    "id": "provider_uuid",
    "orgId": "org_uuid",
    "name": "RapidFix Technical Services",
    "serviceCategory": "Plumbing",
    "contactName": "Nadia Khan",
    "contactEmail": "ops@rapidfix.test",
    "contactPhone": "+971500000000",
    "notes": "24/7 emergency coverage",
    "isActive": true,
    "buildings": [
      {
        "buildingId": "building_uuid",
        "buildingName": "Central Tower",
        "createdAt": "2026-04-06T10:00:00.000Z"
      }
    ],
    "users": [
      {
        "userId": "user_uuid",
        "email": "manager@rapidfix.test",
        "name": "Vendor Manager",
        "role": "MANAGER",
        "membershipIsActive": true,
        "userIsActive": true,
        "createdAt": "2026-04-06T10:00:00.000Z",
        "updatedAt": "2026-04-06T10:00:00.000Z"
      }
    ],
    "createdAt": "2026-04-06T10:00:00.000Z",
    "updatedAt": "2026-04-06T10:00:00.000Z"
  }
]
```

### Building Request With Provider Assignment

`GET /org/buildings/:buildingId/requests/:requestId`

```json
{
  "id": "request_uuid",
  "buildingId": "building_uuid",
  "unit": {
    "id": "unit_uuid",
    "label": "A-1204",
    "floor": 12
  },
  "createdBy": {
    "id": "user_uuid",
    "name": "Resident User",
    "email": "resident@example.com"
  },
  "assignedTo": null,
  "serviceProvider": {
    "id": "provider_uuid",
    "name": "RapidFix Technical Services",
    "serviceCategory": "Plumbing"
  },
  "serviceProviderAssignedTo": {
    "id": "worker_uuid",
    "name": "Vendor Worker",
    "email": "worker@rapidfix.test"
  },
  "title": "Water leakage",
  "description": "Kitchen sink is leaking",
  "status": "ASSIGNED",
  "priority": "HIGH",
  "type": "PLUMBING",
  "attachments": [],
  "ownerApproval": {
    "status": "APPROVED",
    "requestedAt": "2026-04-06T10:00:00.000Z",
    "requestedByUserId": "admin_uuid",
    "deadlineAt": null,
    "decidedAt": "2026-04-06T11:00:00.000Z",
    "decidedByOwnerUserId": "owner_user_uuid",
    "reason": "Proceed",
    "requiredReason": "Estimated cost exceeds threshold",
    "estimatedAmount": "450.00",
    "estimatedCurrency": "AED",
    "decisionSource": "OWNER",
    "overrideReason": null,
    "overriddenByUserId": null
  },
  "createdAt": "2026-04-06T09:00:00.000Z",
  "updatedAt": "2026-04-06T11:30:00.000Z"
}
```

### Provider Request

`GET /org/provider/requests`

```json
[
  {
    "id": "request_uuid",
    "buildingId": "building_uuid",
    "buildingName": "Central Tower",
    "unit": {
      "id": "unit_uuid",
      "label": "A-1204",
      "floor": 12
    },
    "createdBy": {
      "id": "user_uuid",
      "name": "Resident User",
      "email": "resident@example.com"
    },
    "serviceProvider": {
      "id": "provider_uuid",
      "name": "RapidFix Technical Services",
      "serviceCategory": "Plumbing"
    },
    "serviceProviderAssignedTo": {
      "id": "worker_uuid",
      "name": "Vendor Worker",
      "email": "worker@rapidfix.test"
    },
    "title": "Water leakage",
    "description": "Kitchen sink is leaking",
    "status": "IN_PROGRESS",
    "priority": "HIGH",
    "type": "PLUMBING",
    "attachments": [],
    "ownerApproval": {
      "status": "APPROVED",
      "requestedAt": "2026-04-06T10:00:00.000Z",
      "requestedByUserId": "admin_uuid",
      "deadlineAt": null,
      "decidedAt": "2026-04-06T11:00:00.000Z",
      "decidedByOwnerUserId": "owner_user_uuid",
      "reason": "Proceed",
      "requiredReason": "Estimated cost exceeds threshold",
      "estimatedAmount": "450.00",
      "estimatedCurrency": "AED",
      "decisionSource": "OWNER",
      "overrideReason": null,
      "overriddenByUserId": null
    },
    "createdAt": "2026-04-06T09:00:00.000Z",
    "updatedAt": "2026-04-06T12:00:00.000Z"
  }
]
```

### Request Comment

`GET /org/buildings/:buildingId/requests/:requestId/comments`

or

`GET /org/provider/requests/:requestId/comments`

```json
[
  {
    "id": "comment_uuid",
    "requestId": "request_uuid",
    "author": {
      "id": "user_uuid",
      "name": "Vendor Worker",
      "email": "worker@rapidfix.test",
      "type": "STAFF",
      "ownerId": null
    },
    "message": "We are onsite now.",
    "visibility": "SHARED",
    "createdAt": "2026-04-06T12:10:00.000Z"
  }
]
```

### Request Comment Unread Count

`GET /org/buildings/:buildingId/requests/comments/unread-count`

or

`GET /org/provider/requests/comments/unread-count`

```json
{
  "unreadCount": 3
}
```

## Request Payloads

### Create Service Provider

`POST /org/service-providers`

```json
{
  "name": "RapidFix Technical Services",
  "serviceCategory": "Plumbing",
  "contactName": "Nadia Khan",
  "contactEmail": "ops@rapidfix.test",
  "contactPhone": "+971500000000",
  "notes": "24/7 emergency coverage",
  "isActive": true
}
```

### Update Service Provider

`PATCH /org/service-providers/:providerId`

Accepts the same fields as create, all optional.

### Link Provider To Building

`POST /org/service-providers/:providerId/buildings`

```json
{
  "buildingId": "building_uuid"
}
```

### Add Or Update Provider Membership

`POST /org/service-providers/:providerId/users`

```json
{
  "userId": "user_uuid",
  "role": "MANAGER",
  "isActive": true
}
```

Notes:

- `role` is `MANAGER` or `WORKER`.
- Re-posting the same user updates membership role and `isActive`.
- Deactivating a membership keeps the record but removes provider runtime access immediately.

### Assign Provider To Request

`POST /org/buildings/:buildingId/requests/:requestId/assign-provider`

```json
{
  "serviceProviderId": "provider_uuid"
}
```

Rules:

- Request must belong to the same building and org.
- Provider must be active and linked to the building.
- Provider assignment is blocked while owner approval is `PENDING`.

### Assign Provider Worker From Building Side

`POST /org/buildings/:buildingId/requests/:requestId/assign-provider-worker`

```json
{
  "userId": "worker_uuid"
}
```

Rules:

- The request must already be assigned to a provider.
- The worker must be an active membership of that provider.

### Unassign Provider

`POST /org/buildings/:buildingId/requests/:requestId/unassign-provider`

No body.

Rules:

- Clears `serviceProvider` and `serviceProviderAssignedTo`.
- Reopens the request to `OPEN`.

### List Provider Requests

`GET /org/provider/requests?status=IN_PROGRESS&serviceProviderId=provider_uuid`

Query params:

- `status`: optional, one of `OPEN`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELED`
- `serviceProviderId`: optional UUID

Practical note:

- Most provider users only belong to one provider, so frontend usually will not need `serviceProviderId`.

### Provider Assign Worker

`POST /org/provider/requests/:requestId/assign-worker`

```json
{
  "userId": "worker_uuid"
}
```

### Provider Update Status

`POST /org/provider/requests/:requestId/status`

```json
{
  "status": "IN_PROGRESS"
}
```

Allowed values:

- `IN_PROGRESS`
- `COMPLETED`

### Building Comment

`POST /org/buildings/:buildingId/requests/:requestId/comments`

```json
{
  "message": "Please update once you reach the site.",
  "visibility": "SHARED"
}
```

Notes:

- Building-side comment visibility can be `SHARED` or `INTERNAL`.
- `INTERNAL` comments never appear on provider endpoints.

### Provider Comment

`POST /org/provider/requests/:requestId/comments`

```json
{
  "message": "Leak repaired. Monitoring for 30 minutes."
}
```

Provider comments are exposed as `SHARED` to keep the provider surface safe.

### Add Attachments

`POST /org/buildings/:buildingId/requests/:requestId/attachments`

or

`POST /org/provider/requests/:requestId/attachments`

```json
{
  "attachments": [
    {
      "fileName": "before.jpg",
      "mimeType": "image/jpeg",
      "sizeBytes": 245123,
      "url": "https://storage.example.com/before.jpg"
    }
  ]
}
```

## Suggested Screen Mapping

### Building Management

- Provider directory:
  - `GET /org/service-providers`
  - `POST /org/service-providers`
  - `PATCH /org/service-providers/:providerId`
- Provider detail:
  - `GET /org/service-providers/:providerId`
  - manage buildings
  - manage linked users
- Building request detail:
  - `GET /org/buildings/:buildingId/requests/:requestId`
  - assign provider
  - assign provider worker
  - unassign provider
  - comments
  - attachments
- Building badge counts:
  - `GET /org/buildings/:buildingId/requests/comments/unread-count`

### Provider Portal / App

- Inbox:
  - `GET /org/provider/requests`
  - `GET /org/provider/requests/comments/unread-count`
- Request detail:
  - `GET /org/provider/requests/:requestId`
  - `GET /org/provider/requests/:requestId/comments`
  - `POST /org/provider/requests/:requestId/comments`
  - `POST /org/provider/requests/:requestId/status`
  - `POST /org/provider/requests/:requestId/attachments`
- Manager actions:
  - `POST /org/provider/requests/:requestId/assign-worker`

## Error Expectations

- `401` for missing or invalid token.
- `403` for org or building permission failures.
- `404` when the provider, building, request, or membership is outside the caller's scope.
- `400` for invalid transitions or invalid assignment targets, for example assigning a worker who is not an active member of the assigned provider.

## Practical Frontend Notes

- Do not infer provider write access from role labels alone. Provider worker write access depends on both membership role and whether the worker is the assigned provider worker on that request.
- Use unread-count endpoints for badges instead of trying to derive unread state from partially loaded request comment threads.
- Keep building-side and provider-side request detail UIs separate. The response shapes overlap, but the visibility and allowed actions are different.
- If a provider or membership is deactivated, expect provider request endpoints to stop returning those requests immediately.
