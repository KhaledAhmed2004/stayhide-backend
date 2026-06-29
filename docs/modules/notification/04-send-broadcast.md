# 04. Send Broadcast

```http
POST /notifications/broadcasts
Auth: Bearer {{accessToken}}
```

> Send a notification to a specific audience (All users, Brothers, Sisters, or Super Admins).

## Request Body
```json
{
  "title": "System Update",
  "text": "We have scheduled a maintenance window for tomorrow.",
  "audience": "ALL"
}
```

| Field | Type | Description |
| :--- | :--- | :--- |
| `title` | String | Title of the notification. |
| `text` | String | Main message content. |
| `audience` | String | Targeted group (`ALL`, `BROTHER`, `SISTER`). |

### Audience Options
- `ALL`: Targets all Brother and Sister roles.
- `BROTHER`: Targets only users with the `BROTHER` role.
- `SISTER`: Targets only users with the `SISTER` role.

## Success Response
**Code**: `200 OK`

```json
{
  "success": true,
  "message": "Notification sent to 150 users",
  "data": {
    "recipientCount": 150
  }
}
```
