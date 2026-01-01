You are the Frontend Agent. We need to debug a confusing auth/redirect flow in our Next.js (app router) portal.

### Symptom (from dev server logs)
User tries:
- GET /admin/buildings 200
Then gets redirected repeatedly:
- GET /403 200 (multiple times)
User clicks “Take me home” on /403 and suddenly lands in manager portal:
- GET / 200
- GET /manager/requests 200 (twice)

So: `/admin/buildings -> /403 -> (home) / -> /manager/requests`

### Goal
Add **high-signal logs + correlation IDs** across:
1) middleware redirects
2) route guards (client/server)
3) role-based “home” routing logic
4) 403 page “Take me home” button handler
5) any auth/session fetching (token, user, roles, org/tenant)

We want to answer:
- Who initiated the redirect to `/403` (middleware vs client guard vs server component)?
- Why did “home” route to manager portal (role-based redirect? default route? stale role cache)?
- Are we reading permissions from JWT vs API `/me` vs cookies? Any mismatch?

### Implementation Requirements
**A) Create a request/trace id**
- In `middleware.ts`, generate a `traceId` (uuid or short random) per request.
- Add it to headers: `x-trace-id`, and also set a cookie like `td_trace_id` (short-lived ok).
- Ensure the traceId is accessible on the client (cookie is fine) to include in console logs.

**B) Middleware logging**
In `middleware.ts`:
- Log: traceId, pathname, method, result (ALLOW / REDIRECT / REWRITE), and redirect target.
- Log the auth inputs it used (without secrets): isLoggedIn boolean, hasToken boolean, orgId, role(s), permission keys summary.
- If it calls any helper like `getSession()` / `decodeJWT()`, log which path was used.

Example log format (consistent!):
`[AUTH][MW][${traceId}] path=/admin/buildings decision=REDIRECT target=/403 roles=... orgId=... reason=missing_permission:admin.read`

**C) Client-side navigation logging**
Add a small `useNavigationLogger()` hook in the root layout or a top-level provider:
- Logs route changes and the reason if known.
- On every navigation, log: traceId, from, to, and current auth snapshot (roles/orgId).
- Use `usePathname()` and `useSearchParams()` and `router.events` equivalent for App Router (or `useEffect` on pathname changes).

**D) Guard logging**
Wherever we enforce role/permission checks (HOC, wrapper, server component guard, `redirect()` usage):
- Log BEFORE redirect/deny: traceId, required permission/role, actual permission/role, and where this guard runs (server/client).
- If server component uses `redirect()`, also write a log on server with same traceId (read from cookie/header).

**E) 403 Page instrumentation**
On `/403` page:
- Log on mount: traceId, referrer/previous path if available, and query params.
- Update “Take me home” click handler to log:
  - traceId
  - chosen destination
  - the decision logic (e.g., “role=MANAGER so home=/manager/requests”)
- If it calls a helper like `getDefaultHomeRoute(user)`, add logs inside that helper.

**F) API/Auth fetch logging**
If frontend calls `/api/me`, `/api/session`, etc:
- Intercept fetch (wrapper) and log for relevant endpoints:
  - traceId, url, status, and whether response caused redirect decision.
- If token refresh exists, log refresh attempts and outcomes.

**G) Output**
1) Identify the exact files to change (middleware, auth provider, guard util, 403 page, home routing util).
2) Implement logs with a `DEBUG_AUTH=true` env flag so we can turn it on/off.
3) After changes, tell me the exact expected log lines for the problematic flow:
   `/admin/buildings -> /403 -> home -> / -> /manager/requests`

### Notes
- Don’t log secrets (full tokens). If needed, log only token presence + last 6 chars.
- Keep logs structured and grep-friendly.
- If there are multiple role sources (JWT claims vs API), log both and flag mismatch.

Start by scanning the current codebase for:
- `middleware.ts`
- any `redirect('/403')`, `notFound()`, `unauthorized`, `permission`, `role`
- “home” routing logic
Then implement the instrumentation described above.
