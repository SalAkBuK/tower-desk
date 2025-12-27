## Notifications

GET `/notifications`
- Query: `unreadOnly=true` (optional), `cursor` (optional), `limit` (optional)
- Returns: `{ items: [{ id, type, title, body?, data, readAt?, createdAt }], nextCursor? }`
- Only returns notifications for the current user and org.

POST `/notifications/:id/read`
- Marks a single notification as read
- Returns `{ success: true }`
- 404 if the notification is not owned by the user/org

POST `/notifications/read-all`
- Marks all unread notifications for the user as read
- Returns `{ success: true }`

Notification types (maintenance requests):
- `REQUEST_CREATED`
- `REQUEST_ASSIGNED`
- `REQUEST_STATUS_CHANGED`
- `REQUEST_COMMENTED`
- `REQUEST_CANCELED`

Notification `data` payload includes:
- `requestId`, `buildingId`, `unitId`, `actorUserId`
- optional: `status`, `commentId`