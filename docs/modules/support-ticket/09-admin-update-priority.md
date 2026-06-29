# 09. Admin — Update Ticket Priority

```http
PATCH /support-tickets/admin/:ticketId/priority
Content-Type: application/json
Auth: Bearer {{accessToken}} (SUPER_ADMIN)
```

## 1. Overview
Sets the ticket's priority. Unlike status, priority has no lifecycle constraints — any value can move to any other value at any time.

## 2. Side Effects
Emits `TICKET_PRIORITY_CHANGED` to `ticket::{ticketId}` and `admin-tickets`. The ticket owner does **not** receive this event by default — priority is an internal triage concern.

## 3. Request

### URL params
| Param | Type | Constraint |
|---|---|---|
| `ticketId` | `string` | 24-char hex |

### Body
```json
{ "priority": "HIGH" }
```

| Field | Type | Required | Constraint |
|---|---|---|---|
| `priority` | `enum` | Yes | `LOW`, `MEDIUM`, `HIGH` |

## 4. Implementation
- **Route**: `router.patch('/admin/:ticketId/priority', ...)`
- **Controller**: `SupportTicketController.updateTicketPriority`
- **Service**: `SupportTicketService.updateTicketPriority`
- **Validation**: `SupportTicketValidation.updatePriorityZodSchema`

## 5. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Ticket priority updated successfully",
  "data": {
    "id": "664a1b2c3d4e5f6a7b8c9d0e",
    "priority": "HIGH"
  }
}
```

### Error: Validation (400)
```json
{ "success": false, "statusCode": 400, "message": "Validation Error", "errorMessages": [{ "path": "body.priority", "message": "Invalid enum value" }] }
```

### Error: Not found (404)
```json
{ "success": false, "statusCode": 404, "message": "Ticket not found" }
```
