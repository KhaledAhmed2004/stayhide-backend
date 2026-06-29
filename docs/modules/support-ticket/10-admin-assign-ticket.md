# 10. Admin — Assign Ticket

```http
PATCH /support-tickets/admin/:ticketId/assign
Content-Type: application/json
Auth: Bearer {{accessToken}} (SUPER_ADMIN)
```

## 1. Overview
Explicitly sets `assignedAdminId` on a ticket. Two common call shapes:

- **Self-claim** — admin sends an empty body or omits `adminId`; the service falls back to `req.user.id`.
- **Reassign** — admin sends `{ "adminId": "<otherAdminObjectId>" }`.

Useful when an admin wants to triage without leaving a reply. Replies also auto-assign (see [05-reply-to-ticket.md](./05-reply-to-ticket.md)) but only when `assignedAdminId` was `null`.

## 2. Request

### URL params
| Param | Type | Constraint |
|---|---|---|
| `ticketId` | `string` | 24-char hex |

### Body
```json
{ "adminId": "664a1b2c3d4e5f6a7b8c9d10" }
```
*Or empty `{}` for self-claim.*

| Field | Type | Required | Constraint |
|---|---|---|---|
| `adminId` | `string` | No | 24-char hex; defaults to `req.user.id` |

## 3. Implementation
- **Route**: `router.patch('/admin/:ticketId/assign', ...)`
- **Controller**: `SupportTicketController.assignTicket`
- **Service**: `SupportTicketService.assignTicket`
- **Validation**: `SupportTicketValidation.assignTicketZodSchema`

> Note: the service does **not** verify that the provided `adminId` actually corresponds to a `SUPER_ADMIN` user — that check could be added later if assignment to non-admins becomes a concern.

## 4. Responses

### Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Ticket assigned successfully",
  "data": {
    "id": "664a1b2c3d4e5f6a7b8c9d0e",
    "assignedAdminId": "664a1b2c3d4e5f6a7b8c9d10"
  }
}
```

### Error: Invalid adminId (400)
```json
{ "success": false, "statusCode": 400, "message": "Invalid adminId" }
```

### Error: Not found (404)
```json
{ "success": false, "statusCode": 404, "message": "Ticket not found" }
```
