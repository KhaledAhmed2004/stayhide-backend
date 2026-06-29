# 05. Remove Connection

```http
POST /connections/:connectionId/remove
Auth: Bearer {{accessToken}} (BROTHER, SISTER)
```

> Allows either user in an **accepted** connection to permanently remove it.

## 1. Business Rules
- **Authorization**: Either user in the connection can remove it.
- **Status Check**: The connection must be in `ACCEPTED` status.
- **Deletion**: The connection document is **permanently deleted**.

## 2. Path Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `connectionId` | string | ✅ | The `id` of the connection |

## 3. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Connection removed successfully",
  "data": {
    "id": "664a1b2c3d4e5f6a7b8c9d1a",
    "status": "NONE"
  }
}
```

### Not Found (404)
```json
{
  "success": false,
  "statusCode": 404,
  "message": "Connection not found"
}
```

### Forbidden (403)
```json
{
  "success": false,
  "statusCode": 403,
  "message": "You are not part of this connection"
}
```

## Difference vs Cancel Request

| | Remove Connection (`POST /connections/:connectionId/remove`) | Cancel Request (`POST /connections/:connectionId/cancel`) |
|---|---|---|
| **Status required** | `ACCEPTED` | `PENDING` |
| **Who can call** | Either user | Sender only |
| **Chat effect** | Preserved | No effect |
| **Socket event** | `CONNECTION_REMOVED` | None |
