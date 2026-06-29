# 16. Pin/Unpin Post

```http
PATCH /groups/posts/:postId/pin
Content-Type: application/json
Auth: Bearer {{accessToken}} (SUPER_ADMIN)
```

> Toggles the "pinned" status of a post. Pinned posts appear at the top of the group feed.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `postId` | `string` | ID of the post |

## Implementation

- **Route**: `group.route.ts`
- **Controller**: `group.controller.ts` — `togglePinPost`
- **Service**: `group.service.ts` — `togglePinPostInDB`

### Business Logic
1. **Permission Check**: Only `SUPER_ADMIN` can pin/unpin posts.
2. **Sorting**: Pinned posts automatically float to the top of the feed returned by `GET /groups/:groupId/posts`.

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Post pinned",
  "data": {
    "isPinned": true
    // ... rest of post data
  }
}
```
