# 07. Add Comment

```http
POST /learning-contents/:contentId/comments
Content-Type: application/json
Auth: BROTHER, SISTER
```

> Users can add comments or reply to existing comments.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `contentId` | `string` | ID of the learning content |

## Request Body

```json
{
  "comment": "Very informative, JazakAllah!",
  "parentCommentId": "60d5ecb86372ad46101f1940"
}
```

## Request Body Details

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `comment` | `string` | ✅ | Content of the comment |
| `parentCommentId` | `string` | ❌ | Reply korar jonno parent comment ID |

## Implementation

- **Route**: `learning-content.route.ts`
- **Controller**: `learning-content.controller.ts` — `addComment`
- **Service**: `learning-content.service.ts` — `addCommentInDB`

## Responses

### Scenario: Success (201)

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Comment added successfully",
  "data": {
    "_id": "60d5ecb86372ad46101f1940",
    "contentId": "60d5ecb86372ad46101f1930",
    "userId": "60d5ecb86372ad46101f1920",
    "comment": "Very informative, JazakAllah!",
    "parentCommentId": null,
    "createdAt": "2026-05-12T12:00:00.000Z"
  }
}
```
