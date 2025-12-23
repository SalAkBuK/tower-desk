curl -X 'POST' \
  'http://16.171.240.211/api/BuildingAdmin/assign' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "buildingId": 0,
  "adminId": 0
}'


curl -X 'DELETE' \
  'http://16.171.240.211/api/BuildingAdmin/remove' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "buildingId": 0,
  "adminId": 0
}'


curl -X 'GET' \
  'http://16.171.240.211/api/BuildingAdmin/building/22' \
  -H 'accept: */*'

  buildingId *

  Response body
Download
{
  "success": true,
  "data": [
    {
      "id": 86,
      "fullName": "Admin02",
      "email": "admin03@gmail.com",
      "isActive": true
    }
  ]
}


curl -X 'GET' \
  'http://16.171.240.211/api/BuildingAdmin/admin/22' \
  -H 'accept: 

  adminId *
	
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
      "isActive": true
    },
    

    so superadmin will have the ability to assign admin to any building but we need to add a check that admin can only assign admin to buildings that dont have a previous admin, 