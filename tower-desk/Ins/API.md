# Towerdesk Backend API (Frontend Guide)

Base URL (local):
- `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`

Auth headers:
- Most endpoints: `Authorization: Bearer <accessToken>`
- Platform endpoints: `x-platform-key: <PLATFORM_API_KEY>`

Common behaviors:
- Org-scoped routes (`/org/*`) require `req.user.orgId` from JWT. Missing org -> 403.
- Cross-org access returns 404 (do not leak existence).
- Building-scoped routes allow access via global RBAC permissions OR building assignment.
  - READ: STAFF, MANAGER, BUILDING_ADMIN
  - WRITE: BUILDING_ADMIN, or explicit global permission
  - Managers can WRITE on specific endpoints that explicitly allow manager write (e.g., units create, assignments, residents, request assign).
- Platform superadmin can act in an org by sending `x-org-id: <orgId>` on `/org/*` requests (token `orgId` is null by design).

## Auth

POST `/auth/register`
- Body: `{ email, password, name? }`
- Returns: `{ accessToken, refreshToken, user }`

POST `/auth/login`
- Body: `{ email, password }`
- Returns: `{ accessToken, refreshToken, user }` (user includes `roleKeys` when assigned)

POST `/auth/refresh`
- Body: `{ refreshToken }`
- Returns: `{ accessToken, refreshToken, user }`

POST `/auth/change-password`
- Body: `{ currentPassword, newPassword }`
- Returns: `{ success: true }`
- Requires `Authorization: Bearer <accessToken>`

## Health

GET `/health`
- Returns: `{ status: "ok", timestamp }`

## Platform (requires `x-platform-key`)

GET `/platform/orgs`
- Returns list of orgs
- Requires `platform.org.read` when using JWT

POST `/platform/orgs`
- Body:
  ```
  {
    "name": "Towerdesk Inc.",
    "businessName": "Towerdesk Management LLC",
    "businessType": "PROPERTY_MANAGEMENT",
    "tradeLicenseNumber": "TL-12345",
    "vatRegistrationNumber": "VAT-12345",
    "registeredOfficeAddress": "123 Main St",
    "city": "Dubai",
    "officePhoneNumber": "+971-4-555-0100",
    "businessEmailAddress": "info@towerdesk.com",
    "website": "https://towerdesk.com",
    "ownerName": "Jane Founder"
  }
  ```
- Returns: `{ id, name, createdAt }`

GET `/platform/orgs/:orgId/admins`
- Returns list of org admins for the org
- Requires `platform.org.admin.read` when using JWT

POST `/platform/orgs/:orgId/admins`
- Body: `{ name, email, password? }`
- Returns: `{ userId, email, tempPassword?, mustChangePassword: true }`

GET `/platform/org-admins`
- Returns all org admins across orgs
- Requires `platform.org.admin.read` when using JWT

Authorization options:
- `x-platform-key: <PLATFORM_API_KEY>` (platform key), OR
- `Authorization: Bearer <accessToken>` for a platform superadmin user with:
  - `platform.org.read` for listing orgs
  - `platform.org.create` for org creation
  - `platform.org.admin.read` for listing org admins
  - `platform.org.admin.create` for org admin creation

## Users

GET `/users/me`
- Returns current user
- Requires `users.read`
 - Response includes `roleKeys` when assigned

GET `/users/me/assignments`
- Returns building assignments for the current user
- Example response: `[{ "buildingId": "uuid", "buildingName": "Central Tower", "type": "MANAGER" }]`

GET `/users/:id`
- Returns user by id
- Requires `users.read`

POST `/users`
- Body: `{ name, email, password?, roleKeys? }`
- Requires `users.write`
- Creates a user in the caller's org (orgId derived from JWT)
- If `password` is omitted, a temporary password is generated and returned
- `roleKeys` can include `admin`, `org_admin`, `viewer` (not `super_admin`)
- Manager/staff are assigned per building via `/org/buildings/:buildingId/assignments`
- Tenants should be onboarded via `/org/buildings/:buildingId/residents`

GET `/org/users`
- Requires `users.read`
- Returns all users in the caller's org
- Response includes `roleKeys` (org roles) for each user
- Example:
  ```
  fetch(`${baseUrl}/org/users`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  ```

POST `/org/users/provision`
- Requires `users.write` (org-scoped) or a building manager assignment (see Notes)
- One-stop provision: create-or-link a user and apply org roles, building assignments, and/or residency in a single transaction (idempotent).
- Body:
  ```
  {
    "identity": {
      "email": "jane@org.com",
      "name": "Jane Admin",
      "password": "optional",
      "sendInvite": true
    },
    "grants": {
      "orgRoleKeys": ["admin", "org_admin"],
      "buildingAssignments": [
        { "buildingId": "uuid", "type": "MANAGER" }
      ],
      "resident": { "buildingId": "uuid", "unitId": "uuid", "mode": "ADD" }
    },
    "mode": {
      "ifEmailExists": "LINK",
      "requireSameOrg": true
    }
  }
  ```
- Notes:
  - `email` is required and normalized to lowercase.
  - When creating: require `password` or `sendInvite=true`.
  - Unknown role keys -> 400.
  - `resident.mode` can be `ADD` or `MOVE` (MOVE ends other ACTIVE occupancies in the same building).
  - Managers without `users.write` can only provision MANAGER/STAFF assignments and/or residents in their assigned buildings. `orgRoleKeys` is not allowed and `requireSameOrg` is enforced.
- Returns:
  ```
  {
    "user": { "id": "uuid", "email": "jane@org.com", "name": "Jane Admin" },
    "created": true,
    "linkedExisting": false,
    "applied": {
      "orgRoleKeys": ["admin"],
      "buildingAssignments": [{ "id": "uuid", "buildingId": "uuid", "type": "MANAGER" }],
      "resident": { "occupancyId": "uuid", "unitId": "uuid", "buildingId": "uuid" }
    }
  }
  ```

## Access Control (roles/permissions)

GET `/permissions`
- Requires `roles.read`

GET `/roles`
- Requires `roles.read`

POST `/roles`
- Body: `{ key, name, description? }`
- Requires `roles.write`

POST `/roles/:roleId/permissions`
- Body: `{ permissionKeys: string[], mode?: "add"|"replace" }`
- Requires `roles.write`

POST `/users/:userId/roles`
- Body: `{ roleIds: string[], mode?: "add"|"replace" }`
- Requires `users.write`

POST `/users/:userId/permissions`
- Body: `{ overrides: [{ permissionKey, effect: "ALLOW"|"DENY" }] }`
- Requires `users.write`

## Buildings (org-scoped)

POST `/org/buildings`
- Body: `{ name }`
- Requires `buildings.write`

GET `/org/buildings`
- Requires `buildings.read`

GET `/org/buildings/assigned`
- Returns buildings where the current user has a building assignment
- Org-scoped (requires JWT with orgId)

GET `/org/buildings/:buildingId`
- Requires `buildings.read`
- Access via global permission OR building assignment

## Units (building-scoped)

POST `/org/buildings/:buildingId/units`
- Body:
  ```
  {
    "label": "A-101",
    "floor": 1,
    "notes": "Near elevator",
    "unitTypeId": "uuid",
    "ownerId": "uuid",
    "maintenancePayer": "OWNER",
    "unitSize": 950,
    "unitSizeUnit": "SQ_FT",
    "bedrooms": 2,
    "bathrooms": 2,
    "balcony": true,
    "kitchenType": "OPEN",
    "furnishedStatus": "FULLY_FURNISHED",
    "rentAnnual": 120000,
    "paymentFrequency": "MONTHLY",
    "securityDepositAmount": 5000,
    "serviceChargePerUnit": 1500,
    "vatApplicable": true,
    "electricityMeterNumber": "ELEC-123",
    "waterMeterNumber": "WATER-456",
    "gasMeterNumber": "GAS-789",
    "amenityIds": ["uuid"]
  }
  ```
- Requires `units.write`
- Building managers assigned to the building can create units.

GET `/org/buildings/:buildingId/units`
- Query: `available=true` (optional)
- Requires `units.read`
- Returns minimal unit fields (full details available via unit detail endpoint)

GET `/org/buildings/:buildingId/units/:unitId`
- Requires `units.read`
- Returns full unit record including new fields
  - Example:
    ```
    {
      "id": "uuid",
      "buildingId": "uuid",
      "label": "A-101",
      "unitTypeId": "uuid",
      "ownerId": "uuid",
      "maintenancePayer": "OWNER",
      "floor": 1,
      "notes": "Near elevator",
      "unitSize": "950",
      "unitSizeUnit": "SQ_FT",
      "bedrooms": 2,
      "bathrooms": 2,
      "balcony": true,
      "kitchenType": "OPEN",
      "furnishedStatus": "FULLY_FURNISHED",
      "rentAnnual": "120000",
      "paymentFrequency": "MONTHLY",
      "securityDepositAmount": "5000",
      "serviceChargePerUnit": "1500",
      "vatApplicable": true,
      "electricityMeterNumber": "ELEC-123",
      "waterMeterNumber": "WATER-456",
      "gasMeterNumber": "GAS-789",
      "amenityIds": ["uuid"],
      "amenities": [{ "id": "uuid", "name": "Balcony" }],
      "createdAt": "2025-12-25T19:40:44.583Z",
      "updatedAt": "2025-12-25T19:40:44.583Z"
    }
    ```

PATCH `/org/buildings/:buildingId/units/:unitId`
- Body: same optional fields as create
- Requires `units.write`
 - Returns: same as unit detail

GET `/org/buildings/:buildingId/units/basic`
- Resident-safe list (id + label only)
- Requires `units.read` but allows ACTIVE resident occupancy

GET `/org/buildings/:buildingId/units/count`
- Returns `{ total: number, vacant: number }`
- Requires `units.read`

## Building Amenities (building-scoped)

GET `/org/buildings/:buildingId/amenities`
- Returns list of amenities for the building
- Requires `buildings.read`

POST `/org/buildings/:buildingId/amenities`
- Body: `{ name, isDefault?, isActive? }`
- Requires `buildings.write`

PATCH `/org/buildings/:buildingId/amenities/:amenityId`
- Body: `{ name?, isDefault?, isActive? }`
- Requires `buildings.write`

Amenity defaults for unit creation:
- If `amenityIds` is omitted, defaults are auto-assigned from active amenities with `isDefault=true`.
- If `amenityIds: []`, no amenities are assigned.

## Unit Types (org-scoped)

GET `/org/unit-types`
- Returns active unit types
- Requires `unitTypes.read`

POST `/org/unit-types`
- Body: `{ name, isActive? }`
- Requires `unitTypes.write`

## Owners (org-scoped)

GET `/org/owners`
- Query: `search` (optional)
- Returns owners in the org
- Requires `owners.read`

POST `/org/owners`
- Body: `{ name, email?, phone?, address? }`
- Requires `owners.write`

## Building Assignments (building-scoped)

POST `/org/buildings/:buildingId/assignments`
- Body: `{ userId, type: "MANAGER"|"STAFF"|"BUILDING_ADMIN" }`
- Requires `building.assignments.write`
- Building managers assigned to the building can create assignments.

GET `/org/buildings/:buildingId/assignments`
- Requires `building.assignments.read`

## Occupancies (building-scoped)

POST `/org/buildings/:buildingId/occupancies`
- Body: `{ unitId, residentUserId }`
- Requires `occupancy.write`
- 409 if unit already occupied

GET `/org/buildings/:buildingId/occupancies`
- Requires `occupancy.read`

GET `/org/buildings/:buildingId/occupancies/count`
- Returns `{ active: number }`
- Requires `occupancy.read`

## Residents (building-scoped)

POST `/org/buildings/:buildingId/residents`
- Body: `{ name, email, phone?, password?, unitId }`
- Requires `residents.write`
- Creates User + ACTIVE Occupancy atomically
- Returns `{ userId, name, email, phone?, unit: { id, label }, buildingId, tempPassword?, mustChangePassword: true }`
- 400 if unitId not in building, 409 if unit occupied
- Building managers assigned to the building can create residents.

GET `/org/buildings/:buildingId/residents`
- Requires `residents.read`
- Returns list with: `{ userId, name, email, unit { id, label }, status, startAt, endAt }`

## Resident Profile (self)

GET `/resident/me`
- Returns the current user (with phone if stored) and their ACTIVE occupancy (building + unit).
- `occupancy` is null when the user is not assigned to a unit.

## Maintenance Requests (resident)

POST `/resident/requests`
- Body: `{ title, description?, type?, priority?, attachments?: [{ fileName, mimeType, sizeBytes, url }] }`
- Uses resident ACTIVE occupancy to select building/unit
  - `type` values: `CLEANING` | `ELECTRICAL` | `MAINTENANCE` | `PLUMBING_AC_HEATING` | `OTHER`
  - `priority` values: `LOW` | `MEDIUM` | `HIGH`

GET `/resident/requests`
- Lists requests created by the resident (includes `attachments` when present)

GET `/resident/requests/:requestId`
- Get request detail (resident only)

PATCH `/resident/requests/:requestId`
- Body: `{ title?, description? }`
- Only allowed while status is OPEN

POST `/resident/requests/:requestId/cancel`
- Cancels request unless already COMPLETED/CANCELED

POST `/resident/requests/:requestId/comments`
- Body: `{ message }`
- Allowed until COMPLETED (CANCELED blocked)

GET `/resident/requests/:requestId/comments`
- Lists comments for resident's request

## Maintenance Requests (building ops)

GET `/org/buildings/:buildingId/requests`
- Query: `status=OPEN|ASSIGNED|IN_PROGRESS|COMPLETED|CANCELED` (optional)
- Requires `requests.read` OR building assignment read access
- STAFF without `requests.read` only sees requests assigned to them
- Includes `unit` (with `floor`), `createdBy`, and `attachments` when present

GET `/org/buildings/:buildingId/requests/:requestId`
- Same access rules as list
- Includes `unit` (with `floor`) and `attachments` when present

POST `/org/buildings/:buildingId/requests/:requestId/assign`
- Body: `{ staffUserId }`
- Requires `requests.assign` OR BUILDING_ADMIN assignment
- Building managers assigned to the building can assign requests.
- Allows re-assigning while status is `ASSIGNED`.
- Staff cannot assign

POST `/org/buildings/:buildingId/requests/:requestId/status`
- Body: `{ status: "IN_PROGRESS" | "COMPLETED" }`
- STAFF allowed only when assigned to the request
- Managers allowed
- BUILDING_ADMIN allowed

POST `/org/buildings/:buildingId/requests/:requestId/cancel`
- Cancels a request (blocked if COMPLETED/CANCELED)
- STAFF cannot cancel

POST `/org/buildings/:buildingId/requests/:requestId/attachments`
- Body: `{ attachments: [{ fileName, mimeType, sizeBytes, url }] }`
- Adds attachments to the request (blocked if COMPLETED/CANCELED)
- Same access rules as comments (staff only if assigned)

POST `/org/buildings/:buildingId/requests/:requestId/comments`
GET `/org/buildings/:buildingId/requests/:requestId/comments`
- Managers/BUILDING_ADMIN can comment
- STAFF only if assigned to the request
- Org admins rely on `requests.comment` when not assigned

## Notifications

GET `/notifications`
  - Query: `unreadOnly=true` (optional), `includeDismissed=true` (optional), `cursor` (optional), `limit` (optional)
  - Returns: `{ items: [{ id, type, title, body?, data, readAt?, dismissedAt?, createdAt }], nextCursor? }`
  - `limit` defaults to 20, max 100
  - Cursor format: base64 of `${createdAt.toISOString()}|${id}`
- Only returns notifications for the current user and org.

POST `/notifications/:id/read`
  - Marks a single notification as read
  - Returns `{ success: true }`
  - 404 if the notification is not owned by the user/org

POST `/notifications/:id/dismiss`
  - Hides a single notification for the current user
  - Returns `{ success: true }`
  - 404 if the notification is not owned by the user/org

POST `/notifications/:id/undismiss`
  - Restores a dismissed notification for the current user
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

## Org Profile

GET `/org/profile`
- Returns `{ id, name, logoUrl, businessName?, businessType?, tradeLicenseNumber?, vatRegistrationNumber?, registeredOfficeAddress?, city?, officePhoneNumber?, businessEmailAddress?, website?, ownerName? }`
- Any authenticated user in the org

PATCH `/org/profile`
- Body:
  ```
  {
    "name": "Towerdesk Inc.",
    "logoUrl": "https://example.com/logo.png",
    "businessName": "Towerdesk Management LLC",
    "businessType": "PROPERTY_MANAGEMENT",
    "tradeLicenseNumber": "TL-12345",
    "vatRegistrationNumber": "VAT-12345",
    "registeredOfficeAddress": "123 Main St",
    "city": "Dubai",
    "officePhoneNumber": "+971-4-555-0100",
    "businessEmailAddress": "info@towerdesk.com",
    "website": "https://towerdesk.com",
    "ownerName": "Jane Founder"
  }
  ```
- Requires `org.profile.write`

## User Profile (self)

PATCH `/users/me/profile`
- Body: `{ name?, avatarUrl?, phone? }`
- Updates only the current user

Cloudinary unsigned upload (frontend):
1) Upload directly to Cloudinary (cloud name: `dzxeljant`) using an unsigned preset.
2) Use the returned `secure_url` as `logoUrl` or `avatarUrl`.

## Error codes quick reference
- 400: bad request / validation error (e.g., unit mismatch)
- 401: unauthenticated
- 403: org scope missing or insufficient permissions (in-org)
- 404: cross-org resource not found
- 409: conflict (e.g., unit already occupied, duplicate)

## Frontend integration checklist
- Use `GET /org/unit-types` (org-scoped) for unit type dropdowns.
- Use `GET /org/owners` (org-scoped) for owner dropdowns/search.
- Use `GET /org/buildings/:buildingId/amenities` (building-scoped) for amenity options.
- `POST /org/buildings/:buildingId/units` accepts `amenityIds`.
  - Omit `amenityIds` to auto-apply active defaults (`isDefault=true`).
  - Send `amenityIds: []` to intentionally assign none.
- `GET /org/buildings/:buildingId/units/:unitId` returns `amenityIds` and `amenities`.
- Unit list and `/basic` remain minimal (no amenities).
- Decimal fields in unit responses are strings (`"120000"`), not numbers.
