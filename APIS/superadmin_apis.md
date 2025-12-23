Superadmin portal should fetch all users and buildings

Get all admin api
curl -X 'GET' \
  'http://16.171.240.211/api/Admin/getall' \
  -H 'accept: */*'



Get all buildings api
curl -X 'GET' \
  'http://16.171.240.211/api/Buildings/getall' \
  -H 'accept: */*'


  get all requests api
curl -X 'GET' \
  'http://16.171.240.211/api/MaintenanceRequest/all' \
  -H 'accept: */*'

  get all maintaince staff api
  curl -X 'GET' \
  'http://16.171.240.211/api/MaintenanceStaff/getall' \
  -H 'accept: */*'


  get all managers api
  curl -X 'GET' \
  'http://16.171.240.211/api/Manager/getall' \
  -H 'accept: */*'

  get all tenants api
  curl -X 'GET' \
  'http://16.171.240.211/api/Tenant/getall' \
  -H 'accept: */*'