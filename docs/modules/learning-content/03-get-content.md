# 03. Get Single Learning Content

```http
GET /learning-contents/:contentId
Auth: SUPER_ADMIN, BROTHER, SISTER
```

> Specific content details dekhar jonno.

## Path Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| `contentId` | `string` | ID of the learning content |

## Implementation

- **Route**: `learning-content.route.ts`
- **Controller**: `learning-content.controller.ts` — `getSingleLearningContent`
- **Service**: `learning-content.service.ts` — `getSingleLearningContentFromDB`

## Responses

### Scenario: Success (200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Learning content fetched successfully",
  "data": {
    "_id": "60d5ecb86372ad46101f1930",
    "title": "Basic Fiqh",
    "description": "Introduction to Islamic jurisprudence",
    "videoUrl": "https://example.com/video1.mp4",
    "category": "Fiqh",
    "durationInSeconds": 300,
    "likesCount": 10,
    "commentsCount": 5,
    "isLiked": false,
    "createdAt": "2026-05-12T10:00:00.000Z"
  }
}
```
