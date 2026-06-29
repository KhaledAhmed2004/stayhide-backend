# 09. Delete Comment

```http
DELETE /learning-contents/comments/:commentId
Auth: SUPER_ADMIN, BROTHER, SISTER
```

> User nijek comment delete korte pare, athoba Admin jekono comment delete korte pare.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `commentId` | `string` | ID of the comment |

## Implementation

- **Route**: `learning-content.route.ts`
- **Controller**: `learning-content.controller.ts` — `deleteComment`
- **Service**: `learning-content.service.ts` — `deleteCommentInDB`

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Comment deleted successfully"
}
```
