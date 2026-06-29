# 05. Delete Dua

```http
DELETE /duas/:duaId
Auth: Bearer {{accessToken}} (ADMIN, SUPER_ADMIN)
```

## 1. Overview
Allows an admin or super admin to soft-delete a dua. The record remains in the database with `isDeleted: true` but is hidden from regular listing and detail fetches.

> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)

---

## 2. Path Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `duaId` | `string` | Yes | The unique ID of the dua to delete |

---

## 3. Implementation
- **Route**: [src/app/modules/dua/dua.route.ts](../../../src/app/modules/dua/dua.route.ts)
- **Controller**: [src/app/modules/dua/dua.controller.ts](../../../src/app/modules/dua/dua.controller.ts) — `deleteDua`
- **Service**: [src/app/modules/dua/dua.service.ts](../../../src/app/modules/dua/dua.service.ts) — `deleteDuaFromDB`

---

## 4. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Dua deleted successfully",
  "data": {
    "id": "664a1b2c3d4e5f6a7b8c9d0e"
  }
}
```
