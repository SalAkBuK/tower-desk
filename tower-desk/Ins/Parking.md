Parking Module - Frontend Integration Guide
Overview
The backend has a complete parking management system with 3 main features:

Parking Slots - Define parking spaces in buildings
Parking Allocations - Assign slots to tenants (occupancies)
Vehicles - Register vehicle information for tenants
All endpoints are under /api/org/* and require JWT authentication with org-scoped permissions.

Authentication
All requests require:

Authorization: Bearer <accessToken> header
User must belong to an organization
User must have the required permissions (see each endpoint)
Data Models

// Parking Slot
interface ParkingSlot {
  id: string;
  buildingId: string;
  code: string;              // e.g., "A-01", "B-23"
  level: string | null;      // e.g., "Ground", "Level 2"
  type: 'CAR' | 'BIKE' | 'EV';
  isCovered: boolean;
  isActive: boolean;
  createdAt: string;         // ISO date
}

// Parking Allocation
interface ParkingAllocation {
  id: string;
  buildingId: string;
  occupancyId: string;
  parkingSlotId: string;
  startDate: string;         // ISO date
  endDate: string | null;    // null = active allocation
  slot: {                    // Included in responses
    id: string;
    code: string;
    level: string | null;
    type: 'CAR' | 'BIKE' | 'EV';
  };
}

// Vehicle
interface Vehicle {
  id: string;
  occupancyId: string;
  plateNumber: string;       // Unique per org
  label: string | null;      // e.g., "John's BMW"
  createdAt: string;         // ISO date
}
API Endpoints
1. Parking Slots
Create Parking Slot

POST /api/org/buildings/:buildingId/parking-slots
Permission: parkingSlots.create

Request Body:
{
  "code": "A-01",
  "type": "CAR",        // CAR | BIKE | EV
  "level": "Ground",    // optional
  "isCovered": false    // optional, default false
}

Response: 201
{
  "id": "...",
  "buildingId": "...",
  "code": "A-01",
  "level": "Ground",
  "type": "CAR",
  "isCovered": false,
  "isActive": true,
  "createdAt": "2024-01-23T..."
}
List Parking Slots

GET /api/org/buildings/:buildingId/parking-slots?available=true
Permission: parkingSlots.read

Query Params:
- available (optional): true = only show unallocated slots

Response: 200
[
  {
    "id": "...",
    "buildingId": "...",
    "code": "A-01",
    "level": "Ground",
    "type": "CAR",
    "isCovered": false,
    "isActive": true,
    "createdAt": "2024-01-23T..."
  }
]
Update Parking Slot

PATCH /api/org/parking-slots/:slotId
Permission: parkingSlots.update

Request Body: (all fields optional)
{
  "code": "A-02",
  "level": "Level 1",
  "type": "EV",
  "isCovered": true,
  "isActive": false
}

Response: 200
{ ... updated slot ... }
2. Parking Allocations
Allocate Parking Slots (Manual Selection)

POST /api/org/buildings/:buildingId/parking-allocations
Permission: parkingAllocations.create

Request Body:
{
  "occupancyId": "...",
  "slotIds": ["slot-id-1", "slot-id-2"]  // Manually selected slots
}

Response: 201
[
  {
    "id": "...",
    "buildingId": "...",
    "occupancyId": "...",
    "parkingSlotId": "slot-id-1",
    "startDate": "2024-01-23T...",
    "endDate": null,
    "slot": {
      "id": "slot-id-1",
      "code": "A-01",
      "level": "Ground",
      "type": "CAR"
    }
  }
]

Errors:
- 409: One or more slots already allocated
- 404: Slot not found or occupancy not found
Allocate Parking Slots (Auto Selection)

POST /api/org/buildings/:buildingId/parking-allocations
Permission: parkingAllocations.create

Request Body:
{
  "occupancyId": "...",
  "count": 2              // Auto-select 2 available slots
}

Response: 201
[... 2 allocations ...]

Errors:
- 409: Not enough available slots
End Single Allocation

POST /api/org/parking-allocations/:allocationId/end
Permission: parkingAllocations.end

Request Body: (optional)
{
  "endDate": "2024-01-25T00:00:00Z"  // optional, defaults to now
}

Response: 201
{
  "id": "...",
  "endDate": "2024-01-25T...",
  ...
}

Errors:
- 400: Allocation already ended
- 404: Allocation not found
End All Allocations for Occupancy

POST /api/org/occupancies/:occupancyId/parking-allocations/end-all
Permission: parkingAllocations.end

Request Body: (optional)
{
  "endDate": "2024-01-25T00:00:00Z"  // optional, defaults to now
}

Response: 201
{
  "ended": 2  // Number of allocations ended
}
List Allocations for Occupancy

GET /api/org/occupancies/:occupancyId/parking-allocations?active=true
Permission: parkingAllocations.read

Query Params:
- active (optional): true = only active (endDate null), false = only ended, omit = all

Response: 200
[
  {
    "id": "...",
    "occupancyId": "...",
    "startDate": "2024-01-23T...",
    "endDate": null,
    "slot": {
      "id": "...",
      "code": "A-01",
      "level": "Ground",
      "type": "CAR"
    }
  }
]
3. Vehicles
Create Vehicle

POST /api/org/occupancies/:occupancyId/vehicles
Permission: vehicles.create

Request Body:
{
  "plateNumber": "ABC-1234",
  "label": "John's Car"      // optional
}

Response: 201
{
  "id": "...",
  "occupancyId": "...",
  "plateNumber": "ABC-1234",
  "label": "John's Car",
  "createdAt": "2024-01-23T..."
}

Errors:
- 409: Plate number already exists in org
- 404: Occupancy not found
List Vehicles for Occupancy

GET /api/org/occupancies/:occupancyId/vehicles
Permission: vehicles.read

Response: 200
[
  {
    "id": "...",
    "occupancyId": "...",
    "plateNumber": "ABC-1234",
    "label": "John's Car",
    "createdAt": "2024-01-23T..."
  }
]
Update Vehicle

PATCH /api/org/vehicles/:vehicleId
Permission: vehicles.update

Request Body: (all fields optional)
{
  "plateNumber": "XYZ-5678",
  "label": "Jane's Car"
}

Response: 200
{ ... updated vehicle ... }

Errors:
- 409: Plate number already exists in org
- 404: Vehicle not found
Delete Vehicle

DELETE /api/org/vehicles/:vehicleId
Permission: vehicles.delete

Response: 200
{
  "success": true
}

Errors:
- 404: Vehicle not found
Common User Flows
Flow 1: Onboard New Tenant with Parking

// 1. Create occupancy (from residents module)
POST /api/org/buildings/:buildingId/residents
{ name, email, unitId }

// 2. Get available parking slots
GET /api/org/buildings/:buildingId/parking-slots?available=true

// 3. Allocate parking (auto or manual)
POST /api/org/buildings/:buildingId/parking-allocations
{ occupancyId, count: 1 }  // or slotIds: ["..."]

// 4. Register vehicle
POST /api/org/occupancies/:occupancyId/vehicles
{ plateNumber: "ABC-1234", label: "Resident's Car" }
Flow 2: Move-Out Tenant

// 1. End all parking allocations
POST /api/org/occupancies/:occupancyId/parking-allocations/end-all
{}

// 2. Optionally delete vehicles
DELETE /api/org/vehicles/:vehicleId
Flow 3: Building Manager Dashboard

// Show all slots with allocation status
GET /api/org/buildings/:buildingId/parking-slots

// Show only available slots
GET /api/org/buildings/:buildingId/parking-slots?available=true

// For each occupied slot, show tenant info via allocations
GET /api/org/occupancies/:occupancyId/parking-allocations?active=true
Permission Requirements
Users need these permissions (typically granted to org_admin role):

Parking Slots:

parkingSlots.create
parkingSlots.read
parkingSlots.update
Allocations:

parkingAllocations.create
parkingAllocations.read
parkingAllocations.end
Vehicles:

vehicles.create
vehicles.read
vehicles.update
vehicles.delete
Implementation Notes
Slot Availability: A slot is "available" if it has no active allocation (endDate is null)
Allocation Atomicity: Manual allocations are all-or-nothing. If any slot is already allocated, the entire request fails with 409
Vehicle Uniqueness: Plate numbers must be unique per organization
Occupancy Validation: All endpoints validate that the occupancy belongs to the user's org
No Vehicle-Slot Mapping: Vehicles are informational only and not linked to specific slots
Error Handling
All endpoints return standard HTTP status codes:

200/201: Success
400: Bad request (invalid payload, allocation already ended)
403: Missing permissions
404: Resource not found (org-scoped)
409: Conflict (slot already allocated, plate number exists, not enough slots)
500: Server error
Error response format:


{
  "statusCode": 409,
  "message": "One or more slots are already allocated",
  "error": "Conflict"
}