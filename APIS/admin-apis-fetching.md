admin must be able to view all the users related to the building they are assigned to

here is the api for fetching managers assigned to their buildings
curl -X 'GET' \
  'http://16.171.240.211/api/BuildingManager/building/14' \
  -H 'accept: */*'

  	
Response body
Download
{
  "success": true,
  "data": [
    {
      "id": 30,
      "fullName": "string",
      "email": "testmanager@gmail.com",
      "phoneNumber": "string",
      "isActive": true
    }
  ]
}

but here is the thing, you are going to have to fetch all the managers if there are multiple buildings assigned to the admin, so we already have the api for fetching all the buildings assigned to the admin, now we would need to collect them and fetch all the managers assigned to them one by one.


here is the api for fetching all the maintainance staff assigned to their buildings

curl -X 'GET' \
  'http://16.171.240.211/api/BuildingMaintenanceStaff/building/14' \
  -H 'accept: */*'

  	
Response body
Download
{
  "success": true,
  "data": [
    {
      "id": 31,
      "fullName": "string",
      "email": "user212@example.com",
      "phoneNumber": "string",
      "isActive": true
    },
    {
      "id": 41,
      "fullName": "Testing",
      "email": "testing@gmail.conhaha",
      "phoneNumber": "1264546949794",
      "isActive": true
    }
  ]
}

now this would basically go throught he same thing, if there are multiple buildings assigned to the admin, we would need to collect them and fetch all the maintainance staff assigned to them one by one.



Here is the api for fetching tenants assigned to a building,

curl -X 'GET' \
  'http://16.171.240.211/api/Tenant/getall-by-building/14' \
  -H 'accept: */*'

  Response body
Download
{
  "success": true,
  "data": [
    {
      "id": 33,
      "fullName": "Testing",
      "email": "testinf@employee.com",
      "phoneNumber": "123456789",
      "address": "Testusjs@gmail.com",
      "nationality": "Paki",
      "isActive": true,
      "createdAt": "2025-12-14T11:35:24.996921",
      "profile": {
        "unitNumber": "100",
        "floorNumber": 1,
        "entranceDate": "2025-12-14T11:34:46.537",
        "exitDate": null
      }
    },
    {
      "id": 34,
      "fullName": "Testinf tenant",
      "email": "tshsbsj@jsj.con",
      "phoneNumber": "12345679",
      "address": "Hashshsh",
      "nationality": "Indian",
      "isActive": true,
      "createdAt": "2025-12-14T11:37:46.806422",
      "profile": {
        "unitNumber": "12",
        "floorNumber": 3,
        "entranceDate": "2025-12-14T11:37:03.609",
        "exitDate": null
      }
    }
  ]
}