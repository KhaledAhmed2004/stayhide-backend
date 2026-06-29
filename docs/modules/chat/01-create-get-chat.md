# 01. Create or Get Chat

```http
POST /chats/:otherUserId
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

## UX Flow

1. User onno ekjon user er profile e jay ba message pathate chay
2. "Message" button e tap korle `otherUserId` niye endpoint call hoy → `POST /chats/:otherUserId` (→ 1.1)
3. Backend check kore age theke chat ache kina.
4. Jodi age theke thake, shei chat object return kore.
5. Jodi na thake, new chat create kore return kore.
6. Success hole user direct Chat screen e navigate kore.

---

> Creates a new chat between the logged-in user and another user, or retrieves an existing one if it already exists.

## 2. Business Rules (Source of Truth)
- **Idempotency**: Jodi same participants niye chat agei thake, tobe shetai return hobe, notun kore create hobe na.
- **Reactivation**: Jodi existing chat inactive thake (`status: false`), tobe sheta auto-reactivate hobe (`status: true`).

---

## 3. Responses

### Success (201)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Chat created or retrieved successfully",
  "data": {
    "_id": "664a1b2c3d4e5f6a7b8c9d1z",
    "participants": ["664a1b2c3d4e5f6a7b8c9d1b", "664a1b2c3d4e5f6a7b8c9d1c"],
    "status": true,
    "createdAt": "2026-05-16T10:30:00.000Z",
    "updatedAt": "2026-05-16T10:30:00.000Z"
  }
}
```

## API Status

| # | Endpoint | Status | Notes |
|---|----------|:------:|-------|
| 1.1 | `POST /chats/:otherUserId` | ✅ Done | Chat create ba existing retrieve kore |
