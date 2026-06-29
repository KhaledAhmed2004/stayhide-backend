# 03. Get Single Dua

```http
GET /duas/:duaId
Auth: None
```

## 1. Overview
Fetches the full details of a specific dua by its unique ID.

> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)

---

## 2. Path Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `duaId` | `string` | Yes | The unique ID of the dua |

---

## 3. Implementation
- **Route**: [src/app/modules/dua/dua.route.ts](../../../src/app/modules/dua/dua.route.ts)
- **Controller**: [src/app/modules/dua/dua.controller.ts](../../../src/app/modules/dua/dua.controller.ts) — `getSingleDua`
- **Service**: [src/app/modules/dua/dua.service.ts](../../../src/app/modules/dua/dua.service.ts) — `getSingleDuaFromDB`

---

## 4. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Dua fetched successfully",
  "data": {
    "_id": "664a1b2c3d4e5f6a7b8c9d0e",
    "title": "Dua for waking up",
    "waqt": "Fajr",
    "details": "Alhamdu lillahil-ladhi...",
    "audioUrl": "http://localhost:5000/uploads/media/1715421000-dua.mp3",
    "isDeleted": false,
    "createdAt": "2026-05-13T10:30:00.000Z",
    "updatedAt": "2026-05-13T10:30:00.000Z"
  }
}
```

### Not Found (404)
```json
{
  "success": false,
  "statusCode": 404,
  "message": "Dua not found"
}
```
