# 07. List Connection Requests

```http
GET /connections/requests
Auth: Bearer {{accessToken}} (BROTHER, SISTER)
```

> Fetches a cursor-paginated list of pending connection requests, either sent by the user (`direction=sent`) or received by them (`direction=received`).

## 1. Query Parameters
| Parameter | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `direction` | Whether to fetch requests you `sent` or `received` | `received` | `sent` |
| `nextCursor` | Base64 encoded cursor value of the last item from the previous page for cursor pagination | — | `NjY0YTFiMmMzZDRlNWY2YTdiOGM5ZDFh` |
| `limit` | Pagination limit | `10` | `10` |
| `sort` | Sort field (prefix with `-` for descending) | `-createdAt` | `-createdAt` |
| `fields` | Comma-separated fields to select | — | `status,createdAt` |

---

## 3. Responses

### Success (200) - Received Requests (`direction=received`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Received connection requests fetched successfully",
  "pagination": {
    "limit": 10,
    "nextCursor": "NjY0YTFiMmMzZDRlNWY2YTdiOGM5ZDFh",
    "hasNext": false
  },
  "data": [
    {
      "connectionId": "664a1b2c3d4e5f6a7b8c9d1a",
      "sender": {
        "id": "664a1b2c3d4e5f6a7b8c9d1b",
        "name": "John Smith",
        "profileImage": "http://..."
      },
      "status": "PENDING",
      "createdAt": "2026-05-14T11:00:00.000Z"
    }
  ]
}
```

### Success (200) - Sent Requests (`direction=sent`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Sent connection requests fetched successfully",
  "pagination": {
    "limit": 10,
    "nextCursor": "NjY0YTFiMmMzZDRlNWY2YTdiOGM5ZDFj",
    "hasNext": false
  },
  "data": [
    {
      "connectionId": "664a1b2c3d4e5f6a7b8c9d2f",
      "receiver": {
        "id": "664a1b2c3d4e5f6a7b8c9d1e",
        "name": "Jane Doe",
        "profileImage": "http://..."
      },
      "status": "PENDING",
      "createdAt": "2026-05-14T11:05:00.000Z"
    }
  ]
}
```
