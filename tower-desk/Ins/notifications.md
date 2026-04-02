# Next.js Web App: Realtime Notifications Integration

This guide shows how to connect your Next.js web app to Socket.IO
notifications and keep the UI in sync (bell badge, toast, title badge).

## What you are connecting to

- Namespace: `/notifications`
- Socket.IO path: default `/socket.io`
- Events:
  - `notifications:hello` -> `{ unreadCount }`
  - `notifications:new` -> `{ id, type, title, body, data, readAt, dismissedAt, createdAt }`
  - `notifications:read` -> `{ id, readAt }`
  - `notifications:read_all` -> `{ readAt }`
  - `notifications:dismiss` -> `{ id, dismissedAt }`
  - `notifications:undismiss` -> `{ id }`

## Install client dependency

```bash
npm install socket.io-client
```

## Socket base URL

- `NEXT_PUBLIC_WS_BASE_URL` is preferred when set.
- If unset, `NEXT_PUBLIC_API_BASE_URL` is used and `/api` or `/api/proxy` is stripped.
- Example (local): `NEXT_PUBLIC_WS_BASE_URL=http://localhost:3001`

## Connect from Next.js (client-only)

Create a client helper (already in `src/lib/notificationsSocket.ts`):

```ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const resolveNotificationsUrl = () => {
  // See src/lib/notificationsSocket.ts for full logic.
  return 'http://localhost:3001/notifications';
};

export const connectNotificationsSocket = (token: string) => {
  if (socket) return socket;

  socket = io(resolveNotificationsUrl(), {
    transports: ['websocket'],
    auth: { token },
  });

  socket.on('notifications:hello', ({ unreadCount }) => {
    console.log('unreadCount', unreadCount);
  });

  socket.on('notifications:new', (notification) => {
    console.log('notifications:new', notification);
  });

  return socket;
};

export const disconnectNotificationsSocket = () => {
  socket?.disconnect();
  socket = null;
};
```

Usage in a client component (wired in `src/components/layout/Topbar.tsx`):

```tsx
'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { connectNotificationsSocket, disconnectNotificationsSocket } from '@/lib/notificationsSocket';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;

    connectNotificationsSocket(token);

    return () => {
      disconnectNotificationsSocket();
    };
  }, [token]);

  return <>{children}</>;
}
```

## Reconnect strategy (important)

When the socket connects/reconnects, refetch unread notifications:

```
GET /api/notifications?unreadOnly=true&limit=50
```

## REST endpoints

GET `/api/notifications`
- Query: `unreadOnly=true` (optional), `includeDismissed=true` (optional), `cursor` (optional), `limit` (optional)
- Returns: `{ items: [{ id, type, title, body?, data, readAt?, createdAt }], nextCursor? }`
- Default: dismissed items are hidden unless `includeDismissed=true`

POST `/api/notifications/:id/read`
- Marks a single notification as read
- Returns `{ success: true }`

POST `/api/notifications/read-all`
- Marks all unread notifications for the user as read
- Returns `{ success: true }`
- WS emits `notifications:read` and `notifications:read_all` for UI sync

POST `/api/notifications/:id/dismiss`
- Dismisses a single notification
- Returns `{ success: true }`
- WS emits `notifications:dismiss`

POST `/api/notifications/:id/undismiss`
- Restores a dismissed notification
- Returns `{ success: true }`
- WS emits `notifications:undismiss`

## UI handling (suggested)

- On `notifications:new`, insert at the top, show toast + bell ring, and update the page title badge.
- On `notifications:read`/`notifications:read_all`, set `readAt` and remove from unread-only views.
- On `notifications:dismiss`, set `dismissedAt`; hide it by default, or show it as dimmed when `includeDismissed=true`.
- On `notifications:undismiss`, clear `dismissedAt` and restore it to the visible list/order.
 - Default UI cues are already wired in `src/components/layout/Topbar.tsx`.

## Cursor pagination (history view)

- Cursor format: base64 of `${createdAt.toISOString()}|${id}`
- Order: `createdAt DESC, id DESC`
- Example:
  ```
  GET /api/notifications?limit=20&cursor=<base64>
  ```

## Common pitfalls

- Do not connect during SSR; connect in a client component only.
- Use `auth: { token }` instead of query strings in the browser.
- If local API calls are blocked, update CSP in `next.config.ts` to allow `http://localhost:<port>` and `ws://localhost:<port>`.

## Notification types used by the contract flow

- `MOVE_IN_REQUEST_CREATED`
- `MOVE_OUT_REQUEST_CREATED`
- `REQUEST_CREATED`
- `REQUEST_ASSIGNED`
- `REQUEST_STATUS_CHANGED`
- `REQUEST_COMMENTED`
- `REQUEST_CANCELED`
