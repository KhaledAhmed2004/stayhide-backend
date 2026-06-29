# Chat Module

## Overview

The Chat module manages 1-on-1 conversations between users. It was refactored to eliminate N+1 query patterns, replace MongoDB-based unread counts with Redis, and serve the full chat list in a single database query plus one batched Redis read.

**What changed in the refactor:**
- Removed the `status` boolean field from the Chat schema
- Added a denormalized `lastMessage` sub-document so the chat list needs no per-chat message query
- Replaced per-chat `Message.countDocuments` unread queries with a single batched Redis `MGET`
- Replaced `global.io` with the typed `SocketManager` singleton
- All `populate()` calls are now explicit at the call site — no auto-populate hooks

---

## API Endpoints

All endpoints require a valid JWT in the `Authorization: Bearer <token>` header.

Allowed roles: `BROTHER`, `SISTER`, `SUPER_ADMIN`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/chats/:otherUserId` | Create or retrieve a chat with another user |
| `GET` | `/api/v1/chats` | Get the logged-in user's chat list |

---

## Data Models

### Chat Schema

```typescript
type ILastMessage = {
  text: string;       // max 2000 characters
  sender: ObjectId;   // ref: User
  createdAt: Date;
};

type IChat = {
  participants: ObjectId[];   // exactly 2 User refs
  lastMessage: ILastMessage | null;
  createdAt: Date;
  updatedAt: Date;
  // NOTE: 'status' boolean field was removed in the refactor
};
```

**Indexes:**
- `{ participants: 1 }` — fast participant-based lookups

---

## Endpoint Details

### POST `/api/v1/chats/:otherUserId`

Creates a new chat between the authenticated user and `otherUserId`. If a chat already exists between them, returns the existing one (idempotent).

**URL params:**

| Param | Type | Description |
|-------|------|-------------|
| `otherUserId` | string | MongoDB ObjectId of the other user |

**Success response (201):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Chat created or retrieved successfully",
  "data": {
    "_id": "664f1a2b3c4d5e6f7a8b9c0d",
    "participants": [
      "507f1f77bcf86cd799439013",
      "507f1f77bcf86cd799439015"
    ],
    "lastMessage": null,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | `otherUserId` is not a valid ObjectId |
| 400 | `userId === otherUserId` (cannot chat with yourself) |
| 404 | `otherUserId` does not exist in the User collection |

---

### GET `/api/v1/chats`

Returns the authenticated user's chat list, sorted by most recent message first. Chats with no messages appear last.

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `search` | string | No | Case-insensitive filter on the other participant's name |

**Success response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Chat list retrieved successfully",
  "data": [
    {
      "_id": "664f1a2b3c4d5e6f7a8b9c0d",
      "participants": [
        {
          "_id": "507f1f77bcf86cd799439013",
          "name": "John Doe",
          "image": "https://example.com/avatar1.jpg",
          "role": "BROTHER"
        },
        {
          "_id": "507f1f77bcf86cd799439015",
          "name": "Jane Smith",
          "image": "https://example.com/avatar2.jpg",
          "role": "SISTER"
        }
      ],
      "lastMessage": {
        "text": "When can you start?",
        "sender": "507f1f77bcf86cd799439013",
        "createdAt": "2024-01-15T11:00:00.000Z"
      },
      "unreadCount": 2,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T11:00:00.000Z"
    }
  ]
}
```

**Notes:**
- `unreadCount` is fetched from Redis in a single batched `MGET`. If Redis is unavailable, it falls back to `0` for all chats — no error is thrown.
- `participants` is populated with `_id`, `name`, `image`, `role` only.
- `search` filters on the **other** participant's name (not the logged-in user's own name).

---

## Redis Keys

| Key | Value | TTL | Purpose |
|-----|-------|-----|---------|
| `unread:{chatId}:{userId}` | integer string | none | Unread message count per user per chat |
| `active:{userId}:chat` | chatId string | 3600s | Which chat the user currently has open |

---

## Socket Events (Real-time)

The chat module participates in these socket events. See the Message module README for the full send/read flow.

| Event | Direction | Payload | When |
|-------|-----------|---------|------|
| `JOIN_CHAT` | Client → Server | `{ chatId }` | User opens a chat |
| `LEAVE_CHAT` | Client → Server | `{ chatId }` | User closes a chat |
| `CHAT_UPDATED` | Server → Client | `{ lastMessage, unreadCount }` | A new message arrives while receiver is in a different chat |

---

## Testing with Postman

### 1. HTTP Endpoints

#### Create or get a chat

```
POST http://localhost:5000/api/v1/chats/507f1f77bcf86cd799439015
Authorization: Bearer <your_jwt_token>
```

No request body needed — the other user's ID is in the URL.

#### Get chat list

```
GET http://localhost:5000/api/v1/chats
Authorization: Bearer <your_jwt_token>
```

With search:
```
GET http://localhost:5000/api/v1/chats?search=John
Authorization: Bearer <your_jwt_token>
```

---

### 2. Real-time Socket Testing with Postman

Postman supports Socket.io connections natively (v9.13+).

#### Step 1 — Open a Socket.io connection

1. In Postman, click **New → Socket.IO**
2. Enter your server URL: `http://localhost:5000`
3. Under **Connection** tab, add a handshake auth header:
   - Key: `auth`
   - Value: `{ "token": "<your_jwt_token>" }`
4. Click **Connect**

You should see a `connect` event in the event log confirming the connection.

#### Step 2 — Join a chat room

After connecting, emit `JOIN_CHAT` to start receiving messages for a specific chat:

- **Event name:** `JOIN_CHAT`
- **Message (JSON):**
```json
{ "chatId": "664f1a2b3c4d5e6f7a8b9c0d" }
```

This writes `active:{userId}:chat` to Redis with a 3600s TTL and joins the socket to the `chat::664f1a2b3c4d5e6f7a8b9c0d` room.

#### Step 3 — Listen for incoming events

Add listeners for these events in the **Events** tab:

| Event to listen for | When you'll see it |
|--------------------|--------------------|
| `MESSAGE_SENT` | Another user sends a message in this chat |
| `CHAT_UPDATED` | A message arrives in a chat you're NOT currently viewing |
| `MESSAGES_READ` | The other user marks messages as read |
| `TYPING_START` | The other user starts typing |
| `TYPING_STOP` | The other user stops typing |
| `USER_ONLINE` | A participant joins the chat room |
| `USER_OFFLINE` | A participant leaves or disconnects |

#### Step 4 — Leave a chat room

Emit `LEAVE_CHAT` when done:

- **Event name:** `LEAVE_CHAT`
- **Message (JSON):**
```json
{ "chatId": "664f1a2b3c4d5e6f7a8b9c0d" }
```

This deletes `active:{userId}:chat` from Redis and leaves the socket room.

#### Step 5 — Test the full flow end-to-end

Open **two Postman windows** (or two browser tabs using a Socket.io client), each authenticated as a different user:

1. **User A** connects and emits `JOIN_CHAT` with a shared `chatId`
2. **User B** connects and emits `JOIN_CHAT` with the same `chatId`
3. **User A** sends a message via `POST /api/v1/messages` (HTTP)
4. **User B** should immediately receive a `MESSAGE_SENT` event in Postman
5. **User B** calls `POST /api/v1/messages/chat/:chatId/read` (HTTP)
6. **User A** should receive a `MESSAGES_READ` event

#### Notification routing test

To test the three notification routing paths:

| Scenario | Setup | Expected result |
|----------|-------|-----------------|
| Receiver has chat open | User B has emitted `JOIN_CHAT` for this chatId | No push, no `CHAT_UPDATED` |
| Receiver in different chat | User B has emitted `JOIN_CHAT` for a **different** chatId | `CHAT_UPDATED` emitted to User B's user room |
| Receiver offline | User B has not connected at all | Push notification sent (once per 60s) |

---

## Service Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `createOrGet` | `(userId, otherUserId) → IChat` | Find existing chat or create new one |
| `getList` | `(userId, search?) → IChatListItem[]` | Get user's chat list with unread counts |

Legacy methods `createChatToDB` and `getChatFromDB` remain in the service for backward compatibility but are no longer used by the controller.

---

## Error Reference

| Status | Message | Cause |
|--------|---------|-------|
| 400 | `Invalid userId` | `userId` is not a valid ObjectId |
| 400 | `Invalid otherUserId` | `otherUserId` is not a valid ObjectId |
| 400 | `Cannot create a chat with yourself` | Both IDs are the same |
| 404 | `User not found` | `otherUserId` does not exist |

---

## Running Tests

```bash
# Run the full test suite (single pass, no watch mode)
npm run test:run
```

Test files for this module:
- `src/app/modules/chat/__tests__/chat.service.spec.ts` — unit tests
- `src/app/modules/message/__tests__/message.integration.spec.ts` — integration tests including `getList` Redis fallback
