# Connection Module APIs

> **Section**: Backend API specifications for the Connection module.
> **Base URL**: `{{baseUrl}}` = `http://localhost:5000/api/v1`
> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)
> **UX Flows referencing this module**:
> - App - User Profile — Send connection request, check status
> - App - Connection List — View accepted connections, respond to pending requests

---

## Database Design

### Connection Model (`connections`)
Stores connection requests and established connections between users.

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `sender` | ObjectId | ✅ | Reference to the user who sent the request (ref `User`) |
| `receiver` | ObjectId | ✅ | Reference to the user who receives the request (ref `User`) |
| `connectionKey` | String | ✅ | Deterministic key `min(userId, otherUserId)_max(userId, otherUserId)` |
| `status` | String | ✅ | Enum: `PENDING`, `ACCEPTED` |
| `chatId` | ObjectId | ❌ | Reference to the created Chat (ref `Chat`) |
| `respondedAt` | Date | ❌ | Timestamp when the request was accepted |

**Indexes**:
- `{ connectionKey: 1 }` (Unique) — Prevents duplicate A->B and B->A requests
- `{ receiver: 1, status: 1 }` — Fast lookup for incoming pending requests
- `{ sender: 1, status: 1 }` — Fast lookup for outgoing pending requests

---

## Unified API Registry

| # | Method | Endpoint | Auth | Purpose & Status | Documentation |
|---|---|---|---|---|---|
| 01 | POST | `/connections` | `BROTHER`, `SISTER` | ✅ Done: Sends a connection request to a user. | [01-send-connection-request.md](./01-send-connection-request.md) |
| 02 | POST | `/connections/:connectionId/accept` | `BROTHER`, `SISTER` | ✅ Done: Accepts a pending connection request. | [02-accept-request.md](./02-accept-request.md) |
| 03 | POST | `/connections/:connectionId/reject` | `BROTHER`, `SISTER` | ✅ Done: Rejects a pending connection request. | [03-reject-request.md](./03-reject-request.md) |
| 04 | POST | `/connections/:connectionId/cancel` | `BROTHER`, `SISTER` | ✅ Done: Cancels a pending request (sender only). | [04-cancel-request.md](./04-cancel-request.md) |
| 05 | POST | `/connections/:connectionId/remove` | `BROTHER`, `SISTER` | ✅ Done: Removes an established connection. | [05-remove-connection.md](./05-remove-connection.md) |
| 06 | GET | `/connections` | `BROTHER`, `SISTER` | ✅ Done: Fetches my accepted connections. | [06-list-my-connections.md](./06-list-my-connections.md) |
| 07 | GET | `/connections/requests` | `BROTHER`, `SISTER` | ✅ Done: Fetches pending requests (`?direction=sent\|received`). | [07-list-pending-requests.md](./07-list-pending-requests.md) |

---

## Cross-Module Usage

### Enriched User Profile Discovery (`GET /users/profiles`)

The **User module's** community discovery endpoint (`GET /api/v1/users/profiles`) and public profile endpoint (`GET /api/v1/users/:userId/public`) performs a server-side `$lookup` against the `connections` collection for every profile returned. This means the frontend does **not** need to call `GET /connections/status/:userId` for each profile card — the status is already embedded.

Each item in the `data[]` array includes:

| Field | Type | Description |
| :--- | :--- | :--- |
| `connectionStatus` | `string` | One of `NONE`, `PENDING_SENT`, `PENDING_RECEIVED`, `CONNECTED` |
| `connectionId` | `ObjectId \| null` | The `_id` of the `Connection` document, or `null` if status is `NONE` |
| `chatId` | `ObjectId \| null` | The `chatId` of the connection if `status` is `CONNECTED` |

**How statuses are derived from this module's model:**

| `connections` document state | `connectionStatus` |
| :--- | :--- |
| Document does not exist | `NONE` |
| Document exists with `status: "PENDING"` and `sender` is me | `PENDING_SENT` |
| Document exists with `status: "PENDING"` and `receiver` is me | `PENDING_RECEIVED` |
| Document exists with `status: "ACCEPTED"` | `CONNECTED` |

> **Note**: Rejecting or cancelling a request **deletes** the connection document entirely (see `cancelConnectionRequest` and `respondToConnectionRequest(REJECTED)` in the service). This means a rejected/cancelled state always surfaces as `NONE` in subsequent profile list calls.

