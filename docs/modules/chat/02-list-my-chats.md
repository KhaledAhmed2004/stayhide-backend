# 02. List My Chats

```http
GET /chats?searchTerm=John
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

## UX Flow

1. User chat list open kore (e.g. Message tab e click kore)
2. Page load hole current user er shob chat fetch hobe → `GET /chats` (→ 2.1)
3. Search bar e kichu likhle `searchTerm` query pathano hobe participant filter korar jonno.
4. UI te chat list, last message, unread count, ebong online status show korbe.

---

> Fetches all chat conversations for the logged-in user, including last message preview, unread count, and participant presence.

## 2. Business Rules (Source of Truth)
- **Search**: `searchTerm` query parameter use hoy onno participant er name filter korar jonno (case-insensitive).
- **Last Message**: Prottek chat er shobar shesh message description e thake.
- **Unread Count**: Login kora user er koto gulo message unread ache sheta return kore.
- **Presence**: Onno participant er `isOnline` status ebong `lastActive` timestamp thake.

---

## 3. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Chat list retrieved successfully",
  "data": [
    {
      "_id": "664a1b2c3d4e5f6a7b8c9d1z",
      "participants": [
        {
          "_id": "664a1b2c3d4e5f6a7b8c9d1c",
          "name": "Jane Doe",
          "image": "...",
          "role": "SISTER"
        }
      ],
      "status": true,
      "lastMessage": {
        "text": "Hello there!",
        "createdAt": "2026-05-16T10:30:00.000Z"
      },
      "unreadCount": 2,
      "presence": {
        "isOnline": true,
        "lastActive": 1715680000000
      }
    }
  ]
}
```

## API Status

| # | Endpoint | Status | Notes |
|---|----------|:------:|-------|
| 2.1 | `GET /chats` | ✅ Done | User er shob chat list fetch kore |
