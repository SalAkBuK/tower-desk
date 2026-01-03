## Error Type
Console Error

## Error Message
API Error: 401 Unauthorized


    at fetchJson (src/lib/api.ts:227:25)
    at async getBuildingUnits (src/lib/api.ts:2034:21)

## Code Frame
  225 |             }
  226 |             if (IS_DEV) {
> 227 |                 console.error(`API Error: ${res.status} ${res.statusText}`);
      |                         ^
  228 |                 if (errorBody) {
  229 |                     console.error(`[API] Error Body:`, errorBody);
  230 |                 }

Next.js version: 16.1.0 (Turbopack)

## Error Type
Console Error

## Error Message
[API] Error Body: "{\"success\":false,\"error\":{\"code\":\"UnauthorizedException\",\"message\":\"Unauthorized\"},\"requestId\":\"79e589be-2b62-460b-9ff4-b9f9b203b7d6\"}"


    at fetchJson (src/lib/api.ts:229:29)
    at async getBuildingUnits (src/lib/api.ts:2034:21)

## Code Frame
  227 |                 console.error(`API Error: ${res.status} ${res.statusText}`);
  228 |                 if (errorBody) {
> 229 |                     console.error(`[API] Error Body:`, errorBody);
      |                             ^
  230 |                 }
  231 |             }
  232 |             let errorMessage = `API Error: ${res.status}`;

Next.js version: 16.1.0 (Turbopack)
## Error Type
Console Error

## Error Message
{"success":false,"error":{"code":"UnauthorizedException","message":"Unauthorized"},"requestId":"79e589be-2b62-460b-9ff4-b9f9b203b7d6"}


    at fetchJson (src/lib/api.ts:241:19)
    at async getBuildingUnits (src/lib/api.ts:2034:21)

## Code Frame
  239 |                 }
  240 |             }
> 241 |             throw new Error(errorMessage);
      |                   ^
  242 |         }
  243 |         const data = await res.json();
  244 |         if (IS_DEV) {

Next.js version: 16.1.0 (Turbopack)
## Error Type
Console Error

## Error Message
API Error: 401 Unauthorized


    at fetchJson (src/lib/api.ts:227:25)
    at async getBuildingAmenities (src/lib/api.ts:1930:21)

## Code Frame
  225 |             }
  226 |             if (IS_DEV) {
> 227 |                 console.error(`API Error: ${res.status} ${res.statusText}`);
      |                         ^
  228 |                 if (errorBody) {
  229 |                     console.error(`[API] Error Body:`, errorBody);
  230 |                 }

Next.js version: 16.1.0 (Turbopack)
## Error Type
Console Error

## Error Message
[API] Error Body: "{\"success\":false,\"error\":{\"code\":\"UnauthorizedException\",\"message\":\"Unauthorized\"},\"requestId\":\"c43d6cae-665c-423f-b644-3345ad07a63b\"}"


    at fetchJson (src/lib/api.ts:229:29)
    at async getBuildingAmenities (src/lib/api.ts:1930:21)

## Code Frame
  227 |                 console.error(`API Error: ${res.status} ${res.statusText}`);
  228 |                 if (errorBody) {
> 229 |                     console.error(`[API] Error Body:`, errorBody);
      |                             ^
  230 |                 }
  231 |             }
  232 |             let errorMessage = `API Error: ${res.status}`;

Next.js version: 16.1.0 (Turbopack)
## Error Type
Console Error

## Error Message
{"success":false,"error":{"code":"UnauthorizedException","message":"Unauthorized"},"requestId":"c43d6cae-665c-423f-b644-3345ad07a63b"}


    at fetchJson (src/lib/api.ts:241:19)
    at async getBuildingAmenities (src/lib/api.ts:1930:21)

## Code Frame
  239 |                 }
  240 |             }
> 241 |             throw new Error(errorMessage);
      |                   ^
  242 |         }
  243 |         const data = await res.json();
  244 |         if (IS_DEV) {

Next.js version: 16.1.0 (Turbopack)
## Error Type
Console Error

## Error Message
API Error: 401 Unauthorized


    at fetchJson (src/lib/api.ts:227:25)
    at async getOwners (src/lib/api.ts:1889:21)

## Code Frame
  225 |             }
  226 |             if (IS_DEV) {
> 227 |                 console.error(`API Error: ${res.status} ${res.statusText}`);
      |                         ^
  228 |                 if (errorBody) {
  229 |                     console.error(`[API] Error Body:`, errorBody);
  230 |                 }

Next.js version: 16.1.0 (Turbopack)
## Error Type
Console Error

## Error Message
[API] Error Body: "{\"success\":false,\"error\":{\"code\":\"UnauthorizedException\",\"message\":\"Unauthorized\"},\"requestId\":\"4c935842-b860-406c-82e7-d55f4727c267\"}"


    at fetchJson (src/lib/api.ts:229:29)
    at async getOwners (src/lib/api.ts:1889:21)

## Code Frame
  227 |                 console.error(`API Error: ${res.status} ${res.statusText}`);
  228 |                 if (errorBody) {
> 229 |                     console.error(`[API] Error Body:`, errorBody);
      |                             ^
  230 |                 }
  231 |             }
  232 |             let errorMessage = `API Error: ${res.status}`;

Next.js version: 16.1.0 (Turbopack)
## Error Type
Console Error

## Error Message
{"success":false,"error":{"code":"UnauthorizedException","message":"Unauthorized"},"requestId":"4c935842-b860-406c-82e7-d55f4727c267"}


    at fetchJson (src/lib/api.ts:241:19)
    at async getOwners (src/lib/api.ts:1889:21)

## Code Frame
  239 |                 }
  240 |             }
> 241 |             throw new Error(errorMessage);
      |                   ^
  242 |         }
  243 |         const data = await res.json();
  244 |         if (IS_DEV) {

Next.js version: 16.1.0 (Turbopack)
## Error Type
Console Error

## Error Message
API Error: 401 Unauthorized


    at fetchJson (src/lib/api.ts:227:25)
    at async getUnitTypes (src/lib/api.ts:1857:21)

## Code Frame
  225 |             }
  226 |             if (IS_DEV) {
> 227 |                 console.error(`API Error: ${res.status} ${res.statusText}`);
      |                         ^
  228 |                 if (errorBody) {
  229 |                     console.error(`[API] Error Body:`, errorBody);
  230 |                 }

Next.js version: 16.1.0 (Turbopack)
## Error Type
Console Error

## Error Message
[API] Error Body: "{\"success\":false,\"error\":{\"code\":\"UnauthorizedException\",\"message\":\"Unauthorized\"},\"requestId\":\"f74477e1-6bce-4836-8eab-61f28d2b1cef\"}"


    at fetchJson (src/lib/api.ts:229:29)
    at async getUnitTypes (src/lib/api.ts:1857:21)

## Code Frame
  227 |                 console.error(`API Error: ${res.status} ${res.statusText}`);
  228 |                 if (errorBody) {
> 229 |                     console.error(`[API] Error Body:`, errorBody);
      |                             ^
  230 |                 }
  231 |             }
  232 |             let errorMessage = `API Error: ${res.status}`;

Next.js version: 16.1.0 (Turbopack)
## Error Type
Console Error

## Error Message
{"success":false,"error":{"code":"UnauthorizedException","message":"Unauthorized"},"requestId":"f74477e1-6bce-4836-8eab-61f28d2b1cef"}


    at fetchJson (src/lib/api.ts:241:19)
    at async getUnitTypes (src/lib/api.ts:1857:21)

## Code Frame
  239 |                 }
  240 |             }
> 241 |             throw new Error(errorMessage);
      |                   ^
  242 |         }
  243 |         const data = await res.json();
  244 |         if (IS_DEV) {

Next.js version: 16.1.0 (Turbopack)
