From @API.md, the endpoints an org admin would use to create a building (and optionally set it up with units/assignments) are:

POST /org/buildings — create a building (requires buildings.write).
GET /org/buildings — list buildings (requires buildings.read).
GET /org/buildings/:buildingId — fetch a building by id (requires buildings.read).
If the flow includes setup after creation:

POST /org/buildings/:buildingId/units — add units (requires units.write).
POST /org/buildings/:buildingId/assignments — assign manager/staff/building admin (requires building.assignments.write).
POST /org/buildings/:buildingId/occupancies or POST /org/buildings/:buildingId/residents — for resident setup (if needed).
All of these are under the /api prefix at runtime, so the full path is POST /api/org/buildings, etc.

List org users

GET /api/org/users
Auth: Authorization: Bearer <accessToken>
Permissions: users.read
Scope: org is derived from JWT (orgId); cross-org users are excluded
Response: array of UserResponseDto (id, email, name, avatarUrl, phone, isActive, orgId, mustChangePassword, createdAt, updatedAt)

reminder, we dont neet the old APIs as they are obsolete, we can remove them. and if you have further questions, please ask.
