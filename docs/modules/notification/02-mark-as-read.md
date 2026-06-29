# 02. Mark as Read

```http
PATCH /notifications/:notificationId/read
Auth: Bearer {{accessToken}}
```

> Marks a single notification as read. This is typically called immediately when a user taps on a notification.

## Implementation
- **Route**: [notification.routes.ts](file:///src/app/modules/notification/notification.routes.ts)
- **Controller**: [notification.controller.ts](file:///src/app/modules/notification/notification.controller.ts) — `readNotification`
- **Service**: [notification.service.ts](file:///src/app/modules/notification/notification.service.ts) — `markNotificationAsReadIntoDB`

**Business Logic (`readNotification`):**
- **Ownership Check**: Only the intended recipient (`receiver`) of the notification can mark it as read.
- **Validation**: Verifies the notification exists in the database.
- **Idempotency**: If the notification is already marked as read (`isRead: true`), the server will still return a success response.
- **Timestamp**: Updates the `readAt` field with the current server time upon successful update.

## Responses

### Scenario: Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Notification marked as read successfully",
  "data": null
}
```
