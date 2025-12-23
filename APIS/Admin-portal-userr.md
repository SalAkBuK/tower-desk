Admin Portal User Creation procedure for Manager,



when manager is being created, the modal should show a list of buildings that the admin is assigned to, so that the admin can assign the manager to the building.


here is tha api for assinging a manager to the building

curl -X 'POST' \
  'http://16.171.240.211/api/BuildingManager/assign' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "buildingId": 0,
  "managerId": 0
}'

here is the api for creating a manager, i think it already exists please check first,

curl -X 'POST' \
  'http://16.171.240.211/api/Manager/create' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "fullName": "string",
  "email": "user@example.com",
  "password": "string",
  "phoneNumber": "string",
  "address": "string",
  "nationality": "string"
}'

hopefully you understand the process, first you would create a manager, then assign him to a building using the   'http://16.171.240.211/api/BuildingManager/assign' api.


Now for creating a tenant, 

curl -X 'POST' \
  'http://16.171.240.211/api/Tenant/create' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "fullName": "string",
  "email": "user@example.com",
  "password": "string",
  "phoneNumber": "string",
  "address": "string",
  "nationality": "string",
  "buildingId": 0,
  "unitNumber": "string",
  "floorNumber": 0,
  "entranceDate": "2025-12-22T13:08:17.610Z"
}'

please check again if the API already exists or not,

for buildingId i would like to show the admin a list of buildings that the admin is assigned to, so that the admin can assign the tenant to the building.


now for maintaince staff, here is the api for creating a maintaince staff

curl -X 'POST' \
  'http://16.171.240.211/api/MaintenanceStaff/create' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "fullName": "string",
  "email": "user@example.com",
  "password": "string",
  "phoneNumber": "string",
  "address": "string",
  "nationality": "string"
}'

check if it already exists or not

here is the api for assigning the maintaince staff to the building

curl -X 'POST' \
  'http://16.171.240.211/api/BuildingMaintenanceStaff/assign' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "buildingId": 0,
  "staffId": 0
}'

for now the admin can create these three roles only so show the list of roles accordingly
