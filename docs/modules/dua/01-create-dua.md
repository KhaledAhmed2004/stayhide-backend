# 01. Create Dua

```http
POST /duas
Content-Type: multipart/form-data
Auth: Bearer {{accessToken}} (ADMIN, SUPER_ADMIN)
```

## 1. Overview
Allows an admin or super admin to create a new dua. This endpoint handles audio file uploads and associates them with the dua record.

> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)

---

## 2. Business Rules (Source of Truth)

### 2.1 Authentication & Authorization
- **Protected route** — requires a valid `Bearer` token.
- **Role restriction**: Only `ADMIN` or `SUPER_ADMIN` can create duas.
- **Status check**: The auth middleware automatically blocks restricted or inactive admin accounts.

### 2.2 File Handling (audio)
Audio upload is processed by `fileHandler` before validation.

- **Field**: `audio` (maxCount: 1).
- **Max file size**: 10 MB.
- **Allowed MIME types**: `audio/mpeg`, `audio/ogg`, `audio/wav`.
- **Storage**: Processed into a URL and mapped to `audioUrl` in the database.

### 2.3 Input Validation (Zod — `createDuaZodSchema`)
| Field | Type | Required | Constraint |
| :--- | :--- | :--- | :--- |
| `title` | `string` | Yes | Min 1 char |
| `waqt` | `enum` | Yes | `Fajr`, `Zuhr`, `Asr`, `Maghrib`, `Isha` |
| `details` | `string` | Yes | Min 1 char |
| `audio` | `string` | Yes | Provided by `fileHandler` after successful upload |

---

## 3. Request Body (Form-Data)

| Field | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `title` | `string` | Yes | The title of the dua | `Dua for waking up` |
| `waqt` | `string` | Yes | Prayer time category | `Fajr` |
| `details` | `string` | Yes | The content/details of the dua | `Alhamdu lillahil-ladhi...` |
| `audio` | `file` | Yes | Audio file attachment | — |

---

## 4. Implementation
- **Route**: [src/app/modules/dua/dua.route.ts](../../../src/app/modules/dua/dua.route.ts)
- **Controller**: [src/app/modules/dua/dua.controller.ts](../../../src/app/modules/dua/dua.controller.ts) — `createDua`
- **Service**: [src/app/modules/dua/dua.service.ts](../../../src/app/modules/dua/dua.service.ts) — `createDuaIntoDB`
- **Validation**: [src/app/modules/dua/dua.validation.ts](../../../src/app/modules/dua/dua.validation.ts) — `DuaValidation.createDuaZodSchema`

**Middleware order**: `auth(ADMIN, SUPER_ADMIN)` -> `fileHandler([{ name: 'audio', maxCount: 1 }])` -> `validateRequest(DuaValidation.createDuaZodSchema)` -> `DuaController.createDua`.

---

## 5. Responses

### Success (201)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Dua created successfully",
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
