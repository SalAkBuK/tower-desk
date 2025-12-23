

  auth api
  
  curl -X 'POST' \
  'http://16.171.240.211/api/Auth/login' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "email": "string",
  "password": "string"
}'
