# Message Module

## Overview

The Message module handles sending, retrieving, and reading messages within 1-on-1 chat conversations. It was refactored to remove unused fields, eliminate auto-populate hooks, introduce cursor-based pagination, and implement a clean notification routing system backed by Redis.

**What changed in the refactor:**
- Removed `deliveredTo`, `status` (`sent|delivered|seen`), and `editedAt` fields from the Message schema
- Removed `pre('find')` and `pre('findOne')` auto-populate hooks — all `.populate()` calls are now explicit at the call site
- Replaced the old `markChatAsRead` (used `global.io`) with `markRead` (uses `SocketManager`)
- Replaced the old `getMessageFromDB` (page-based) with `getHistory` (cursor-based pagination)
- Replaced the old `sendMessageToDB` (used `global.io`, no routing logic) with `send` (full notification routing via Redis active-chat tracking)
- Message type enum expanded: `text | image | media | doc | mixed` (was `text | image | both`)
- Attachments are now a structured array of objects (`{ type, url, name }`) instead of a plain string array

---

## Real-time Integration (Flutter)

For real-time message handling (Socket.io), room management, and event inventory, see the:
👉 **[Flutter Real-time Message Integration Guide](./FLUTTER_REALTIME_MESSAGE_GUIDE.md)**

---

## API Endpoints

All endpoints require a valid JWT in the `Authorization: Bearer <token>` header.

Allowed roles: `BROTHER`, `SISTER`, `SUPER_ADMIN`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/messages` | Send a message (text and/or file attachments) |
| `GET` | `/api/v1/messages/chat/:chatId` | Get message history (cursor-based pagination) |
| `POST` | `/api/v1/messages/chat/:chatId/read` | Mark all unread messages in a chat as read |

---

## Data Models

### Message Interface

```typescript
type AttachmentType = 'image' | 'audio' | 'video' | 'file';

type IMessageAttachment = {
  type: AttachmentType;
  url: string;
  name?: string;
};

type IMessage = {
  chatId: ObjectId;       // required — ref: Chat
  sender: ObjectId;       // required — ref: User
  text?: string;          // optional; required when type === 'text'; max 4000 chars
  type: 'text' | 'image' | 'media' | 'doc' | 'mixed';  // required
  attachments: IMessageAttachment[];  // max 10 items
  readBy: ObjectId[];     // max 1000 items
  createdAt: Date;
  updatedAt: Date;
  // REMOVED: deliveredTo, status (sent|delivered|seen), editedAt
};
```

**Indexes:**
- `{ chatId: 1, createdAt: -1 }` — efficient message history queries

**Validation:**
- When `type === 'text'`, `text` must be present and non-empty (Mongoose custom validator)

---

## Endpoint Details

### POST `/api/v1/messages`

Sends a message. Supports plain text, file uploads (images, video/audio, documents), or a combination. The `type` field is auto-detected by the route middleware based on what files are attached.

**Request — text only (JSON body):**
```json
{
  "chatId": "664f1a2b3c4d5e6f7a8b9c0d",
  "text": "Hello, when can we talk?"
}
```

**Request — with file attachments (multipart/form-data):**

| Field | Type | Description |
|-------|------|-------------|
| `chatId` | string | MongoDB ObjectId of the chat |
| `text` | string | Optional message text |
| `image` | file(s) | Image files (jpg, png, etc.) |
| `media` | file(s) | Video or audio files (mp4, webm, mov, mp3) |
| `doc` | file(s) | Document files (pdf, docx, etc.) |

The route middleware auto-detects `type`:
- Only text → `text`
- Only images → `image`
- Only video/audio → `media`
- Only documents → `doc`
- Any combination → `mixed`

**Success response (201):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Message sent successfully",
  "data": {
    "_id": "664f1a2b3c4d5e6f7a8b9c0e",
    "chatId": "664f1a2b3c4d5e6f7a8b9c0d",
    "sender": {
      "_id": "507f1f77bcf86cd799439013",
      "name": "John Doe",
      "profilePicture": "https://example.com/avatar.jpg"
    },
    "text": "Hello, when can we talk?",
    "type": "text",
    "attachments": [],
    "readBy": [],
    "createdAt": "2024-01-15T11:00:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | `chatId` is not a valid ObjectId |
| 400 | No text and no attachments (empty message) |
| 400 | `text` exceeds 10,000 characters |
| 400 | More than 10 attachments |
| 403 | Sender is not a participant of the chat |
| 404 | Chat not found |

---

### GET `/api/v1/messages/chat/:chatId`

Returns message history for a chat using cursor-based pagination. Messages are sorted ascending by `createdAt` (oldest first).

**URL params:**

| Param | Type | Description |
|-------|------|-------------|
| `chatId` | string | MongoDB ObjectId of the chat |

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `cursor` | string | No | ISO 8601 timestamp — returns messages strictly after this time |
| `limit` | number | No | Page size, 1–100, defaults to 20 |

**Success response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Chat messages retrieved successfully",
  "data": [
    {
      "_id": "664f1a2b3c4d5e6f7a8b9c0e",
      "chatId": "664f1a2b3c4d5e6f7a8b9c0d",
      "sender": {
        "_id": "507f1f77bcf86cd799439013",
        "name": "John Doe",
        "profilePicture": "https://example.com/avatar.jpg"
      },
      "text": "Hello!",
      "type": "text",
      "attachments": [],
      "readBy": ["507f1f77bcf86cd799439013"],
      "createdAt": "2024-01-15T11:00:00.000Z"
    }
  ],
  "meta": {
    "total": 42,
    "limit": 20,
    "hasNextPage": true,
    "nextCursor": "2024-01-15T11:00:00.000Z"
  }
}
```

**How to paginate:**
1. First call: no `cursor` param → gets the first 20 messages
2. If `meta.hasNextPage === true`, take `meta.nextCursor`
3. Next call: `?cursor=<nextCursor>` → gets the next page
4. Repeat until `hasNextPage === false`

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | `chatId` is not a valid ObjectId |
| 400 | `userId` (from JWT) is not a valid ObjectId |

---

### POST `/api/v1/messages/chat/:chatId/read`

Marks all unread messages in a chat as read for the authenticated user. Only marks messages sent by the **other** participant — never the caller's own messages.

**URL params:**

| Param | Type | Description |
|-------|------|-------------|
| `chatId` | string | MongoDB ObjectId of the chat |

**Success response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Chat messages marked as read",
  "data": {
    "modifiedCount": 3,
    "updatedIds": [
      "664f1a2b3c4d5e6f7a8b9c10",
      "664f1a2b3c4d5e6f7a8b9c11",
      "664f1a2b3c4d5e6f7a8b9c12"
    ]
  }
}
```

When there are no unread messages, returns `{ modifiedCount: 0, updatedIds: [] }` — no socket event is emitted in this case.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | `chatId` is not a valid ObjectId |
| 403 | User is not a participant of the chat |

---

## Notification Routing Logic

When `send` is called, after saving the message it determines how to notify the receiver using Redis:

```
Read active:{receiverId}:chat from Redis
         │
         ├── equals chatId ──────────────→ Do nothing (receiver is watching this chat)
         │
         ├── different chatId ───────────→ Emit CHAT_UPDATED to user::{receiverId}
         │                                  (receiver is online but in another chat)
         │
         └── key absent ─────────────────→ Send push notification
                                            (max 1 per 60s via notif:dedup:{chatId}:{receiverId})
```

All side effects (socket emit, Redis increment, push notification) are wrapped in individual `try/catch` blocks. If any of them fail, the error is logged with `errorLogger` and the saved message is still returned — side-effect failures never suppress the message.

---

## Redis Keys

| Key | Value | TTL | Purpose |
|-----|-------|-----|---------|
| `unread:{chatId}:{userId}` | integer string | none | Unread count per user per chat |
| `active:{userId}:chat` | chatId string | 3600s | Which chat the user currently has open |
| `notif:dedup:{chatId}:{userId}` | `"1"` | 60s | Push notification deduplication |

---

## Socket Events

| Event | Direction | Room | Payload | When |
|-------|-----------|------|---------|------|
| `MESSAGE_SENT` | Server → Client | `chat::{chatId}` | `{ message: IMessage }` | Message saved successfully |
| `CHAT_UPDATED` | Server → Client | `user::{receiverId}` | `{ lastMessage, unreadCount }` | Receiver is online but in a different chat |
| `MESSAGES_READ` | Server → Client | `chat::{chatId}` | `{ chatId, userId, updatedIds }` | `markRead` completes with ≥1 update |
| `TYPING_START` | Server → Client | `chat::{chatId}` | `{ userId, chatId }` | User starts typing |
| `TYPING_STOP` | Server → Client | `chat::{chatId}` | `{ userId, chatId }` | User stops typing |

---

## Testing with Postman

### 1. HTTP Endpoints

#### Send a text message

```
POST http://localhost:5000/api/v1/messages
Authorization: Bearer <your_jwt_token>
Content-Type: application/json

{
  "chatId": "664f1a2b3c4d5e6f7a8b9c0d",
  "text": "Hello!"
}
```

#### Send a message with image attachment

In Postman, set the request to `multipart/form-data`:

| Key | Type | Value |
|-----|------|-------|
| `chatId` | Text | `664f1a2b3c4d5e6f7a8b9c0d` |
| `text` | Text | `Here is the photo` |
| `image` | File | *(select an image file)* |

#### Get message history (first page)

```
GET http://localhost:5000/api/v1/messages/chat/664f1a2b3c4d5e6f7a8b9c0d
Authorization: Bearer <your_jwt_token>
```

#### Get next page using cursor

```
GET http://localhost:5000/api/v1/messages/chat/664f1a2b3c4d5e6f7a8b9c0d?cursor=2024-01-15T11:00:00.000Z&limit=20
Authorization: Bearer <your_jwt_token>
```

#### Mark all messages as read

```
POST http://localhost:5000/api/v1/messages/chat/664f1a2b3c4d5e6f7a8b9c0d/read
Authorization: Bearer <your_jwt_token>
```

No request body needed.

---

### 2. Real-time Socket Testing with Postman

Postman supports Socket.io natively (v9.13+).

#### Step 1 — Connect

1. In Postman, click **New → Socket.IO**
2. URL: `http://localhost:5000`
3. Under **Connection** tab, add handshake auth:
   - Key: `auth`
   - Value: `{ "token": "<your_jwt_token>" }`
4. Click **Connect**

#### Step 2 — Join a chat room

Emit `JOIN_CHAT` to start receiving messages for a specific chat:

- **Event:** `JOIN_CHAT`
- **Body (JSON):** `{ "chatId": "664f1a2b3c4d5e6f7a8b9c0d" }`

This writes `active:{userId}:chat` to Redis (3600s TTL) and joins the `chat::664f1a2b3c4d5e6f7a8b9c0d` room.

#### Step 3 — Listen for events

Add these listeners in the **Events** tab:

| Event | What triggers it |
|-------|-----------------|
| `MESSAGE_SENT` | The other user sends a message in this chat |
| `CHAT_UPDATED` | A message arrives while you're in a different chat |
| `MESSAGES_READ` | The other user calls the markRead endpoint |
| `TYPING_START` | The other user starts typing |
| `TYPING_STOP` | The other user stops typing |

#### Step 4 — Test the full send → receive flow

Open **two Postman windows**, each authenticated as a different user:

1. **User A** connects and emits `JOIN_CHAT` with `chatId`
2. **User B** connects and emits `JOIN_CHAT` with the same `chatId`
3. **User A** sends a message via `POST /api/v1/messages`
4. **User B** sees `MESSAGE_SENT` event arrive in real time
5. **User B** calls `POST /api/v1/messages/chat/:chatId/read`
6. **User A** sees `MESSAGES_READ` event arrive

#### Step 5 — Test notification routing

| Scenario | How to set it up | What you should see |
|----------|-----------------|---------------------|
| Receiver has chat open | User B emits `JOIN_CHAT` for this `chatId` | No push, no `CHAT_UPDATED` |
| Receiver in different chat | User B emits `JOIN_CHAT` for a **different** `chatId` | `CHAT_UPDATED` emitted to User B |
| Receiver offline | User B does not connect at all | Push notification sent (once per 60s) |

#### Step 6 — Test typing indicators

- **Event:** `TYPING_START`
- **Body:** `{ "chatId": "664f1a2b3c4d5e6f7a8b9c0d" }`

The other user (who has joined the same chat room) will receive a `TYPING_START` event. Emit `TYPING_STOP` when done.

---

## Service Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `send` | `(chatId, senderId, payload) → IMessage` | Save message, update lastMessage, run notification routing |
| `getHistory` | `(chatId, userId, cursor?, limit?) → IHistoryResult` | Cursor-based message history |
| `markRead` | `(chatId, userId) → IMarkReadResult` | Bulk mark unread messages as read, reset Redis count |

Legacy methods `sendMessageToDB`, `getMessageFromDB`, `markChatAsRead`, `markAsDelivered`, `getUnreadCount` remain in the service for backward compatibility but are no longer used by the controller.

---

## Error Reference

| Status | Message | Cause |
|--------|---------|-------|
| 400 | `Invalid chatId` | `chatId` is not a valid ObjectId |
| 400 | `Invalid senderId` | Sender ID from JWT is not a valid ObjectId |
| 400 | `Message must contain text or at least one attachment` | Empty message payload |
| 400 | `Message text exceeds maximum length` | `text` > 10,000 characters |
| 400 | `Attachments cannot exceed 10 items` | More than 10 files |
| 403 | `You are not a participant of this chat` | Sender or reader not in chat participants |
| 404 | `Chat not found` | `chatId` does not exist |

---

## Running Tests

```bash
# Run the full test suite (single pass, no watch mode)
npm run test:run
```

Test files for this module:
- `src/app/modules/message/__tests__/message.service.spec.ts` — unit tests
- `src/app/modules/message/__tests__/message.integration.spec.ts` — integration tests (send→getHistory round-trip, markRead Redis reset)
