# 01. Send Message

```http
POST /messages
Content-Type: multipart/form-data
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

## UX Flow

1. User chat screen e thaka obosthay text likhe ba file attach kore "Send" button e click kore.
2. `form-data` format e `chatId`, `text`, ebong file gulo (`image`, `media`, `doc`) pathano hoy → `POST /messages` (→ 1.1)
3. Backend file gulo process kore standard `attachments` array banay.
4. Message database e save hoy ebong `MESSAGE_SENT` event emit hoy real-time update er jonno.
5. Receiver offline thakle push notification pathano hoy.
6. Success hole UI te message ta immediate dekhano hoy.

---

> Sends a text or media message within a chat conversation. Supports multi-file uploads for images, videos, and documents.

## 2. Business Rules (Source of Truth)
- **Authorization**: Sender ke oboshshoi oi `chatId` er ekjon participant hote hobe.
- **Attachments**: Files upload hoye ekta unified `attachments` array te convert hoy. Prottekta attachment object-er shape: `{ type: 'image'|'video'|'audio'|'file', url: string, name: string }`.
- **Real-time**: 
  - `MESSAGE_SENT` event emit hoy chat room (`chat::{chatId}`) ebong participant er user room (`user::{userId}`) e.
- **Notifications**: Offline participants der jonno push notification pathano hoy (60-second deduplication thake Redis use kore).
- **Validation**: 
  - Text maximum 10,000 characters hote parbe.
  - Maximum 10 ta attachment pathano jabe.

---

## 3. Request Body (Form-Data)
| Field | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `chatId` | `string` | ✅ | Target Chat ID | `664a1b2c3d4e5f6a7b8c9d1z` |
| `text` | `string` | ❌ | Message text | `Hello!` |
| `image` | `file[]` | ❌ | Image files | |
| `media` | `file[]` | ❌ | Audio/Video files | |
| `doc` | `file[]` | ❌ | Document files | |

---

## 4. Responses

### Success (201)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Message sent successfully",
  "data": {
    "_id": "664a1b2c3d4e5f6a7b8c9d99",
    "chatId": "664a1b2c3d4e5f6a7b8c9d1z",
    "sender": {
      "_id": "664a1b2c3d4e5f6a7b8c9d1b",
      "name": "John Doe",
      "profilePicture": "https://cdn.example.com/avatar.jpg"
    },
    "text": "Hello!",
    "type": "text",
    "attachments": [],
    "readBy": [],
    "createdAt": "2026-05-16T10:30:00.000Z",
    "updatedAt": "2026-05-16T10:30:00.000Z"
  }
}
```

## API Status

| # | Endpoint | Status | Notes |
|---|----------|:------:|-------|
| 1.1 | `POST /messages` | ✅ Done | Message send kore with attachments |
