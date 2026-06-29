# 09. Delete Comment

```http
DELETE /groups/comments/:commentId
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

> Deletes a comment. If it's a top-level comment, all nested replies will also be deleted.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `commentId` | `string` | ID of the comment to delete |

## Implementation

- **Route**: `group.route.ts`
- **Controller**: `group.controller.ts` — `deleteComment`
- **Service**: `group.service.ts` — `deleteCommentInDB`

## Permissions

- **Author**: Can delete their own comment.
- **Super Admin**: Can delete any comment in any group.

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Comment deleted successfully"
}
```
