# 03. Mark All as Read

```http
PATCH /notifications/read-all
Auth: Bearer {{accessToken}}
```

> Marks all unread notifications for the logged-in user as read. Typically triggered when a user taps a "Mark all as read" button.

## Implementation
- **Route**: [notification.routes.ts](file:///src/app/modules/notification/notification.routes.ts)
- **Controller**: [notification.controller.ts](file:///src/app/modules/notification/notification.controller.ts) — `readAllNotifications`
- **Service**: [notification.service.ts](file:///src/app/modules/notification/notification.service.ts) — `markAllNotificationsAsRead`

**Business Logic (`readAllNotifications`):**
- **Bulk Update**: Uses `updateMany` to efficiently mark all of the user's unread notifications as read in a single database operation.
- **Idempotency**: If there are no unread notifications, the request will still succeed, reporting 0 documents updated.

## Responses

### Scenario: Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "All notifications marked as read",
  "data": {
    "updated": 5
  }
}
```
