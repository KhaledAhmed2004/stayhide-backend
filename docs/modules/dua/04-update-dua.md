# 04. Update Dua

```http
PATCH /duas/:duaId
Content-Type: multipart/form-data
Auth: Bearer {{accessToken}} (ADMIN, SUPER_ADMIN)
```

## 1. Overview
Allows an admin or super admin to update an existing dua. All fields are optional. If a new audio file is provided, it replaces the old one.

> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)

---

## 2. Business Rules (Source of Truth)

### 2.1 Authentication & Authorization
- **Protected route** — requires a valid `Bearer` token.
- **Role restriction**: Only `ADMIN` or `SUPER_ADMIN` can update duas.

### 2.2 File Handling (audio)
Optional audio upload is processed by `fileHandler`.

- **Field**: `audio` (maxCount: 1).
- **Behavior**: If provided, the new audio URL is updated in the database.

### 2.3 Input Validation (Zod — `updateDuaZodSchema`)
| Field | Type | Required | Constraint |
| :--- | :--- | :--- | :--- |
| `title` | `string` | No | Optional |
| `waqt` | `enum` | No | `Fajr`, `Zuhr`, `Asr`, `Maghrib`, `Isha` |
| `details` | `string` | No | Optional |
| `audio` | `string` | No | Optional (provided by `fileHandler` if file uploaded) |

---

## 3. Path Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `duaId` | `string` | Yes | The unique ID of the dua to update |

---

## 4. Request Body (Form-Data)

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `title` | `string` | No | Updated title |
| `waqt` | `string` | No | Updated prayer time category |
| `details` | `string` | No | Updated content |
| `audio` | `file` | No | New audio file attachment |

---

## 5. Implementation
- **Route**: [src/app/modules/dua/dua.route.ts](../../../src/app/modules/dua/dua.route.ts)
- **Controller**: [src/app/modules/dua/dua.controller.ts](../../../src/app/modules/dua/dua.controller.ts) — `updateDua`
- **Service**: [src/app/modules/dua/dua.service.ts](../../../src/app/modules/dua/dua.service.ts) — `updateDuaInDB`
- **Validation**: [src/app/modules/dua/dua.validation.ts](../../../src/app/modules/dua/dua.validation.ts) — `DuaValidation.updateDuaZodSchema`

---

## 6. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Dua updated successfully",
  "data": {
    "id": "664a1b2c3d4e5f6a7b8c9d0e",
    "updatedAt": "2026-05-13T10:45:00.000Z"
  }
}
```
