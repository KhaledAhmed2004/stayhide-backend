# 11. Socket.IO Events

Real-time fan-out for the support-ticket module. All authentication, room joining, and broadcast emission lives in [src/helpers/socketHelper.ts](../../../src/helpers/socketHelper.ts) — the same pipe that powers chat/message.

---

## 1. Authentication
Identical to the rest of the socket layer:
- The client connects with `auth: { token: '<JWT>' }` or `query.token=<JWT>`.
- Server verifies via `jwtHelper.verifyToken`.
- A failed verification disconnects the socket immediately.
- The decoded payload's `id` and `role` are used downstream.

## 2. Rooms

| Room | Who's in it | Joined by |
|---|---|---|
| `user::{userId}` | The user's own active sessions | Auto on connect (existing behavior) |
| `ticket::{ticketId}` | Owner + admins currently viewing the ticket detail | Client emits `JOIN_TICKET` |
| `admin-tickets` | All connected `SUPER_ADMIN` sockets | Auto on connect when JWT role is `SUPER_ADMIN` |

`admin-tickets` is the global "ticket inbox" stream — any admin who's online sees new tickets and replies without per-ticket subscriptions.

## 3. Client → Server events

### `JOIN_TICKET`
```ts
socket.emit('JOIN_TICKET', { ticketId: string });
```
- Server verifies the ticket exists.
- Authorizes — owner OR `SUPER_ADMIN`.
- On success the socket joins `ticket::{ticketId}`.
- On failure emits `ACK_ERROR { message, ticketId }`.

### `LEAVE_TICKET`
```ts
socket.emit('LEAVE_TICKET', { ticketId: string });
```
Leaves the room. No authorization (no information leaks from leaving a room you may not be in).

## 4. Server → Client events

### `TICKET_CREATED`
Emitted on `POST /support-tickets` success.
Rooms: `user::{ownerId}`, `admin-tickets`.

Payload:
```json
{
  "ticket": { "id": "...", "ticketNumber": "TCK-1001", "status": "OPEN", ... },
  "message": { "id": "...", "senderType": "USER", "message": "...", "attachments": [...] }
}
```

### `TICKET_REPLY`
Emitted on `POST /support-tickets/:ticketId/reply` success.
Rooms: `ticket::{ticketId}`, `user::{ownerId}`, `admin-tickets`.

Payload:
```json
{
  "ticket": { "id": "...", "status": "IN_PROGRESS", "lastReplyAt": "...", "lastReplyBy": "ADMIN", "messagesCount": 3 },
  "message": { "id": "...", "senderType": "ADMIN", "message": "...", "createdAt": "..." }
}
```

### `TICKET_STATUS_CHANGED`
Emitted on:
- Admin `PATCH /admin/:ticketId/status`
- Reply-driven auto-transitions (USER → REOPENED, ADMIN → IN_PROGRESS)

Rooms: `ticket::{ticketId}`, `user::{ownerId}`, plus `admin-tickets` when triggered from the admin endpoint.

Payload:
```json
{ "ticketId": "...", "from": "RESOLVED", "to": "REOPENED" }
```

### `TICKET_PRIORITY_CHANGED`
Emitted on `PATCH /admin/:ticketId/priority`.
Rooms: `ticket::{ticketId}`, `admin-tickets`. *Not* sent to the user — priority is internal triage.

Payload:
```json
{ "ticketId": "...", "from": "MEDIUM", "to": "HIGH" }
```

### `ACK_ERROR`
Emitted to the originating socket only, when a `JOIN_TICKET` is denied.
```json
{ "message": "You do not have access to this ticket", "ticketId": "..." }
```

## 5. Client integration sketch

```ts
const socket = io(BASE_URL, { auth: { token } });

socket.on('TICKET_CREATED', ({ ticket, message }) => { /* admin inbox prepend */ });
socket.on('TICKET_REPLY',   ({ ticket, message }) => { /* append to thread, bump unread */ });
socket.on('TICKET_STATUS_CHANGED',   p => { /* update ticket card */ });
socket.on('TICKET_PRIORITY_CHANGED', p => { /* admin card only */ });
socket.on('ACK_ERROR', e => console.warn('socket:', e));

// On opening a ticket page:
socket.emit('JOIN_TICKET', { ticketId });
// On leaving:
socket.emit('LEAVE_TICKET', { ticketId });
```

## 6. Notes for clients
- `TICKET_REPLY` lands on multiple rooms — your handler may be called twice if you're both the owner *and* viewing the ticket. Dedupe by `message.id` or use the same handler idempotently.
- `admin-tickets` is large-fan-out — if you build an admin SPA, throttle UI animations triggered by these events.
- HTTP and Socket.IO are independent transports. After a REST reply succeeds the response body already contains the new ticket+message; the socket event is for *other* connected clients, not the original requester. Reconciliation: trust whichever arrives first and key off `message.id`.
