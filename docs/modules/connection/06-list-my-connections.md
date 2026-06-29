# 06. List My Connections

```http
GET /connections
Auth: Bearer {{accessToken}} (BROTHER, SISTER)
```

> Fetches a paginated list of all established (ACCEPTED) connections for the logged-in user.

## 1. Business Rules
- **Data Formatting**: The response includes a `connectedUser` object representing the *other* person in the connection.
- **Population**: Automatically populates the other user's `id`, `name`, and `profileImage`.

---

## 3. Query Parameters

| Parameter | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `limit` | Pagination limit | `10` | `10` |
| `cursor` | Base64 cursor for next page | — | `...` |

---

## 4. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Connections retrieved successfully",
  "pagination": {
    "limit": 10,
    "nextCursor": "...",
    "hasNext": false
  },
  "data": [
    {
      "id": "664a1b2c3d4e5f6a7b8c9d1a",
      "status": "ACCEPTED",
      "chatId": "664a1b2c3d4e5f6a7b8c9d1z",
      "createdAt": "2026-05-14T10:00:00.000Z",
      "connectedUser": {
        "id": "664a1b2c3d4e5f6a7b8c9d1c",
        "name": "Jane Doe",
        "profileImage": "http://..."
      }
    }
  ]
}
```
