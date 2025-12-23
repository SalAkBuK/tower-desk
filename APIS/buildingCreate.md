curl -X 'POST' \
  'http://16.171.240.211/api/Buildings/create' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "name": "string",
  "address": "string",
  "city": "string",
  "unitsCount": 2147483647
}'

{
  "success": true,
  "message": "Building created successfully",
  "data": {
    "id": 24,
    "name": "string",
    "address": "string",
    "city": "string",
    "unintsCount": 2147483647,
    "isActive": true,
    "createdAt": "2025-12-20T13:38:38.4748592Z",
    "buildingAdmins": [],
    "buildingManagers": [],
    "buildingServiceProviders": [],
    "buildingMaintenanceStaff": [],
    "maintenanceRequests": []
  }
}


curl -X 'PUT' \
  'http://16.171.240.211/api/Buildings/update/2' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "name": "string",
  "address": "string",
  "city": "string",
  "unitsCount": 2147483647
}'

	
Response body
Download
{
  "success": true,
  "message": "Building updated successfully",
  "data": {
    "id": 2,
    "name": "string",
    "address": "string",
    "city": "string",
    "unintsCount": 2147483647,
    "isActive": false,
    "createdAt": "2025-12-13T10:05:47.4528315",
    "buildingAdmins": [],
    "buildingManagers": [],
    "buildingServiceProviders": [],
    "buildingMaintenanceStaff": [],
    "maintenanceRequests": []
  }
}


curl -X 'GET' \
  'http://16.171.240.211/api/Buildings/get/22' \
  -H 'accept: */*'

Response body
Download
{
  "success": true,
  "data": {
    "id": 22,
    "name": "Building2",
    "address": "Dubai distric, Abu Dhabi",
    "city": "Abu Dhabi",
    "unintsCount": 23,
    "isActive": true,
    "createdAt": "2025-12-18T20:34:32.5792125"
  }
}


curl -X 'GET' \
  'http://16.171.240.211/api/Buildings/getall-by-admin/86' \
  -H 'accept: */*'

  	
Response body
Download
{
  "success": true,
  "data": [
    {
      "id": 21,
      "name": "Building1",
      "address": "1, 101 Street, UAE, Abu Dhabi",
      "city": "Abu Dhabi",
      "unintsCount": 50,
      "isActive": true,
      "createdAt": "2025-12-18T17:31:14.7894059"
    },


    curl -X 'DELETE' \
  'http://16.171.240.211/api/Buildings/delete/22' \
  -H 'accept: */*'

  	
Response body
Download
{
  "success": true,
  "message": "Building deactivated successfully"
}



In the Buildings tab make a button for Create Building, and use the create building api to create it, then show a list of admins that dont have a building assigned to them, and make a button for each admin to assign them to the building, and use the assign admin to building api to assign them to the building.


here is the api for linking the admin to the building they created 

curl -X 'POST' \
  'http://16.171.240.211/api/BuildingAdmin/assign' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "buildingId": 0,
  "adminId": 0
}'

