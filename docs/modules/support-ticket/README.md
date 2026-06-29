# Support Ticket Module APIs

> **Section**: Backend API specifications for the support-ticket module — endpoints under `/api/v1/support-tickets/*`.
> **Base URL**: `{{baseUrl}}` = `http://localhost:5000/api/v1`
> **Source**: [src/app/modules/support-ticket/](../../../src/app/modules/support-ticket/)
> **Response format**: See [Standard Response Envelope](../../system-concepts.md#standard-response-envelope) if available.

The module exposes a help-desk system with two collections — **SupportTicket** (parent) and **TicketMessage** (replies). Replies are paginated separately from the ticket detail to keep responses small. Real-time updates flow through Socket.IO rooms documented in [11-socket-events.md](./11-socket-events.md).

---

## Endpoints Index

| # | Method | Endpoint | Auth | Documentation |
|---|---|---|---|---|
| 01 | POST | `/support-tickets` | BROTHER, SISTER | [01-create-ticket.md](./01-create-ticket.md) |
| 02 | GET | `/support-tickets/my` | BROTHER, SISTER | [02-list-my-tickets.md](./02-list-my-tickets.md) |
| 03 | GET | `/support-tickets/:ticketId` | BROTHER, SISTER, SUPER_ADMIN | [03-get-ticket-detail.md](./03-get-ticket-detail.md) |
| 04 | GET | `/support-tickets/:ticketId/messages` | BROTHER, SISTER, SUPER_ADMIN | [04-list-ticket-messages.md](./04-list-ticket-messages.md) |
| 05 | POST | `/support-tickets/:ticketId/reply` | BROTHER, SISTER, SUPER_ADMIN | [05-reply-to-ticket.md](./05-reply-to-ticket.md) |
| 06 | GET | `/support-tickets/admin/list` | SUPER_ADMIN | [06-admin-list-tickets.md](./06-admin-list-tickets.md) |
| 07 | GET | `/support-tickets/admin/stats` | SUPER_ADMIN | [07-admin-ticket-stats.md](./07-admin-ticket-stats.md) |
| 08 | PATCH | `/support-tickets/admin/:ticketId/status` | SUPER_ADMIN | [08-admin-update-status.md](./08-admin-update-status.md) |
| 09 | PATCH | `/support-tickets/admin/:ticketId/priority` | SUPER_ADMIN | [09-admin-update-priority.md](./09-admin-update-priority.md) |
| 10 | PATCH | `/support-tickets/admin/:ticketId/assign` | SUPER_ADMIN | [10-admin-assign-ticket.md](./10-admin-assign-ticket.md) |
| -- | WS | Socket.IO events | Authenticated socket | [11-socket-events.md](./11-socket-events.md) |

---

## Status Lifecycle

```
OPEN ─────────► IN_PROGRESS ──────► RESOLVED ──────► CLOSED
  ▲                  ▲                  │
  │                  │                  ▼
  │                  └──────────── REOPENED
  │
  └─ initial state on create
```

**Manual transitions (admin via PATCH `/admin/:ticketId/status`):**

| From | Allowed `to` |
|---|---|
| `OPEN` | `IN_PROGRESS`, `RESOLVED`, `CLOSED` |
| `IN_PROGRESS` | `OPEN`, `RESOLVED`, `CLOSED` |
| `RESOLVED` | `CLOSED`, `REOPENED` |
| `REOPENED` | `IN_PROGRESS`, `RESOLVED`, `CLOSED` |
| `CLOSED` | `REOPENED` |

**Automatic transitions (driven by replies, not the status endpoint):**

| Reply by | Current status | New status |
|---|---|---|
| USER | `RESOLVED` | `REOPENED` |
| USER | `CLOSED` | `REOPENED` |
| ADMIN | `OPEN` | `IN_PROGRESS` |
| ADMIN | `REOPENED` | `IN_PROGRESS` |

Any transition outside the manual table returns `400 Invalid status transition`.

---

## Role Matrix

| Endpoint | BROTHER / SISTER | SUPER_ADMIN |
|---|:---:|:---:|
| POST `/support-tickets` | ✅ create own | — |
| GET `/support-tickets/my` | ✅ own | — |
| GET `/support-tickets/:ticketId` | ✅ if owner | ✅ any |
| GET `/support-tickets/:ticketId/messages` | ✅ if owner | ✅ any |
| POST `/support-tickets/:ticketId/reply` | ✅ if owner | ✅ any |
| GET `/support-tickets/admin/list` | ❌ | ✅ |
| GET `/support-tickets/admin/stats` | ❌ | ✅ |
| PATCH `/support-tickets/admin/:ticketId/*` | ❌ | ✅ |

Non-owner non-admin access to a ticket returns `403 Forbidden`.

---

## Data Model Summary

| Collection | Purpose |
|---|---|
| `supporttickets` | Ticket metadata, status, priority, denormalised `lastReplyAt`, `lastReplyBy`, `messagesCount`, `assignedAdminId`. |
| `ticketmessages` | One document per reply (including the first user message on create). Embedded `attachments[]`. |
| `supportticketcounters` | Internal monotonic counter for human-readable `TCK-####` numbers. Not part of the public API. |

Source: [src/app/modules/support-ticket/support-ticket.model.ts](../../../src/app/modules/support-ticket/support-ticket.model.ts) · [src/app/modules/support-ticket/support-ticket.interface.ts](../../../src/app/modules/support-ticket/support-ticket.interface.ts)

---

## Related Modules

- [../user/](../user/) — `userId` and `assignedAdminId` reference the User collection.
- [../notification/](../notification/) — not yet integrated, but on the roadmap for offline reply notifications.
