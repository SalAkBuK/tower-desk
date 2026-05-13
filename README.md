# TowerDesk

TowerDesk is a web dashboard for building and property operations. It is a Next.js frontend that talks to a separate TowerDesk API for authentication, organizations, buildings, units, leases/contracts, residents, owners, service providers, requests, messages, notifications, parking, visitors, broadcasts, and platform administration.

This repository does not include the backend service or database schema. A working API deployment or local compatible API is required for real use.

## Demo Or Screenshot

No public demo URL is documented in this repository.

Screenshot placeholder: add a current, non-sensitive screenshot here before publishing. There are existing UI audit screenshots under `tower-desk/audit-screens/`, but they should be reviewed before using them publicly.

## Features

- Role-based dashboard routing for platform/superadmin, organization admin, manager, provider, and owner portals.
- Authentication flows for login, forgot password, reset password, and invite-based password setup.
- Organization and platform administration screens for organizations, users, permissions, delivery tasks, and buildings.
- Property operations modules for buildings, units, amenities, leases/contracts, occupancy, residents, owners, parking, visitors, broadcasts, and reports.
- Service request workflows with status queues, detail sheets, comments, attachments, provider assignment, provider portal views, and owner approval flows.
- Messaging and notification screens, including unread count handling.
- CSV import/reference assets for units and parking slots.
- Next.js API routes for selected platform proxy calls that require a server-side platform key.
- Unit test coverage for many API mappers, route helpers, render paths, and permission utilities.

## Tech Stack

- Next.js 16.1 with App Router
- React 19 and TypeScript
- Tailwind CSS 4
- shadcn/ui-style components built on Radix UI primitives
- TanStack React Query for server state
- Zustand for persisted client auth/session state
- React Hook Form and Zod for forms and validation
- Socket.IO client for realtime notification/messaging hooks
- Cloudinary unsigned uploads for some attachment/profile upload flows
- Vitest for unit tests
- Playwright for e2e tests
- Netlify configuration for deployment

## Getting Started

The application package lives in `tower-desk/`.

```bash
cd tower-desk
npm ci
```

Create a local env file. At minimum, the frontend build requires `NEXT_PUBLIC_API_BASE_URL`.

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_BASE_URL=ws://localhost:3001

# Required only for platform proxy routes.
API_BASE_URL=http://localhost:3001/api
API_PROXY_TARGET=http://localhost:3001/api
PLATFORM_API_KEY=replace-with-a-server-side-platform-key

# Optional local debugging/tuning.
NEXT_PUBLIC_AUTH_RESTORE_TIMEOUT_MS=12000
NEXT_PUBLIC_AUTH_REQUEST_TIMEOUT_MS=8000
NEXT_PUBLIC_DEBUG_AUTH=false
```

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

On Windows PowerShell, this machine blocks `npm.ps1` via execution policy. Use `npm.cmd` instead if plain `npm` fails:

```bash
npm.cmd run dev
```

## Available Scripts

Run these from `tower-desk/`.

```bash
npm run dev              # Start the Next.js development server
npm run build            # Build the production Next.js app using webpack
npm run start            # Serve a built app
npm run lint             # Run ESLint
npm run security:check   # Custom React/Next security version check
npm run test:unit        # Run Vitest unit tests
npm run test:e2e         # Run Playwright e2e tests
```

## Project Structure

```text
.
|-- APIS/                         # Backend API notes and handoff docs; contains old/private-looking endpoint examples
|-- awesome-design-md/            # Git submodule pointing at VoltAgent/awesome-design-md
|-- netlify.toml                  # Netlify build and security header config
|-- parking_slots_import_template.csv
|-- units_import_reference.csv
|-- units_template.csv
`-- tower-desk/
    |-- src/app/                  # Next.js app routes, auth pages, dashboards, API proxy routes
    |-- src/components/           # Feature and UI components
    |-- src/lib/                  # API clients, query hooks, auth, RBAC, utilities, types
    |-- public/                   # Static assets, fonts, CSV templates
    |-- tests/unit/               # Vitest unit tests
    |-- tests/e2e/                # Playwright tests
    |-- scripts/                  # Maintenance/security scripts
    |-- Ins/                      # Internal implementation notes and UI/API handoff docs
    |-- audit-screens/            # UI audit screenshots
    `-- package.json
```

## Current Status

This is an active frontend application, not a polished public starter project. It has substantial product surface area and a real test suite, but it depends heavily on a private or external API contract that is not shipped here.

Current audit results:

- `npm ci` from a tracked-file fresh copy installs successfully.
- `npm run build` passes in the current working tree when local env files are present.
- `npm run build` fails from a clean tracked-file copy unless `NEXT_PUBLIC_API_BASE_URL` is supplied.
- `npm run security:check` passes, but it only checks a narrow set of React/Next versions.
- `npm audit --audit-level=moderate` currently reports dependency vulnerabilities.
- `npm run lint` fails on one ESLint error and reports hundreds of warnings.
- `npm run test:unit` currently has one failing test.

## Known Limitations

- The backend API, database, seed data, and auth credentials are not included.
- A fresh clone needs environment variables before it can build or run correctly.
- Several docs under `APIS/` and `tower-desk/Ins/` reference old backend hosts, internal implementation notes, and API examples. Review or remove/redact them before making the repository public.
- `APIS/manager-APIS.md` contains a checked-in JWT example. Even if expired, it should be removed from public history before publication.
- Ignored local files exist in this working tree, including env files and a local testing credential JSON. They are not tracked, but they must not be included in any manual zip or release bundle.
- Cloudinary configuration is hardcoded in `tower-desk/src/lib/cloudinary.ts` as an unsigned upload preset. Confirm that this preset is intentionally public and locked down before release.
- Auth tokens are persisted in local storage. That may be acceptable for this app, but it is a real security tradeoff and should be reviewed for the deployment threat model.
- `node_modules`, `.next`, TypeScript build info, and local env files are ignored, but generated artifacts such as screenshots, temporary Stitch output, and test result metadata are currently tracked.
- No repository-level license file is present.

## Lessons Learned

- Keep generated files, local testing artifacts, and internal handoff material out of the public repository boundary.
- Treat frontend API docs as sensitive when they include real hosts, user emails, tokens, or operational details.
- Make required environment variables explicit early; this app fails during prerendering without API configuration.
- A custom security script is useful, but it does not replace `npm audit`, dependency maintenance, or framework patching.
- Contract-heavy frontends need either a public mock API, sample data mode, or a clearly documented backend setup to be useful from a fresh clone.

## License

No license is currently declared for this repository. Do not assume reuse rights until a license file is added by the owner.
