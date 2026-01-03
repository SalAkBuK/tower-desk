We need to remove theese tabs from the (sa) portal or superadmin portal,


Users
Buildings
Requests

also check if what API calls are invoked when we click on the Organizations tab

also we dont need to call these APIs in superadmin. 

api.ts:179 
 GET http://localhost:3000/api/notifications?limit=10 403 (Forbidden)
fetchJson	@	api.ts:179
getNotifications	@	api.ts:2329
useNotifications.useQuery	@	queries.ts:488
Show 23 more frames
api.ts:227 API Error: 403 Forbidden
fetchJson	@	api.ts:227
await in fetchJson (async)		
getNotifications	@	api.ts:2329
useNotifications.useQuery	@	queries.ts:488
Show 24 more frames
api.ts:229 [API] Error Body: {"success":false,"error":{"code":"Forbidden","message":"Org scope required"},"requestId":"64c5c9b6-24ad-48fe-9e3c-f3416cea78b6"}
fetchJson	@	api.ts:229
await in fetchJson (async)		
getNotifications	@	api.ts:2329
useNotifications.useQuery	@	queries.ts:488
Show 24 more frames
api.ts:249 [API] Fetch failed Error: {"success":false,"error":{"code":"Forbidden","message":"Org scope required"},"requestId":"64c5c9b6-24ad-48fe-9e3c-f3416cea78b6"}
    at fetchJson (api.ts:241:19)
    at async getNotifications (api.ts:2329:21)
api.ts:179 
 GET http://localhost:3000/api/notifications?limit=10 403 (Forbidden)
api.ts:227 API Error: 403 Forbidden
api.ts:229 [API] Error Body: {"success":false,"error":{"code":"Forbidden","message":"Org scope required"},"requestId":"5c34e724-226d-4d35-a8ff-bfbe897bb20a"}
api.ts:249 [API] Fetch failed Error: {"success":false,"error":{"code":"Forbidden","message":"Org scope required"},"requestId":"5c34e724-226d-4d35-a8ff-bfbe897bb20a"}
    at fetchJson (api.ts:241:19)
    at async getNotifications (api.ts:2329:21)
﻿

api.ts:179 
 GET http://localhost:3000/api/notifications?limit=10 403 (Forbidden)
fetchJson	@	api.ts:179
getNotifications	@	api.ts:2329
useNotifications.useQuery	@	queries.ts:488
Show 23 more frames
api.ts:227 API Error: 403 Forbidden
fetchJson	@	api.ts:227
await in fetchJson (async)		
getNotifications	@	api.ts:2329
useNotifications.useQuery	@	queries.ts:488
Show 24 more frames
api.ts:229 [API] Error Body: {"success":false,"error":{"code":"Forbidden","message":"Org scope required"},"requestId":"64c5c9b6-24ad-48fe-9e3c-f3416cea78b6"}
fetchJson	@	api.ts:229
await in fetchJson (async)		
getNotifications	@	api.ts:2329
useNotifications.useQuery	@	queries.ts:488
Show 24 more frames
api.ts:249 [API] Fetch failed Error: {"success":false,"error":{"code":"Forbidden","message":"Org scope required"},"requestId":"64c5c9b6-24ad-48fe-9e3c-f3416cea78b6"}
    at fetchJson (api.ts:241:19)
    at async getNotifications (api.ts:2329:21)
api.ts:179 
 GET http://localhost:3000/api/notifications?limit=10 403 (Forbidden)
api.ts:227 API Error: 403 Forbidden
api.ts:229 [API] Error Body: {"success":false,"error":{"code":"Forbidden","message":"Org scope required"},"requestId":"5c34e724-226d-4d35-a8ff-bfbe897bb20a"}
api.ts:249 [API] Fetch failed Error: {"success":false,"error":{"code":"Forbidden","message":"Org scope required"},"requestId":"5c34e724-226d-4d35-a8ff-bfbe897bb20a"}
    at fetchJson (api.ts:241:19)
    at async getNotifications (api.ts:2329:21)
api.ts:179 
 GET http://localhost:3000/api/notifications?limit=10 403 (Forbidden)
api.ts:227 API Error: 403 Forbidden
api.ts:229 [API] Error Body: {"success":false,"error":{"code":"Forbidden","message":"Org scope required"},"requestId":"acfc1265-5025-43ab-82fe-ea843cc5f58f"}
api.ts:249 [API] Fetch failed Error: {"success":false,"error":{"code":"Forbidden","message":"Org scope required"},"requestId":"acfc1265-5025-43ab-82fe-ea843cc5f58f"}
    at fetchJson (api.ts:241:19)
    at async getNotifications (api.ts:2329:21)
api.ts:179 
 GET http://localhost:3000/api/notifications?limit=10 403 (Forbidden)
api.ts:227 API Error: 403 Forbidden
api.ts:229 [API] Error Body: {"success":false,"error":{"code":"Forbidden","message":"Org scope required"},"requestId":"394d7984-de3d-48bb-837a-148d385263f2"}
api.ts:249 [API] Fetch failed Error: {"success":false,"error":{"code":"Forbidden","message":"Org scope required"},"requestId":"394d7984-de3d-48bb-837a-148d385263f2"}
    at fetchJson (api.ts:241:19)
    at async getNotifications (api.ts:2329:21)
﻿

