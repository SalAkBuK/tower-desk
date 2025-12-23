here are all the delete apis for the admin user role 


1)Manager

curl -X 'DELETE' \
  'http://16.171.240.211/api/BuildingManager/remove' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "buildingId": 0,
  "managerId": 0
}'



2) Maintaince Staff 

Curl

curl -X 'DELETE' \
  'http://16.171.240.211/api/BuildingMaintenanceStaff/remove' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "buildingId": 0,
  "staffId": 0
}'

3)Tenant

curl -X 'DELETE' \
  'http://16.171.240.211/api/Tenant/delete/121212' \
  -H 'accep


  now if they arent already made, make them and apply them to the admin user role in the Users page,


