# 05. Get Group Feed

```http
GET /groups/:groupId/posts?page=1&limit=10&searchTerm=keyword
Content-Type: application/json
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

> Fetches the paginated list of posts for a specific group.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `groupId` | `string` | ID of the group |

## Implementation

- **Route**: `group.route.ts`
- **Controller**: `group.controller.ts` — `getGroupFeed`
- **Service**: `group.service.ts` — `getGroupFeedFromDB`

### Business Logic
- **Sort Order**: Posts are sorted by **pinned first** (`isPinned: -1`), then **newest first** (`createdAt: -1`). A custom `sort` query param overrides the default.
- **`isLiked`**: Returns `true` if the current user has liked the post.
- **`isPinned`**: Returns `true` if the post has been pinned by an admin. Pinned posts always appear at the top.
- **Deleted Users**: Automatically filters out posts from users who have been deleted from the system.
- **Search**: Supports content-based search via the `searchTerm` query parameter.
- **Membership Required**: Only group members (or `SUPER_ADMIN`) can access the feed. Returns `403` if not a member.

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Group feed fetched successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100
  },
  "data": [
    {
      "id": "60d5ecb86372ad46101f1930",
      "userId": {
        "id": "60d5ecb86372ad46101f1920",
        "name": "John Doe",
        "profileImage": "https://storage.com/johndoe.jpg"
      },
      "content": "Assalamu alaikum, looking forward to the next session!",
      "attachments": [],
      "likesCount": 5,
      "commentsCount": 2,
      "isLiked": true,
      "createdAt": "2026-05-09T10:45:00.000Z"
    }
  ]
}
```
