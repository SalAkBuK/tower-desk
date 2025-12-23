Check if these APIs are already being used or not, if not then make them and apply them to the admin user role in the Users page,specifically the Edit button, it should open a modal where we can edit the users info accordingly.


1) Manager

curl -X 'PUT' \
  'http://16.171.240.211/api/Manager/update/1212' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "fullName": "string",
  "phoneNumber": "string",
  "address": "string",
  "nationality": "string"
}'



2) Maintaince Staff 

curl -X 'PUT' \
  'http://16.171.240.211/api/MaintenanceStaff/update/121212' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "fullName": "string",
  "phoneNumber": "string",
  "address": "string",
  "nationality": "string"
}'



3) Tenant

curl -X 'PUT' \
  'http://16.171.240.211/api/Tenant/update/12212' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "fullName": "string",
  "phoneNumber": "string",
  "address": "string",
  "nationality": "string",
  "buildingId": 0,
  "unitNumber": "string",
  "floorNumber": 0,
  "exitDate": "2025-12-22T15:45:55.360Z"
}'


if you need further clarification, please let me know