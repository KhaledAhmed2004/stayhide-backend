# 02. List My Tickets

```http
GET /support-tickets/my
Auth: Bearer {{accessToken}} (BROTHER, SISTER)
```

## 1. Overview
Paginated list of tickets opened by the authenticated user. Admins are blocked here on purpose — they use [`/admin/list`](./06-admin-list-tickets.md) which returns every user's tickets.

## 2. Query Parameters
All optional. Filters are applied via the shared [QueryBuilder](../../../src/app/builder/QueryBuilder.ts).

| Param | Type | Default | Notes |
|---|---|---|---|
| `searchTerm` | `string` | — | Case-insensitive substring match against `subject` and `ticketNumber`. |
| `status` | `enum` | — | One of `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, `REOPENED`. |
| `priority` | `enum` | — | `LOW`, `MEDIUM`, `HIGH`. |
| `category` | `enum` (comma-list) | — | Multi-select via `?category=BILLING,BUG`. |
| `sort` | `string` | `-createdAt` | Standard QueryBuilder syntax (e.g. `-lastReplyAt`). |
| `page` | `number` | `1` | — |
| `limit` | `number` | `10` | Capped at `50`. |
| `fields` | `string` | all (`-__v`) | Comma-separated field projection. |

## 3. Implementation
- **Route**: `router.get('/my', ...)` in [src/app/modules/support-ticket/support-ticket.route.ts](../../../src/app/modules/support-ticket/support-ticket.route.ts)
- **Controller**: `SupportTicketController.getMyTickets`
- **Service**: `SupportTicketService.getMyTickets` — uses `QueryBuilder(SupportTicket.find({ userId }), query).search(['subject','ticketNumber']).filter().sort().paginate().fields()`.

Result is returned through `.lean()` for read performance.

## 4. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "My tickets fetched successfully",
  "meta": {
    "total": 12,
    "limit": 10,
    "page": 1,
    "totalPages": 2,
    "hasNext": true,
    "hasPrev": false
  },
  "data": [
    {
      "id": "664a1b2c3d4e5f6a7b8c9d0e",
      "ticketNumber": "TCK-1001",
      "subject": "Payment failed but charged",
      "status": "IN_PROGRESS",
      "priority": "HIGH",
      "category": "BILLING",
      "lastReplyAt": "2026-05-11T11:24:30.000Z",
      "lastReplyBy": "ADMIN",
      "messagesCount": 3
    }
  ]
}
```

### Error: Forbidden role (403)
Returned when a `SUPER_ADMIN` token is used.
```json
{ "success": false, "statusCode": 403, "message": "You don't have permission to access this API" }
```
