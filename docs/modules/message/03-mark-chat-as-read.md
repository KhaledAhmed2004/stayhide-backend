# 03. Mark Chat as Read

```http
POST /messages/chat/:chatId/read
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

## UX Flow

1. User kono ekta chat open kore.
2. Chat history fetch korar por ba chat open thaka obosthay endpoint call hoy → `POST /messages/chat/:chatId/read` (→ 3.1)
3. Backend check kore oi chat e user er jonno kono unread message ache kina.
4. Jodi thake, shob gulo `readBy` array te user er ID add kore.
5. Real-time update er jonno `MESSAGE_READ` event emit hoy.
6. Success hole UI te unread count zero hoye jay.

---

## 1. Overview
Marks all messages in a specific chat as read for the logged-in user.

---

## 2. Business Rules
- **Filtering**: Shudhu shei message gulo update hoy jekhane logged-in user sender noy ebong age theke read kore ni.
- **Real-time**: Prottek updated message er jonno `MESSAGE_READ` event emit hoy chat room e.
- **Cache**: Redis theke oi user er oi chat er unread count reset kore 0 kore deya hoy.

---

## 3. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Chat messages marked as read",
  "data": {
    "modifiedCount": 5,
    "updatedIds": ["664a1b2c3d4e5f6a7b8c9d91", "664a1b2c3d4e5f6a7b8c9d92"]
  }
}
```

## API Status

| # | Endpoint | Status | Notes |
|---|----------|:------:|-------|
| 3.1 | `POST /messages/chat/:chatId/read` | ✅ Done | Shob message read mark kore |
