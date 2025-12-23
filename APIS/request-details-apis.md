here are the APIs that need to work for the request details page

since its already rendering all the details , now we need to add an API to update the request status, 

curl -X 'POST' \
  'http://16.171.240.211/api/MaintenanceRequest/status' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "requestId": 0,
  "newStatus": 1,
  "changedById": 0,
  "note": "string"
}'


now to assign a the request to a maintaince staff we need to use the request id and the staff id

curl -X 'POST' \
  'http://16.171.240.211/api/MaintenanceRequest/assign' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "requestId": 0,
  "assignedToId": 0,
  "assignedById": 0
}'


manager can read the comments and also comment as well, 

curl -X 'POST' \
  'http://16.171.240.211/api/MaintenanceRequest/comment' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "requestId": 0,
  "userId": 0,
  "commentText": "string"
}'

hopefully you understand, 


Assign To

Select employee
Assignment implementation pending (mocked). this is the currently in the Request Details page, 

the employees should be scoped to the managers buildings meaning the list should display only those employees that are related to the buildings the manager is assigned to.


the Update Status can show limited options, on-hold, completed and cancelled. 