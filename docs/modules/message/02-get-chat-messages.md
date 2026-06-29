# 02. Get Chat Messages

```http
GET /messages/chat/:chatId?cursor=...&limit=20
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

## UX Flow

1. User kono ekta chat open kore.
2. Chat history fetch korar jonno endpoint call hoy → `GET /messages/chat/:chatId` (→ 2.1)
3. Jodi user upore scroll kore (load more), tobe `cursor` (shobar shesh message er timestamp) pathano hoy porer message gulo pawar jonno.
4. UI te messages gulo ascending order (oldest to newest) e dekhano hoy.

---

## 1. Overview
Fetches a paginated list of messages for a specific chat conversation using cursor-based pagination.

---

## 2. Business Rules
- **Sorting**: Messages gulo shob shomoy `createdAt` ascending order (oldest to newest) e return hoy chat flow maintain korar jonno.
- **Pagination**: Cursor-based pagination use hoy. `cursor` parameter e shobar shesh message er timestamp pathate hoy porer messages pawar jonno.
- **Limit**: Default limit 20, clamp kora thake 1 theke 100 er modhe.
- **Population**: `sender` field explicit-ly populate kora hoy (`_id`, `name`, `profilePicture`).

---

## 3. Query Parameters
| Parameter | Type | Required | Description | Example |
| :--- | :--- | :---: | :--- | :--- |
| `cursor` | `string` | ❌ | ISO 8601 timestamp (messages strictly after this time) | `2026-05-16T10:30:00.000Z` |
| `limit` | `number` | ❌ | Page size (1-100), default 20 | `20` |

---

## 4. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Chat messages retrieved successfully",
  "meta": {
    "total": 50,
    "limit": 20,
    "hasNextPage": true,
    "nextCursor": "2026-05-16T11:00:00.000Z"
  },
  "data": [
    {
      "_id": "664a1b2c3d4e5f6a7b8c9d99",
      "chatId": "664a1b2c3d4e5f6a7b8c9d1z",
      "sender": {
        "_id": "664a1b2c3d4e5f6a7b8c9d1b",
        "name": "Jane Doe",
        "profilePicture": "https://cdn.example.com/avatar.jpg"
      },
      "text": "Hello!",
      "type": "text",
      "attachments": [
        {
          "type": "image",
          "url": "https://cdn.example.com/file.jpg",
          "name": "file.jpg"
        }
      ],
      "readBy": ["664a1b2c3d4e5f6a7b8c9d1c"],
      "createdAt": "2026-05-16T10:30:00.000Z"
    }
  ]
}
```

## API Status

| # | Endpoint | Status | Notes |
|---|----------|:------:|-------|
| 2.1 | `GET /messages/chat/:chatId` | ✅ Done | Chat messages history fetch kore |
