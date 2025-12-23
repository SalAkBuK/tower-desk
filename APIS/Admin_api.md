curl -X 'POST' \
  'http://16.171.240.211/api/Admin/create' \
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

curl -X 'PUT' \
  'http://16.171.240.211/api/Admin/update/12' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "fullName": "string",
  "phoneNumber": "string",
  "address": "string",
  "nationality": "string"
}'

curl -X 'GET' \
  'http://16.171.240.211/api/Admin/get/22' \
  -H 'accept: */*'

	
Response body
Download
{
  "success": true,
  "data": {
    "id": 22,
    "fullName": "Shahzeb",
    "email": "shahzebfawad@gmail.com",
    "phoneNumber": "31316613636",
    "address": "ABCd",
    "nationality": "Pk",
    "isActive": true,
    "createdAt": "2025-12-14T06:04:31.6587042"
  }
}



curl -X 'GET' \
  'http://16.171.240.211/api/Admin/getall' \
  -H 'accept: */*'


	
Response body
Download
{
  "success": true,
  "data": [
    {
      "id": 22,
      "fullName": "Shahzeb",
      "email": "shahzebfawad@gmail.com",
      "phoneNumber": "31316613636",
      "address": "ABCd",
      "nationality": "Pk",
      "isActive": true,
      "createdAt": "2025-12-14T06:04:31.6587042"
    },
    {
      "id": 26,
      "fullName": "Adminalphatower",
      "email": "admin2@gmail.com",
      "phoneNumber": "359494949",
      "address": "Non",
      "nationality": "Uk",
      "isActive": true,
      "createdAt": "2025-12-14T06:25:51.5340244"




  curl -X 'DELETE' \
  'http://16.171.240.211/api/Admin/delete/23' \
  -H 'accept: */

	
Response body
Download
{
  "success": true,
  "message": "Admin deactivated successfully"
}


  auth api
  
  curl -X 'POST' \
  'http://16.171.240.211/api/Auth/login' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "email": "string",
  "password": "string"
}'

curl -X 'POST' \
  'http://16.171.240.211/api/Auth/reset-password' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "email": "user@example.com",
  "newPassword": "string"
}'