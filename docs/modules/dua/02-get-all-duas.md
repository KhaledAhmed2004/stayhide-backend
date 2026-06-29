# 02. Get All Duas

```http
GET /duas
Auth: None
```

## 1. Overview
Allows users to fetch a list of all active (non-deleted) duas. Supports filtering by `waqt`, full-text search, and standard pagination.

> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)

---

## 2. Query Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `waqt` | `string` | No | Filter by prayer time (e.g., `Fajr`) |
| `searchTerm`| `string` | No | Search in `title` and `details` |
| `page` | `number` | No | Page number (default: 1) |
| `limit` | `number` | No | Items per page (default: 10) |
| `sort` | `string` | No | Sorting criteria (e.g., `-createdAt`) |
| `fields` | `string` | No | Comma-separated list of fields to include |

---

## 3. Implementation
- **Route**: [src/app/modules/dua/dua.route.ts](../../../src/app/modules/dua/dua.route.ts)
- **Controller**: [src/app/modules/dua/dua.controller.ts](../../../src/app/modules/dua/dua.controller.ts) — `getAllDuas`
- **Service**: [src/app/modules/dua/dua.service.ts](../../../src/app/modules/dua/dua.service.ts) — `getAllDuasFromDB`

---

## 4. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Duas fetched successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPage": 1
  },
  "data": [
    {
      "_id": "664a1b2c3d4e5f6a7b8c9d0e",
      "title": "Dua for waking up",
      "waqt": "Fajr",
      "details": "Alhamdu lillahil-ladhi...",
      "audioUrl": "http://localhost:5000/uploads/media/1715421000-dua.mp3",
      "createdAt": "2026-05-13T10:30:00.000Z"
    }
  ]
}
```
