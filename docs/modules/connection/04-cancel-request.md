# 04. Cancel Pending Request

```http
POST /connections/:connectionId/cancel
Auth: Bearer {{accessToken}} (BROTHER, SISTER)
```

> Allows the **sender** of a pending connection request to cancel (undo) it before the receiver responds.

## 1. Business Rules
- **Only the sender** can cancel.
- The connection must be in `PENDING` status.
- The connection document is **permanently deleted**.

## 2. Path Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `connectionId` | string | ✅ | The `id` of the connection request |

## 3. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Connection request cancelled successfully",
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
  "message": "Connection request not found"
}
```

### Forbidden (403)
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Only the sender can cancel this request"
}
```

### Bad Request (400)
```json
{
  "success": false,
  "statusCode": 400,
  "message": "This request is no longer pending"
}
```

## Difference vs Remove Connection

| | Cancel Request (`POST /connections/:connectionId/cancel`) | Remove Connection (`POST /connections/:connectionId/remove`) |
|---|---|---|
| **Status required** | `PENDING` | `ACCEPTED` |
| **Who can call** | Sender only | Either user |
| **Chat effect** | None | Chat marked inactive |
