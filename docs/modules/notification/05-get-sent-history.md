# 05. Get Sent History

```http
GET /notifications/broadcasts
Auth: Bearer {{accessToken}}
```

> Retrieve a log of all broadcast notifications sent by admins.

## Query Parameters
Standard pagination parameters (`page`, `limit`) and search (`searchTerm`).

## Success Response
**Code**: `200 OK`

```json
{
  "success": true,
  "message": "Sent notification history retrieved successfully",
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPage": 1
  },
  "data": [
    {
      "_id": "64b5f1...",
      "title": "System Update",
      "text": "Maintenance complete.",
      "audience": "BROTHER",
      "recipientCount": 150,
      "createdAt": "2023-07-18T10:00:00.000Z"
    }
  ]
}
```
