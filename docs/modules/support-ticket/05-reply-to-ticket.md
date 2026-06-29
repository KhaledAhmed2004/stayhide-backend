# 05. Reply To Ticket

```http
POST /support-tickets/:ticketId/reply
Content-Type: multipart/form-data
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

## 1. Overview
Adds a new message to an existing ticket. The same endpoint serves both sides — `senderType` is inferred from the JWT role, not the body:

| JWT role | `senderType` recorded |
|---|---|
| `BROTHER`, `SISTER` | `USER` |
| `SUPER_ADMIN` | `ADMIN` |

## 2. Business Rules

### 2.1 Authorization
- The service loads the raw ticket and runs `assertTicketAccess`:
  - `SUPER_ADMIN` → always allowed.
  - Otherwise the requester's `id` must equal `ticket.userId`.
- Otherwise `403 Forbidden`.

### 2.2 Status Auto-transitions
After the reply is persisted, the parent ticket's `status` may flip:

| Reply by | Previous status | New status |
|---|---|---|
| USER | `RESOLVED` | `REOPENED` |
| USER | `CLOSED` | `REOPENED` |
| ADMIN | `OPEN` | `IN_PROGRESS` |
| ADMIN | `REOPENED` | `IN_PROGRESS` |
| Any | other | unchanged |

When the status changes, `TICKET_STATUS_CHANGED` is emitted in addition to `TICKET_REPLY`.

### 2.3 Assignment
If `senderType === 'ADMIN'` and `assignedAdminId` is currently `null`, it's set to the replying admin atomically with the same update.

### 2.4 Counters & Timestamps
On every reply (regardless of status change):
- `lastReplyAt` = now
- `lastReplyBy` = the new sender type
- `messagesCount` is incremented by `$inc: { messagesCount: 1 }`

### 2.5 Attachments
Same handling as [01-create-ticket.md](./01-create-ticket.md) — up to 5 files, ≤ 25 MB each, field name `attachments`.

### 2.6 Real-time
After the reply is committed, `TICKET_REPLY` is emitted to:
- `ticket::{ticketId}` — anyone currently viewing the ticket detail.
- `user::{ownerId}` — the user's other sessions (push them an unread badge).
- `admin-tickets` — every connected `SUPER_ADMIN`.

See [11-socket-events.md](./11-socket-events.md).

## 3. Request

### URL params
| Param | Type | Constraint |
|---|---|---|
| `ticketId` | `string` | 24-char hex |

### Body (multipart/form-data)
| Field | Type | Required | Constraint |
|---|---|---|---|
| `message` | `string` | Yes | 1–5000 chars, trimmed |
| `attachments` | `file[]` | No | ≤ 5 files, each ≤ 25 MB |

## 4. Implementation
- **Route**: `router.post('/:ticketId/reply', ...)` — [src/app/modules/support-ticket/support-ticket.route.ts](../../../src/app/modules/support-ticket/support-ticket.route.ts)
- **Controller**: `SupportTicketController.replyToTicket`
- **Service**: `SupportTicketService.replyToTicket`
- **Validation**: `SupportTicketValidation.replyTicketZodSchema`

**Middleware order**: `auth(BROTHER, SISTER, SUPER_ADMIN)` → `fileHandler` → `validateRequest` → controller.

## 5. Responses

### Success (201)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Reply sent successfully",
  "data": {
    "ticket": {
      "id": "664a1b2c3d4e5f6a7b8c9d0e",
      "status": "IN_PROGRESS",
      "lastReplyAt": "2026-05-11T10:30:00.000Z",
      "lastReplyBy": "ADMIN",
      "messagesCount": 2,
      "assignedAdminId": "664a1b2c3d4e5f6a7b8c9d10"
    },
    "message": {
      "id": "664a1b2c3d4e5f6a7b8c9d11",
      "ticketId": "664a1b2c3d4e5f6a7b8c9d0e",
      "senderType": "ADMIN",
      "senderId": "664a1b2c3d4e5f6a7b8c9d10",
      "message": "Thanks for the report — checking with payments now.",
      "attachments": [],
      "createdAt": "2026-05-11T10:30:00.000Z"
    }
  }
}
```

### Error: Empty message (400)
```json
{ "success": false, "statusCode": 400, "message": "Validation Error", "errorMessages": [{ "path": "body.message", "message": "Message cannot be empty" }] }
```

### Error: Forbidden (403)
```json
{ "success": false, "statusCode": 403, "message": "You do not have access to this ticket" }
```

### Error: Not found (404)
```json
{ "success": false, "statusCode": 404, "message": "Ticket not found" }
```
