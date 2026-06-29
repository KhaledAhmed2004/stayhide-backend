# 14. Get Post Comments

```http
GET /groups/posts/:postId/comments?page=1&limit=10
Content-Type: application/json
Auth: Bearer {{accessToken}} (BROTHER, SISTER, SUPER_ADMIN)
```

> Fetches the paginated list of comments for a specific post.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `postId` | `string` | ID of the post |

## Implementation

- **Route**: `group.route.ts`
- **Controller**: `group.controller.ts` — `getPostComments`
- **Service**: `group.service.ts` — `getPostCommentsFromDB`

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Comments fetched successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 5
  },
  "data": [
    {
      "id": "60d5ecb86372ad46101f1940",
      "postId": "60d5ecb86372ad46101f1930",
      "userId": {
        "id": "60d5ecb86372ad46101f1920",
        "name": "Jane Doe",
        "profileImage": "https://storage.com/janedoe.jpg"
      },
      "comment": "Great post!",
      "parentCommentId": null,
      "createdAt": "2026-05-09T11:00:00.000Z"
    }
  ]
}
```
