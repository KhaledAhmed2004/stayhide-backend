# Chat Module APIs

> **Section**: Backend API specifications for the Chat module.
> **Base URL**: `{{baseUrl}}` = `http://localhost:5000/api/v1`
> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)

---

## Database Design

### Chat Model (`chats`)
Stores conversation metadata between two users.

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `participants` | Array<ObjectId> | ✅ | Exactly two users (ref `User`) |
| `status` | Boolean | ✅ | `true` (active), `false` (inactive/removed) |

**Indexes**:
- `{ participants: 1 }` — Fast lookup for a user's chats

---

## Unified API Registry

| # | Method | Endpoint | Auth | Purpose & Status | Documentation |
|---|---|---|---|---|---|
| 01 | POST | `/chats/:otherUserId` | `BROTHER`, `SISTER`, `SUPER_ADMIN` | ✅ Done: Creates or retrieves a chat with another user. | [01-create-get-chat.md](./01-create-get-chat.md) |
| 02 | GET | `/chats` | `BROTHER`, `SISTER`, `SUPER_ADMIN` | ✅ Done: Lists all chats for the user. | [02-list-my-chats.md](./02-list-my-chats.md) |
