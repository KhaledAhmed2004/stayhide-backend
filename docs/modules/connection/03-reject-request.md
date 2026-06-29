# 03. Reject Connection Request

```http
POST /connections/:connectionId/reject
Auth: Bearer {{accessToken}} (BROTHER, SISTER)
```

> Allows the receiver of a connection request to reject it. This action deletes the connection record from the database.

## 1. Business Rules
- **Authorization**: Only the **receiver** of the request can reject it.
- **Status Check**: The request must currently be in `PENDING` status.
- **Outcome**: 
  - The connection record is **permanently deleted** from the database.
  - The relationship state returns to `NONE`.

## 2. Path Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `connectionId` | string | ✅ | The `id` of the connection request |

## 3. Request Body
> **No request body required.**

---

## 4. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Connection request rejected successfully",
  "data": {
    "id": "664a1b2c3d4e5f6a7b8c9d1a",
    "status": "NONE"
  }
}
```

### Forbidden (403)
*If the user trying to respond is not the receiver.*
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Only the receiver can respond to this request"
}
```

### Bad Request (400)
*If the request is already accepted or doesn't exist.*
```json
{
  "success": false,
  "statusCode": 400,
  "message": "This request is no longer pending"
}
```
