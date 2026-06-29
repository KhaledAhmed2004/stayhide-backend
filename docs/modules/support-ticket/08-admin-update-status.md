# 08. Admin — Update Ticket Status

```http
PATCH /support-tickets/admin/:ticketId/status
Content-Type: application/json
Auth: Bearer {{accessToken}} (SUPER_ADMIN)
```

## 1. Overview
Moves a ticket along the status lifecycle. Transitions are validated server-side against an explicit allow-list — invalid moves return `400 Bad Request`. Compare with the *automatic* transitions driven by replies in [05-reply-to-ticket.md](./05-reply-to-ticket.md).

## 2. Allowed Transitions

| From | Allowed `to` |
|---|---|
| `OPEN` | `IN_PROGRESS`, `RESOLVED`, `CLOSED` |
| `IN_PROGRESS` | `OPEN`, `RESOLVED`, `CLOSED` |
| `RESOLVED` | `CLOSED`, `REOPENED` |
| `REOPENED` | `IN_PROGRESS`, `RESOLVED`, `CLOSED` |
| `CLOSED` | `REOPENED` |

Same-value transitions (`OPEN → OPEN`) also return `400`.

## 3. Side Effects
- If `assignedAdminId` is currently `null`, it is set to the acting admin on the same update.
- Emits `TICKET_STATUS_CHANGED` to `ticket::{ticketId}`, `user::{ownerId}`, and `admin-tickets`.

## 4. Request

### URL params
| Param | Type | Constraint |
|---|---|---|
| `ticketId` | `string` | 24-char hex |

### Body
```json
{ "status": "RESOLVED" }
```

| Field | Type | Required | Constraint |
|---|---|---|---|
| `status` | `enum` | Yes | One of the 5 lifecycle values |

## 5. Implementation
- **Route**: `router.patch('/admin/:ticketId/status', ...)`
- **Controller**: `SupportTicketController.updateTicketStatus`
- **Service**: `SupportTicketService.updateTicketStatus`
- **Validation**: `SupportTicketValidation.updateStatusZodSchema`
- **Helper**: `isValidStatusTransition` in [support-ticket.utils.ts](../../../src/app/modules/support-ticket/support-ticket.utils.ts)

## 6. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Ticket status updated successfully",
  "data": {
    "id": "664a1b2c3d4e5f6a7b8c9d0e",
    "ticketNumber": "TCK-1001",
    "status": "RESOLVED",
    "assignedAdminId": "664a1b2c3d4e5f6a7b8c9d10"
  }
}
```

### Error: Invalid transition (400)
```json
{ "success": false, "statusCode": 400, "message": "Invalid status transition from CLOSED to OPEN" }
```

### Error: Validation (400)
```json
{ "success": false, "statusCode": 400, "message": "Validation Error", "errorMessages": [{ "path": "body.status", "message": "Invalid enum value" }] }
```

### Error: Not found (404)
```json
{ "success": false, "statusCode": 404, "message": "Ticket not found" }
```
