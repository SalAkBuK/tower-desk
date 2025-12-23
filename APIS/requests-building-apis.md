These apis are for fetching requests related to the building

curl -X 'GET' \
  'http://16.171.240.211/api/MaintenanceRequest/building/14' \
  -H 'accept: */*'

  so i want to fetch all the requests related to the buildings, also why are the superadmin apis working for the admin, cause i logged in as admin user role and clicked on Requests which showed me all the requests. here are the logs for when i clicked on Requests tab

  [API] Fetching: /api/proxy/Admin/getall
api.ts:76 [API] Fetching: /api/proxy/MaintenanceStaff/getall
api.ts:76 [API] Fetching: /api/proxy/Manager/getall
api.ts:76 [API] Fetching: /api/proxy/Tenant/getall
api.ts:76 [API] Fetching: /api/proxy/BuildingAdmin/admin/27
api.ts:76 [API] Fetching: /api/proxy/MaintenanceRequest/building/14
api.ts:76 [API] Fetching: /api/proxy/MaintenanceRequest/building/16
api.ts:76 [API] Fetching: /api/proxy/MaintenanceRequest/building/19
api.ts:76 [API] Fetching: /api/proxy/MaintenanceRequest/building/25
api.ts:76 [API] Fetching: /api/proxy/MaintenanceRequest/building/26
api.ts:89 [API] Status: 200
api.ts:101 [API] Data received for /Manager/getall
api.ts:89 [API] Status: 200
api.ts:101 [API] Data received for /Admin/getall
4api.ts:89 [API] Status: 200
api.ts:101 [API] Data received for /Tenant/getall
api.ts:101 [API] Data received for /BuildingAdmin/admin/27
api.ts:101 [API] Data received for /MaintenanceStaff/getall
api.ts:101 [API] Data received for /MaintenanceRequest/building/14
api.ts:89 [API] Status: 200
api.ts:101 [API] Data received for /MaintenanceRequest/building/19
api.ts:89 [API] Status: 200
api.ts:101 [API] Data received for /MaintenanceRequest/building/16
api.ts:89 [API] Status: 200
api.ts:101 [API] Data received for /MaintenanceRequest/building/25
api.ts:89 [API] Status: 200
api.ts:101 [API] Data received for /MaintenanceRequest/building/26


is there a way to add a gaurd for this and make this only work if the user superadmin has logged in the response body for superadmins will show the role as TowerDesk instead of superadmin. 

basically i only want to fetch requests related to the buildings assigned to the admin, so i want to add a gaurd for this and make this only work if the user superadmin has logged in the response body for superadmins will show the role as TowerDesk instead of superadmin, im sharing this extra info cause the superadmin apis are working for the admin user role.