# 08. List Comments

```http
GET /learning-contents/:contentId/comments
Auth: SUPER_ADMIN, BROTHER, SISTER
```

> Specific content er shob comments dekhar jonno.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `contentId` | `string` | ID of the learning content |

## Query Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `page` | `number` | Page number |
| `limit` | `number` | Items per page |

## Implementation

- **Route**: `learning-content.route.ts`
- **Controller**: `learning-content.controller.ts` — `getComments`
- **Service**: `learning-content.service.ts` — `getCommentsFromDB`

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
    "total": 1,
    "totalPage": 1
  },
  "data": [
    {
      "_id": "60d5ecb86372ad46101f1940",
      "userId": {
        "_id": "60d5ecb86372ad46101f1920",
        "name": "Khaled",
        "profileImage": "https://example.com/profile.jpg"
      },
      "comment": "Very informative, JazakAllah!",
      "parentCommentId": null,
      "createdAt": "2026-05-12T12:00:00.000Z"
    }
  ]
}
```
