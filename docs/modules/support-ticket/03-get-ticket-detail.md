# 03. Get Ticket Detail

```http
GET /support-tickets/:ticketId
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

## 1. Overview
Returns the parent ticket document. **Does not include messages** — those are paginated through [04-list-ticket-messages.md](./04-list-ticket-messages.md) to keep this response small even for long threads.

## 2. Business Rules

### 2.1 Authorization
- The service first loads the raw ticket (un-populated) and runs `assertTicketAccess`. The check is:
  - `SUPER_ADMIN` is always allowed.
  - Otherwise, `req.user.id` must equal `ticket.userId`.
- A non-owner non-admin gets `403 Forbidden`.
- This ordering matters — checking access on the *un-populated* document keeps the `String(ObjectId) === String(ObjectId)` comparison reliable. Populating `userId` first would turn it into an object and break the equality.

### 2.2 Population
Once authorized, the controller returns a second query that populates:
- `userId` → `{ name, email, profileImage }`
- `assignedAdminId` → `{ name, email, profileImage }` (nullable)

## 3. URL Parameters

| Param | Type | Constraint |
|---|---|---|
| `ticketId` | `string` | 24-char hex (validated by `ticketIdParamSchema`) |

## 4. Implementation
- **Route**: `router.get('/:ticketId', ...)` — must remain declared **after** all `/admin/*` and `/my` routes to avoid swallowing them as `:ticketId`.
- **Controller**: `SupportTicketController.getTicketById`
- **Service**: `SupportTicketService.getTicketById`

## 5. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Ticket fetched successfully",
  "data": {
    "id": "664a1b2c3d4e5f6a7b8c9d0e",
    "ticketNumber": "TCK-1001",
    "userId": {
      "id": "664a1b2c3d4e5f6a7b8c9d0a",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "profileImage": "http://localhost:5000/uploads/users/profiles/.../avatar.png"
    },
    "subject": "Payment failed but charged",
    "category": "BILLING",
    "status": "IN_PROGRESS",
    "priority": "HIGH",
    "assignedAdminId": {
      "id": "664a1b2c3d4e5f6a7b8c9d10",
      "name": "Admin User",
      "email": "admin@example.com",
      "profileImage": "..."
    },
    "lastReplyAt": "2026-05-11T11:24:30.000Z",
    "lastReplyBy": "ADMIN",
    "messagesCount": 3,
    "createdAt": "2026-05-11T10:00:00.000Z",
    "updatedAt": "2026-05-11T11:24:30.000Z"
  }
}
```

### Error: Invalid ticketId (400)
```json
{ "success": false, "statusCode": 400, "message": "Validation Error", "errorMessages": [{ "path": "params.ticketId", "message": "Invalid ticketId format" }] }
```

### Error: Forbidden (403)
```json
{ "success": false, "statusCode": 403, "message": "You do not have access to this ticket" }
```

### Error: Not found (404)
```json
{ "success": false, "statusCode": 404, "message": "Ticket not found" }
```
