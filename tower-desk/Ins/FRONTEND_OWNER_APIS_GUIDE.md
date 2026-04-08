# Frontend Handoff: Owner APIs

Use this file as the source of truth for frontend integration with owner-facing APIs and org-side owner access management APIs.

## Base

- API prefix: `/api` if your gateway prefixes Nest routes.
- Auth: `Authorization: Bearer <accessToken>`.
- Owner runtime routes use `/owner/*`.
- Org admin owner-management routes use `/org/*`.

## Scope Model

### Owner Runtime

- Owner runtime is not tied to a single org in the UI.
- The owner token authenticates the user once, and backend access is resolved from active owner access grants.
- Owner list surfaces can include data across multiple orgs and buildings.
- If an owner loses access to an org, that org immediately drops out of owner lists, unread counts, notifications, and request access.

### Org Admin

- Org admin owner-management routes are org-scoped.
- Cross-org access returns `404`.
- Missing permission returns `403`.

## Locked Frontend Rules

- Treat owner app data as cross-org by default.
- Always display `orgName` and `buildingName` on owner request and conversation screens.
- Opening owner request comments marks visible comments as read.
- Posting an owner request comment also marks that request comment thread as read for the owner.
- Opening an owner conversation does not implicitly mark it read. Call the explicit read endpoint after the thread screen is viewed.
- Owner notifications support cursor pagination and filtering by unread state, dismissed state, and type.

## Owner Runtime Endpoints

### Portfolio Overview

- `GET /owner/portfolio/summary`
- `GET /owner/portfolio/units`
- `GET /owner/portfolio/requests`
- `GET /owner/portfolio/requests/:requestId`
- `GET /owner/portfolio/requests/comments/unread-count`

### Request Approval + Comments

- `POST /owner/portfolio/requests/:requestId/approve`
- `POST /owner/portfolio/requests/:requestId/reject`
- `GET /owner/portfolio/requests/:requestId/comments`
- `POST /owner/portfolio/requests/:requestId/comments`

### Messaging

- `POST /owner/messages/management`
- `POST /owner/messages/tenants`
- `GET /owner/conversations`
- `GET /owner/conversations/unread-count`
- `GET /owner/conversations/:id`
- `POST /owner/conversations/:id/messages`
- `POST /owner/conversations/:id/read`

### Notifications + Push

- `GET /owner/notifications`
- `GET /owner/notifications/unread-count`
- `POST /owner/notifications/read-all`
- `POST /owner/notifications/:id/read`
- `POST /owner/notifications/:id/dismiss`
- `POST /owner/notifications/:id/undismiss`
- `POST /owner/notifications/devices`
- `PATCH /owner/notifications/devices/:deviceId`
- `DELETE /owner/notifications/devices/:deviceId`

## Org Admin Owner Access Endpoints

- `GET /org/owners/:ownerId/access-grants`
- `GET /org/owners/:ownerId/access-grants/history`
- `POST /org/owners/:ownerId/access-grants`
- `POST /org/owners/:ownerId/access-grants/link-existing-user`
- `POST /org/owners/:ownerId/access-grants/:grantId/activate`
- `POST /org/owners/:ownerId/access-grants/:grantId/disable`
- `POST /org/owners/:ownerId/access-grants/:grantId/resend-invite`

## Key Response Shapes

### Owner Summary

`GET /owner/portfolio/summary`

```json
{
  "unitCount": 3,
  "orgCount": 2,
  "buildingCount": 2
}
```

### Owner Units

`GET /owner/portfolio/units`

```json
[
  {
    "orgId": "org_uuid",
    "orgName": "Towerdesk Management",
    "ownerId": "owner_uuid",
    "unitId": "unit_uuid",
    "buildingId": "building_uuid",
    "buildingName": "Central Tower",
    "unitLabel": "A-1204"
  }
]
```

### Owner Request

`GET /owner/portfolio/requests`

```json
[
  {
    "id": "request_uuid",
    "orgId": "org_uuid",
    "orgName": "Towerdesk Management",
    "ownerId": "owner_uuid",
    "buildingId": "building_uuid",
    "buildingName": "Central Tower",
    "unit": {
      "id": "unit_uuid",
      "label": "A-1204"
    },
    "createdBy": {
      "id": "user_uuid",
      "name": "Operations Admin",
      "email": "ops@example.com"
    },
    "assignedTo": {
      "id": "user_uuid",
      "name": "Technician",
      "email": "tech@example.com"
    },
    "title": "Water leakage",
    "description": "Kitchen sink is leaking",
    "status": "OPEN",
    "priority": "HIGH",
    "type": "PLUMBING",
    "attachments": [],
    "ownerApproval": {
      "status": "PENDING",
      "requestedAt": "2026-04-06T10:00:00.000Z",
      "requestedByUserId": "user_uuid",
      "deadlineAt": null,
      "decidedAt": null,
      "decidedByOwnerUserId": null,
      "reason": null,
      "requiredReason": "Estimated cost exceeds threshold",
      "estimatedAmount": "450.00",
      "estimatedCurrency": "AED",
      "decisionSource": null,
      "overrideReason": null,
      "overriddenByUserId": null
    },
    "createdAt": "2026-04-06T10:00:00.000Z",
    "updatedAt": "2026-04-06T10:00:00.000Z"
  }
]
```

### Owner Request Comments

`GET /owner/portfolio/requests/:requestId/comments`

```json
[
  {
    "id": "comment_uuid",
    "requestId": "request_uuid",
    "author": {
      "id": "user_uuid",
      "name": "Operations Admin",
      "email": "ops@example.com",
      "type": "STAFF",
      "ownerId": null
    },
    "message": "Please review the estimate.",
    "visibility": "SHARED",
    "createdAt": "2026-04-06T11:00:00.000Z"
  }
]
```

### Owner Request Comment Unread Count

`GET /owner/portfolio/requests/comments/unread-count`

```json
{
  "unreadCount": 4
}
```

### Owner Conversation List

`GET /owner/conversations`

```json
{
  "items": [
    {
      "id": "conversation_uuid",
      "subject": "Maintenance follow-up",
      "buildingId": "building_uuid",
      "participants": [
        {
          "id": "user_1",
          "name": "Owner User",
          "avatarUrl": null
        },
        {
          "id": "user_2",
          "name": "Building Manager",
          "avatarUrl": null
        }
      ],
      "unreadCount": 2,
      "lastMessage": {
        "id": "message_uuid",
        "content": "We are scheduling the vendor visit.",
        "sender": {
          "id": "user_2",
          "name": "Building Manager",
          "avatarUrl": null
        },
        "createdAt": "2026-04-06T12:00:00.000Z"
      },
      "createdAt": "2026-04-05T12:00:00.000Z",
      "updatedAt": "2026-04-06T12:00:00.000Z",
      "orgId": "org_uuid",
      "orgName": "Towerdesk Management",
      "buildingName": "Central Tower"
    }
  ],
  "nextCursor": null
}
```

### Owner Notifications List

`GET /owner/notifications`

```json
{
  "items": [
    {
      "id": "notification_uuid",
      "orgId": "org_uuid",
      "type": "OWNER_APPROVAL_REQUESTED",
      "title": "Approval required",
      "body": "A maintenance request requires your approval.",
      "data": {
        "requestId": "request_uuid",
        "buildingId": "building_uuid"
      },
      "readAt": null,
      "dismissedAt": null,
      "createdAt": "2026-04-06T12:30:00.000Z"
    }
  ],
  "nextCursor": null
}
```

### Owner Push Device

`POST /owner/notifications/devices`

```json
{
  "id": "device_uuid",
  "provider": "FIREBASE",
  "platform": "IOS",
  "token": "push_token",
  "deviceId": "ios-device-id",
  "appId": "com.towerdesk.owner",
  "isActive": true,
  "lastSeenAt": "2026-04-06T13:00:00.000Z",
  "createdAt": "2026-04-06T13:00:00.000Z",
  "updatedAt": "2026-04-06T13:00:00.000Z"
}
```

### Owner Access Grant

`GET /org/owners/:ownerId/access-grants`

```json
[
  {
    "id": "grant_uuid",
    "userId": "user_uuid",
    "ownerId": "owner_uuid",
    "status": "ACTIVE",
    "inviteEmail": "owner@example.com",
    "invitedAt": "2026-04-01T10:00:00.000Z",
    "acceptedAt": "2026-04-02T10:00:00.000Z",
    "grantedByUserId": "admin_uuid",
    "disabledAt": null,
    "disabledByUserId": null,
    "verificationMethod": "EMAIL_MATCH",
    "linkedUser": {
      "id": "user_uuid",
      "email": "owner@example.com",
      "orgId": null,
      "isActive": true,
      "name": "Owner User"
    },
    "createdAt": "2026-04-01T10:00:00.000Z",
    "updatedAt": "2026-04-02T10:00:00.000Z"
  }
]
```

### Owner Access Grant History

`GET /org/owners/:ownerId/access-grants/history`

```json
[
  {
    "id": "audit_uuid",
    "grantId": "grant_uuid",
    "ownerId": "owner_uuid",
    "action": "ACTIVATED",
    "fromStatus": "PENDING",
    "toStatus": "ACTIVE",
    "actorUserId": "admin_uuid",
    "userId": "user_uuid",
    "inviteEmail": "owner@example.com",
    "verificationMethod": "EMAIL_MATCH",
    "actorUser": {
      "id": "admin_uuid",
      "email": "ops@example.com",
      "name": "Ops Admin"
    },
    "createdAt": "2026-04-02T10:00:00.000Z"
  }
]
```

## Request Payloads

### Approve Owner Request

`POST /owner/portfolio/requests/:requestId/approve`

```json
{
  "approvalReason": "Approved. Proceed."
}
```

`approvalReason` is optional.

### Reject Owner Request

`POST /owner/portfolio/requests/:requestId/reject`

```json
{
  "approvalReason": "Please get a second quote first."
}
```

`approvalReason` is required.

### Create Owner Conversation With Management

`POST /owner/messages/management`

```json
{
  "unitId": "unit_uuid",
  "subject": "Question about unit access",
  "message": "Can management confirm the inspection schedule?"
}
```

### Create Owner Conversation With Tenant

`POST /owner/messages/tenants`

```json
{
  "unitId": "unit_uuid",
  "tenantUserId": "tenant_user_uuid",
  "subject": "Maintenance coordination",
  "message": "Please confirm you are available tomorrow."
}
```

### Send Owner Message

`POST /owner/conversations/:id/messages`

```json
{
  "content": "Please send me the latest update."
}
```

### List Owner Conversations

`GET /owner/conversations?limit=20&cursor=<cursor>`

- `limit`: optional, `1..100`
- `cursor`: optional

### List Owner Notifications

`GET /owner/notifications?unreadOnly=true&includeDismissed=false&type=OWNER_APPROVAL_REQUESTED&limit=20&cursor=<cursor>`

- `unreadOnly`: optional boolean
- `includeDismissed`: optional boolean
- `type`: optional notification type
- `limit`: optional, `1..100`
- `cursor`: optional

### Register Owner Push Device

`POST /owner/notifications/devices`

```json
{
  "provider": "FIREBASE",
  "token": "push_token",
  "platform": "ANDROID",
  "deviceId": "android-device-id",
  "appId": "com.towerdesk.owner"
}
```

`PATCH /owner/notifications/devices/:deviceId` accepts the same fields as a partial update.

### Create Owner Access Grant Invite

`POST /org/owners/:ownerId/access-grants`

```json
{
  "email": "owner@example.com"
}
```

- This is now the primary management flow.
- If the email already belongs to an active user, the backend auto-links that user and returns an `ACTIVE` grant immediately.
- If the email does not exist yet, the backend creates the owner portal user, returns a `PENDING` grant, and sends the onboarding email automatically.
- When the invited owner completes password setup, the backend auto-activates the pending grant. Management does not need to come back later with a `userId`.

### Link Existing User To Owner

`POST /org/owners/:ownerId/access-grants/link-existing-user`

```json
{
  "userId": "user_uuid"
}
```

- Keep this as a fallback admin/support tool, not the default product flow.

### Activate Pending Owner Grant

`POST /org/owners/:ownerId/access-grants/:grantId/activate`

```json
{
  "userId": "user_uuid",
  "verificationMethod": "EMAIL_MATCH"
}
```

- Keep this as a fallback admin/support tool for recovery paths. Normal invite flow should auto-activate after onboarding.

### Disable Owner Grant

`POST /org/owners/:ownerId/access-grants/:grantId/disable`

```json
{
  "verificationMethod": "MANUAL_REVIEW"
}
```

## UI / State Notes

- Owner request list items already include `ownerApproval`; the list screen does not need an extra approval-status fetch.
- Owner request comments expose only comments the owner is allowed to read.
- Owner notifications are safe to bucket by `orgId` if the UI wants grouped sections, but the backend list is still one cursor stream.
- Use unread-count endpoints for badges instead of summing unread locally from partial pages.
- Conversation unread counts are per conversation and also available as a global total from `GET /owner/conversations/unread-count`.
- Access-grant admin history is append-only. It is suitable for a timeline component.
- For normal owner access management UX, ask only for owner email. Existing-user email can come back `ACTIVE` immediately, while new-user email comes back `PENDING` until password setup completes.
- `POST /org/owners/:ownerId/access-grants/:grantId/resend-invite` now resends the real onboarding email.

## Error Expectations

- `401` for missing or invalid token.
- `403` when the route requires org permissions the caller does not have.
- `404` when the owner, grant, request, or conversation is outside the caller's accessible scope.
