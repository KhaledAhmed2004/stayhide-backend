# 06. Like Post

```http
POST /groups/posts/:postId/like
Content-Type: application/json
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

> Toggles a like on a post. If already liked, it will be unliked.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `postId` | `string` | ID of the post |

## Implementation

- **Route**: `group.route.ts`
- **Controller**: `group.controller.ts` — `toggleLike`
- **Service**: `group.service.ts` — `toggleLikeInDB`

### Business Logic
- **Toggling**: Uses `findOneAndDelete` for unliking and `create` for liking.
- **Notification**: Automatically notifies the post owner when someone likes their post (except for self-likes).

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Post liked",
  "data": {
    "liked": true
  }
}
```
