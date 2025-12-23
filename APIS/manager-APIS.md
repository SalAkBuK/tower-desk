to fetch what building a manager is assigned to we will use the manager id we receive from when we login 

	
Response body

{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3MSIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL25hbWUiOiJNYW5hZ2VyIEJ1a2hhcmkiLCJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9lbWFpbGFkZHJlc3MiOiJidWtoYXJpQG1hbmFnZXIuY29uIiwianRpIjoiNWQxMTA2YjItYTg5Ni00Y2Q3LTgwMTMtMTVlYzA4NTk0MzNmIiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy9yb2xlIjoiTWFuYWdlciIsImV4cCI6MTc2NjQ0Mzc0NSwiaXNzIjoiVG93ZXJEZXNrQVBJIiwiYXVkIjoiVG93ZXJEZXNrQXBwIn0.ylslbq05PwnjLjQpMdzWCOLJn4lOwujClQ-E1tdGYu4",
  "user": {
    "id": 71,
    "fullName": "Manager Bukhari",
    "email": "bukhari@manager.con",
    "roles": [
      {
        "roleId": 3,
        "roleName": "Manager"
      }
    ],
    "isActive": true
  }
}


then we will use the id to fetch the building the manager has been assigned to and display the building details.

curl -X 'GET' \
  'http://16.171.240.211/api/BuildingManager/building/14' \
  -H 'accep


  	
Response body

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