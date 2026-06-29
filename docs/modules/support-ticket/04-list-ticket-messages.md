# 04. List Ticket Messages

```http
GET /support-tickets/:ticketId/messages
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

## 1. Overview
Paginated list of messages belonging to a single ticket. Threads in this system can grow into the hundreds for long-running cases, so the messages live in their own collection and are fetched with explicit pagination instead of being embedded inside the ticket document.

## 2. Business Rules
- Same `assertTicketAccess` check as [03-get-ticket-detail.md](./03-get-ticket-detail.md). Owner OR `SUPER_ADMIN`.
- Default sort is `createdAt` **ASC** (oldest first) so threaded UIs can render top-to-bottom. Override with `?sort=-createdAt` for reverse chronological.
- `senderId` is populated with `{ name, email, profileImage, role }`.

## 3. Query Parameters

| Param | Type | Default | Notes |
|---|---|---|---|
| `sort` | `string` | `createdAt` | `-createdAt` for newest first. |
| `page` | `number` | `1` | — |
| `limit` | `number` | `10` | Capped at `50`. |
| `senderType` | `enum` | — | Optional filter: `USER` or `ADMIN`. |

## 4. Implementation
- **Route**: `router.get('/:ticketId/messages', ...)` in [src/app/modules/support-ticket/support-ticket.route.ts](../../../src/app/modules/support-ticket/support-ticket.route.ts)
- **Controller**: `SupportTicketController.getTicketMessages`
- **Service**: `SupportTicketService.getTicketMessages` — loads the raw ticket first to authorize, then runs the QueryBuilder against `TicketMessage.find({ ticketId })`.

## 5. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Ticket messages fetched successfully",
  "meta": {
    "total": 3,
    "limit": 10,
    "page": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "data": [
    {
      "id": "664a1b2c3d4e5f6a7b8c9d0f",
      "ticketId": "664a1b2c3d4e5f6a7b8c9d0e",
      "senderType": "USER",
      "senderId": {
        "id": "664a1b2c3d4e5f6a7b8c9d0a",
        "name": "Jane Doe",
        "role": "SISTER",
        "profileImage": "..."
      },
      "message": "My card was charged but the subscription didn't activate.",
      "attachments": [
        { "type": "image", "url": "http://localhost:5000/uploads/images/1715430000-ab12cd.png", "name": "1715430000-ab12cd.png" }
      ],
      "createdAt": "2026-05-11T10:00:00.000Z"
    },
    {
      "id": "664a1b2c3d4e5f6a7b8c9d11",
      "senderType": "ADMIN",
      "senderId": { "id": "664a1b2c3d4e5f6a7b8c9d10", "name": "Admin User", "role": "SUPER_ADMIN" },
      "message": "Thanks for the report — checking with payments now.",
      "createdAt": "2026-05-11T10:30:00.000Z"
    }
  ]
}
```

### Error: Forbidden (403)
```json
{ "success": false, "statusCode": 403, "message": "You do not have access to this ticket" }
```

### Error: Not found (404)
```json
{ "success": false, "statusCode": 404, "message": "Ticket not found" }
```
