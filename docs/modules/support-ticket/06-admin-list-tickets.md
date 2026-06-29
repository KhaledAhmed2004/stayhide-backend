# 06. Admin — List Tickets

```http
GET /support-tickets/admin/list
Auth: Bearer {{accessToken}} (SUPER_ADMIN)
```

## 1. Overview
Admin queue. Returns every ticket in the system with the opener's user data populated, paginated and filterable.

## 2. Query Parameters

| Param | Type | Default | Notes |
|---|---|---|---|
| `searchTerm` | `string` | — | Case-insensitive substring on `subject` and `ticketNumber`. |
| `status` | `enum` | — | `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, `REOPENED`. |
| `priority` | `enum` | — | `LOW`, `MEDIUM`, `HIGH`. |
| `category` | `enum` (comma-list) | — | e.g. `?category=BILLING,BUG`. |
| `assignedAdminId` | `ObjectId` | — | Filter to one admin's queue. |
| `sort` | `string` | `-createdAt` | Try `-lastReplyAt` to surface oldest awaiting reply. |
| `page` | `number` | `1` | |
| `limit` | `number` | `10` | Capped at `50`. |

## 3. Implementation
- **Route**: `router.get('/admin/list', ...)` — declared **before** `/:ticketId` so Express doesn't match `admin` as a ticketId.
- **Controller**: `SupportTicketController.getAllTickets`
- **Service**: `SupportTicketService.getAllTickets` — uses `QueryBuilder(SupportTicket.find().populate('userId', 'name email profileImage'), query)`.

## 4. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Tickets fetched successfully",
  "meta": {
    "total": 132,
    "limit": 10,
    "page": 1,
    "totalPages": 14,
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
      "userId": {
        "id": "664a1b2c3d4e5f6a7b8c9d0a",
        "name": "Jane Doe",
        "email": "jane@example.com"
      },
      "assignedAdminId": "664a1b2c3d4e5f6a7b8c9d10",
      "lastReplyAt": "2026-05-11T11:24:30.000Z",
      "lastReplyBy": "ADMIN",
      "messagesCount": 3
    }
  ]
}
```

### Error: Forbidden role (403)
```json
{ "success": false, "statusCode": 403, "message": "You don't have permission to access this API" }
```
