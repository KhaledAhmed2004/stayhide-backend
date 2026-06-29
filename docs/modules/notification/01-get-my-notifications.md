# 01. Get My Notifications

```http
GET /notifications/me
Auth: Bearer {{accessToken}}
```

**Business Logic (`getNotificationFromDB`):**
- **Query Strategy**: Fetches the notification list and **unreadCount** in separate queries for accuracy.
- **Data Transformation**: The response is flattened and simplified for frontend consumption.
- **Resource Object**: The `resourceType` and `resourceId` are grouped into a `resource` object.
- **Unread Count**: The `unreadCount` is returned within the `meta` object alongside pagination info.
- **Pagination**: Supports page-based pagination (`page`, `limit`) using the `QueryBuilder`.

### Notification Types

The system can generate notifications for the following events:

| Type | Description |
|---|---|
| `ADMIN` | Broadcast notifications sent by admins. |
| `SYSTEM` | System-generated alerts. |
| `QUESTION_ANSWERED` | When an Imam answers a user's question. |
| `NEW_QUESTION` | When a new question is submitted (Admin/Imam notification). |
| `POST_LIKED` | When someone likes a group post. |
| `POST_COMMENTED` | When someone comments on a group post. |
| `COMMENT_REPLIED` | When someone replies to a comment. |
| `CONTENT_LIKED` | When someone likes learning content. |
| `CONTENT_COMMENTED` | When someone comments on learning content. |
| `NEW_CONTENT` | When new learning content is published. |
| `NEW_KHUTBAH` | When a new Khutbah is uploaded. |
| `MOSQUE_UPDATE` | When a mosque profile is updated. |

## Responses

### Scenario: Success (200)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Notifications retrieved successfully",
  "data": [
    {
      "id": "6a04c00e581ed9bcec093113",
      "type": "SYSTEM",
      "title": "New Connection Request",
      "text": "John wants to connect",
      "isRead": false,
      "createdAt": "2026-05-13T18:16:46.496Z",
      "resource": {
        "type": "User",
        "id": "6a047bd8edae48d18fc46bbf"
      }
    }
  ],
  "meta": {
    "pagination": {
      "total": 2,
      "limit": 10,
      "page": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    },
    "unreadCount": 2
  }
}
```
