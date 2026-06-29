# Flutter Real-time Message Integration Guide (Core Events)

This guide summarizes the essential Socket.IO events for Flutter integration.

---

### 1. Room Management

| Event Name | Type | Payload | Description |
|------------|------|---------|-------------|
| `JOIN_CHAT` | **Emit** | `{"chatId": "ID"}` | Join a chat room to start receiving messages. |
| `LEAVE_CHAT`| **Emit** | `{"chatId": "ID"}` | Leave a chat room when exiting the screen. |

---

### 2. Message Events

| Event Name | Type | Payload Shape | Description |
|------------|------|---------------|-------------|
| `MESSAGE_SENT` | **Listen** | `MessageObject` | New message received in the chat. |
| `DELIVERED_ACK`| **Emit** | `{"messageId": "ID"}` | Tell server you received the message (Foreground). |
| `READ_ACK`     | **Emit** | `{"messageId": "ID"}` | Tell server you opened/read the message. |
| `MESSAGE_DELIVERED` | **Listen** | `{"messageId": "ID", "chatId": "ID", "userId": "ID"}` | Your sent message was delivered to the other user. |
| `MESSAGES_READ` | **Listen** | `{"chatId": "ID", "userId": "ID", "updatedIds": ["ID"]}` | Your messages were read by the other user. |

---

### 3. User Presence

| Event Name | Type | Payload Shape | Description |
|------------|------|---------------|-------------|
| `USER_ONLINE`  | **Listen** | `{"userId": "ID", "chatId": "ID", "lastActive": Date}` | Other user is now online in the chat. |
| `USER_OFFLINE` | **Listen** | `{"userId": "ID", "chatId": "ID", "lastActive": Date}` | Other user went offline. |

---

### 4. Implementation Notes

- **Connection:** Pass JWT in `auth: {'token': userJwt}`.
- **Deduplication:** Always use `message['id']` to check if a message received via socket already exists in your local list (from HTTP response).
- **Error Handling:** Listen to `ACK_ERROR` for any server-side validation failures.
