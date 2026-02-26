Portal Unification TD-142 Implement singular dynamic /portal route (replace separate admin/manager entry routes) High Auth, Routing, RBAC, UI Rendering Replace role-specific entry routes with one /portal route. On login, read user role + permission keys from auth payload/profile and dynamically render the correct portal layout, navigation, and page access based on returned entitlements. 4 Auth service returns role + keys reliably; RBAC mapping config; existing admin/manager modules componentized for conditional render 1. User always lands on /portal after login. 2. Role + keys are evaluated before portal render. 3. Only authorized modules/menu items render. 4. Unauthorized access attempts redirect to 403/safe default. 5. Existing admin and manager behavior is preserved under dynamic routing. 6. Unit/integration tests cover role/key-based rendering and route guards. To Do SALIH Include telemetry for role/key resolution failures and fallback handling.


Chunk 0 — Guardrails (tell Codex how to work)

Prompt to Codex

Work in small PR-sized commits.

Do not delete old admin/manager entry routes yet.

Keep behavior identical for existing roles until explicitly switched.

Add tests with every change.

Add telemetry hooks where role/key resolution can fail.

Prefer config-driven RBAC mapping (single source of truth).

Deliverable: a short plan + list of files it expects to touch.


Chunk 1 — Add RBAC mapping config (no routing changes)

Goal: create a single mapping from {role, permissionKeys} → {allowedModules, navItems, defaultLanding}.

Prompt to Codex

Add an RBAC config module (e.g. rbac/portalEntitlements.ts):

define module IDs

define menu/nav model

define resolveEntitlements(authPayload) returning:

effectiveRole

keys

allowedModules

defaultRoute

Add unit tests for resolveEntitlements using sample payloads:

admin with keys

manager with keys

missing role

missing keys

unknown role

Do not change any UI yet.

Acceptance: tests pass; no runtime behavior change.

Chunk 2 — Add /portal shell page (renders nothing sensitive yet)

Goal: create /portal route with a “loading/deciding” state and safe fallback.

Prompt to Codex

Add new route /portal pointing to PortalEntry component.

PortalEntry:

reads auth payload/profile (same source app uses today)

calls resolveEntitlements

shows loading until role+keys resolved

on failure: send telemetry event + redirect to safe default (or 403 if that’s the standard)

Add a simple placeholder layout (no admin/manager modules yet).

Add integration test: “user always lands on /portal after login” but keep the old routes unchanged (just test the new route exists and behaves safely).

Acceptance: /portal works, but doesn’t replace anything.

Chunk 3 — Route guards + 403 behavior

Goal: enforce “unauthorized access attempts redirect to 403/safe default”.

Prompt to Codex

Implement reusable guard helper:

withEntitlements(RouteComponent, requiredModuleOrPermission)

if not allowed → redirect to /403 (or app’s equivalent)

Add /403 route/view if missing.

Add tests:

allowed module renders

disallowed module redirects to 403

direct URL hit to protected portal sub-route redirects correctly

Acceptance: guard is in place and tested, still no module wiring.

Chunk 4 — Componentize admin/manager portals for conditional render

Goal: extract “admin portal layout” and “manager portal layout” into components that can be mounted from /portal.

Prompt to Codex

Refactor existing admin/manager entry pages into:

AdminPortalApp (layout + nav + routes)

ManagerPortalApp

Keep their internal routes the same.

Ensure both can mount under /portal without relying on their old base paths.

Add snapshot/unit tests that they render expected nav items given entitlements.

Acceptance: old routes still work, but the portal apps are now reusable components.

Chunk 5 — Wire /portal to render correct portal dynamically

Goal: actual unification: one portal route, dynamic layout/nav.

Prompt to Codex

In PortalEntry, after entitlements resolve:

if admin → render AdminPortalApp

if manager → render ManagerPortalApp

else → fallback to least-privileged view or 403

Ensure role+keys evaluated before rendering portal apps (avoid “flash” of unauthorized UI).

Add integration tests:

login as admin lands on /portal and sees admin nav

login as manager lands on /portal and sees manager nav

unauthorized module URL redirects to 403

Acceptance: dynamic render works and is covered by tests.

Chunk 6 — Switch login redirect to /portal (behind feature flag)

Goal: make “User always lands on /portal after login” true, safely.

Prompt to Codex

Add feature flag portal_unification_enabled.

If enabled: post-login redirect target is /portal.

If disabled: keep current behavior.

Telemetry:

event when role/keys missing

event when fallback path used

Add tests for both flag states.

Acceptance: can turn on for staging/users without breaking prod.

Chunk 7 — Remove old entry routes (final cleanup)

Goal: delete /admin and /manager entry routes only after verification.

Prompt to Codex

Remove/redirect old entry routes to /portal.

Keep deep links working (if /admin/something exists, redirect to /portal/something if applicable).

Update docs and any hardcoded links.

Expand integration tests for redirects.

Acceptance: no broken links; all traffic funnels through /portal.

Telemetry events to ask Codex to implement (simple + actionable)

portal_entitlements_missing_role

portal_entitlements_missing_keys

portal_entitlements_unknown_role

portal_entitlements_resolution_failed (with error)

portal_guard_blocked (module/route attempted)

portal_fallback_used (what fallback)