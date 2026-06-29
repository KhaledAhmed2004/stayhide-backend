# 08. Delete Post

```http
DELETE /groups/posts/:postId
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

> Deletes a post and all its associated likes and comments. Also cleans up any attached files.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `postId` | `string` | ID of the post to delete |

## Implementation

- **Route**: `group.route.ts`
- **Controller**: `group.controller.ts` — `deletePost`
- **Service**: `group.service.ts` — `deletePostInDB`

## Permissions

- **Author**: Can delete their own post.
- **Super Admin**: Can delete any post in any group.

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Post deleted successfully"
}
```
